// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The editor of rendered Markdown as a custom text editor of VS Code (docs/platforms.md, R-GEN-004, R-VSC-001 to
// R-VSC-003): the file stays a text document of VS Code, so that saving, the dirty mark, hot exit, Git, the timeline and
// the other extensions work as for the text editor. The extension, for example Notes, registers the editor with its own
// view type and gives the script of its page, which creates the editor in the webview. This code connects the page to
// the document: it sends the text and each change of the document to the page, and makes each change of the user in
// the page a change of the document (src/messages.ts). VS Code does not say who made a change of the document, so the
// page gives each such change the origin `program` with the name `vscode`.
//
// The code gets the API of VS Code as a parameter and imports no module `vscode`, so that the tests give it an API of
// their own; it uses no Node.js API, so that it runs in the extension host of the web as well.

import { applyPatches, mergeTexts, patchesBetween, type TextSelection } from '@nimblescape/markdowntext';
import type * as vscode from 'vscode';
import { type HostMessage, type PageFonts, pageMessage, type PageMessage } from '../messages';
import { newNonce, pageHtml } from './page';

/** VsCode is the API of VS Code, the module `vscode` of the extension. */
export type VsCode = typeof vscode;

/** MarkdownEditorRegistration configures the editor of an extension. */
export interface MarkdownEditorRegistration {
  /** viewType is the ID of the custom editor, as the package.json of the extension contributes it in `customEditors`. */
  readonly viewType: string;
  /** script is the script of the page, which the extension bundles: it creates the editor with `connectVsCode`. */
  readonly script: vscode.Uri;
  /**
   * styles are the style sheets of the page, in their order: `markdown.css` of `@nimblescape/markdowneditor`, then
   * `vscode.css` of this package, then those of the extension.
   */
  readonly styles?: readonly vscode.Uri[];
  /**
   * resourceRoots are more folders from which the page may load files. The page may always load from the folders of
   * the script and of the styles and from the workspace folder of the file, or the folder of the file outside a
   * workspace.
   */
  readonly resourceRoots?: readonly vscode.Uri[];
  /**
   * opens returns false for a document that the text editor shows in place of this editor, for example by a setting of
   * the extension (R-GEN-004). The default opens every document.
   */
  readonly opens?: (document: vscode.TextDocument) => boolean;
  /**
   * openTextCommand is the ID of a command that opens the text editor of the file to the side (R-VSC-002); the
   * package.json of the extension contributes the command and its button in the title of the editor.
   */
  readonly openTextCommand?: string;
  /**
   * retainContextWhenHidden keeps the page while its tab is in the background, so that the editor keeps its Undo, its
   * scroll position and its selection. The default is true.
   */
  readonly retainContextWhenHidden?: boolean;
  /**
   * plugins connect the parts of the plugins of the editor in the extension with their parts on the page, by the name
   * of the plugin (docs/plugins.md, R-PLUGIN-001): each function gets the channel of its plugin in a panel when the
   * panel opens, and may return what to dispose when the panel closes.
   */
  readonly plugins?: Readonly<Record<string, (channel: PluginPanelChannel) => void | vscode.Disposable>>;
}

/**
 * PluginPanelChannel is the channel of a plugin of the editor in one panel. The messages of the page come from a page
 * that shows the content of a file, so the plugin checks each message before it uses it.
 */
export interface PluginPanelChannel {
  /** document is the document of the panel. */
  readonly document: vscode.TextDocument;
  /** panel is the webview panel. */
  readonly panel: vscode.WebviewPanel;
  /** post sends a message to the part of the plugin on the page. */
  post(message: unknown): Thenable<boolean>;
  /** onMessage calls a listener with each message of the part of the plugin on the page. */
  onMessage(listener: (message: unknown) => void): vscode.Disposable;
}

/**
 * registerMarkdownEditor registers the editor as the custom text editor of a view type, and the command that opens the
 * text editor to the side.
 * @param api - The API of VS Code, the module `vscode` of the extension.
 * @param registration - The view type, the page and the options of the editor.
 * @returns The disposable that ends the registration.
 */
export function registerMarkdownEditor(api: VsCode, registration: MarkdownEditorRegistration): vscode.Disposable {
  const panels = new Set<EditorPanel>();
  const provider: vscode.CustomTextEditorProvider = {
    resolveCustomTextEditor: async (document, webviewPanel) => {
      if (registration.opens && !registration.opens(document)) {
        // The text editor takes the place of the panel in the same group.
        await api.commands.executeCommand('vscode.openWith', document.uri, 'default', webviewPanel.viewColumn);
        webviewPanel.dispose();
        return;
      }
      const panel = new EditorPanel(api, registration, document, webviewPanel);
      panels.add(panel);
      webviewPanel.onDidDispose(() => {
        panels.delete(panel);
        panel.dispose();
      });
    },
  };
  const disposables: vscode.Disposable[] = [
    api.window.registerCustomEditorProvider(registration.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: registration.retainContextWhenHidden ?? true },
    }),
  ];
  if (registration.openTextCommand) {
    disposables.push(
      api.commands.registerCommand(registration.openTextCommand, async (uri?: vscode.Uri) => {
        // The button in the title of the editor gives the file; without it, the command takes the active editor.
        const key = uri?.toString();
        const matching = [...panels].filter((panel) => key === undefined || panel.uri.toString() === key);
        const panel = matching.find((candidate) => candidate.active) ?? matching[0];
        if (panel) {
          await panel.openText();
        } else if (uri) {
          await api.commands.executeCommand('vscode.openWith', uri, 'default', { viewColumn: api.ViewColumn.Beside, preview: false });
        }
      }),
    );
  }
  return {
    dispose: () => {
      disposables.forEach((disposable) => disposable.dispose());
      panels.forEach((panel) => panel.dispose());
      panels.clear();
    },
  };
}

/** Sent is a version of the document that the extension sent to the page, with its text. */
interface Sent {
  readonly version: number;
  readonly text: string;
}

/** EditorPanel connects one webview panel of the editor to its document. */
class EditorPanel {
  private sent: Sent | undefined;
  /** texts holds the text of each version that the page may still give as the base of a change. */
  private readonly texts = new Map<number, string>();
  private applying = false;
  private lost = false;
  private disposed = false;
  private selection: TextSelection | undefined;
  private readonly subscriptions: vscode.Disposable[] = [];
  /** listeners holds the listeners of the messages of the plugins, by the name of the plugin. */
  private readonly listeners = new Map<string, Set<(message: unknown) => void>>();

  constructor(
    private readonly api: VsCode,
    registration: MarkdownEditorRegistration,
    readonly document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
  ) {
    const folder = (uri: vscode.Uri) => api.Uri.joinPath(uri, '..');
    const styles = registration.styles ?? [];
    const workspaceFolder = api.workspace.getWorkspaceFolder(document.uri)?.uri;
    const fileFolder = document.isUntitled ? undefined : folder(document.uri);
    const documentRoot = workspaceFolder ?? fileFolder;
    const roots = [...(registration.resourceRoots ?? []), folder(registration.script), ...styles.map(folder), ...(documentRoot ? [documentRoot] : [])];
    const webview = panel.webview;
    webview.options = { enableScripts: true, localResourceRoots: roots };
    webview.html = pageHtml({
      webview,
      script: registration.script,
      styles,
      base: fileFolder,
      language: api.env.language,
      title: document.uri.path.slice(document.uri.path.lastIndexOf('/') + 1),
      nonce: newNonce(),
    });
    this.subscriptions.push(
      webview.onDidReceiveMessage((data: unknown) => this.received(data)),
      api.workspace.onDidChangeTextDocument((event) => {
        if (!this.applying && event.document.uri.toString() === document.uri.toString()) {
          this.sendText();
        }
      }),
      api.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('markdown.preview', document.uri)) {
          this.post({ type: 'fonts', fonts: this.fonts() });
        }
      }),
      panel.onDidChangeViewState(() => {
        // A message that VS Code could not give the page leaves the page behind: it starts again from the document.
        if (panel.visible && this.lost) {
          this.sendInit();
        }
      }),
    );
    for (const [plugin, connect] of Object.entries(registration.plugins ?? {})) {
      const disposable = connect(this.channel(plugin));
      if (disposable) {
        this.subscriptions.push(disposable);
      }
    }
  }

  /** channel returns the channel of a plugin in this panel. */
  private channel(plugin: string): PluginPanelChannel {
    return {
      document: this.document,
      panel: this.panel,
      post: (message) => (this.disposed ? Promise.resolve(false) : this.panel.webview.postMessage({ type: 'plugin', plugin, message } satisfies HostMessage)),
      onMessage: (listener) => {
        const listeners = this.listeners.get(plugin) ?? new Set();
        listeners.add(listener);
        this.listeners.set(plugin, listeners);
        return { dispose: () => listeners.delete(listener) };
      },
    };
  }

  /** uri is the URI of the file. */
  get uri(): vscode.Uri {
    return this.document.uri;
  }

  /** active is true while the panel is the active editor. */
  get active(): boolean {
    return this.panel.active;
  }

  /** openText opens the text editor of the file to the side, with the selection of the page (R-VSC-002). */
  async openText(): Promise<void> {
    const options: vscode.TextDocumentShowOptions = { viewColumn: this.api.ViewColumn.Beside, preview: false };
    const selection = this.selection;
    const show = selection
      ? {
          ...options,
          selection: new this.api.Range(this.document.positionAt(Math.min(selection.anchor, selection.head)), this.document.positionAt(Math.max(selection.anchor, selection.head))),
        }
      : options;
    await this.api.commands.executeCommand('vscode.openWith', this.document.uri, 'default', show);
  }

  /** dispose ends the connection of the panel. */
  dispose(): void {
    this.disposed = true;
    this.subscriptions.forEach((subscription) => subscription.dispose());
    this.subscriptions.length = 0;
    this.listeners.clear();
  }

  /** received takes a message of the page. */
  private received(data: unknown): void {
    const message = pageMessage(data);
    switch (message?.type) {
      case 'ready':
        this.sendInit();
        break;
      case 'edit':
        void this.edit(message);
        break;
      case 'selection':
        this.selection = message.selection;
        break;
      case 'openText':
        void this.openText();
        break;
      case 'plugin':
        [...(this.listeners.get(message.plugin) ?? [])].forEach((listener) => listener(message.message));
        break;
    }
  }

  /** editable is false when the file system of the file cannot write, for example an older version from Git. */
  private editable(): boolean {
    return this.api.workspace.fs.isWritableFileSystem(this.document.uri.scheme) !== false;
  }

  /** fonts returns the fonts of the settings of the Markdown preview (R-THEME-003). */
  private fonts(): PageFonts {
    const settings = this.api.workspace.getConfiguration('markdown.preview', this.document.uri);
    const fontFamily = settings.get<unknown>('fontFamily');
    const fontSize = settings.get<unknown>('fontSize');
    const lineHeight = settings.get<unknown>('lineHeight');
    const positive = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined);
    return {
      fontFamily: typeof fontFamily === 'string' && fontFamily.trim() !== '' ? fontFamily : undefined,
      fontSize: positive(fontSize),
      lineHeight: positive(lineHeight),
    };
  }

  /** remember notes a version as sent to the page. */
  private remember(version: number, text: string): void {
    this.sent = { version, text };
    this.texts.set(version, text);
  }

  /** sendInit sends the whole text of the document, when the page starts or must start again. */
  private sendInit(): void {
    const text = this.document.getText();
    this.texts.clear();
    this.remember(this.document.version, text);
    this.lost = false;
    this.post({ type: 'init', text, version: this.document.version, editable: this.editable(), fonts: this.fonts() });
  }

  /** sendText sends a change of the document that the page did not make. */
  private sendText(): void {
    const sent = this.sent;
    if (!sent || sent.version === this.document.version) {
      return;
    }
    const text = this.document.getText();
    const message: HostMessage = { type: 'text', from: sent.version, version: this.document.version, patches: patchesBetween(sent.text, text) };
    this.remember(this.document.version, text);
    this.post(message);
  }

  /**
   * edit makes a change of the user in the page a change of the document. A change of the document since the base of
   * the change merges with it (mergeTexts of `@nimblescape/markdowntext`).
   */
  private async edit(message: Extract<PageMessage, { type: 'edit' }>): Promise<void> {
    const base = this.texts.get(message.base);
    let ours: string | undefined;
    try {
      ours = base === undefined ? undefined : applyPatches(base, message.patches);
    } catch {
      ours = undefined;
    }
    if (base === undefined || ours === undefined) {
      this.sendInit();
      return;
    }
    // The page gives a later base only, so the texts of the versions before it are no longer needed.
    for (const version of [...this.texts.keys()]) {
      if (version < message.base) {
        this.texts.delete(version);
      }
    }
    const theirs = this.document.getText();
    const patches = patchesBetween(theirs, mergeTexts(base, ours, theirs));
    let done = true;
    if (patches.length > 0) {
      const edit = new this.api.WorkspaceEdit();
      for (const patch of patches) {
        edit.replace(this.document.uri, new this.api.Range(this.document.positionAt(patch.from), this.document.positionAt(patch.to)), patch.insert);
      }
      this.applying = true;
      try {
        done = this.editable() && (await this.api.workspace.applyEdit(edit));
      } catch {
        done = false;
      } finally {
        this.applying = false;
      }
    }
    const sent = this.sent;
    if (this.disposed || !sent) {
      return;
    }
    const text = this.document.getText();
    this.post({ type: 'applied', id: message.id, done, from: sent.version, version: this.document.version, patches: patchesBetween(sent.text, text) });
    this.remember(this.document.version, text);
  }

  /** post sends a message to the page and notes when VS Code could not give it. */
  private post(message: HostMessage): void {
    if (this.disposed) {
      return;
    }
    this.panel.webview.postMessage(message).then(
      (posted) => {
        if (!posted) {
          this.lost = true;
        }
      },
      () => {
        this.lost = true;
      },
    );
  }
}
