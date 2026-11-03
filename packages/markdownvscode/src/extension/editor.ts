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
// The page shows the editor ("Edit") or the pages of the file in its layout ("Pages", docs/rendering.md, R-LAYOUT-003).
// The commands of the extension switch the view of the active panel; the context key `<view type>.pages` is true while
// the active panel shows the pages, so that the title of the editor shows the button of the other view. For the pages,
// the page reads the files of the layouts through the extension, only from the folders from which it may load files.
//
// The plugins of the editor of other extensions (docs/plugins.md, R-PLUGIN-002; docs/platforms.md, R-VSC-008): with the
// option `contributedPlugins`, the page loads the scripts that the package.json of another extension names in the
// contribution point `nimblescape.markdown.extensions`, for example the plugins of Paper in the editor of Notes. The
// part of such a plugin in the other extension connects later, through `addPlugin` of the registration; the messages
// that its part on the page sends before wait for it.
//
// The rendered changes (docs/platforms.md, R-VSC-009): the package.json of the extension asks for the editor in the
// diffs of VS Code, with `"priority": { "textEditor": "default", "diffEditor": "default" }` (VS Code 1.125 and later).
// VS Code then opens the editor on both sides of a diff, each side a panel of its own, and the API of VS Code knows no
// input for the tab of such a diff. So a panel that opens while the active tab of its group has no input is a side of
// a diff, and the next panel that opens for the same tab soon after is the other side: the code connects the two. It
// gives each page its side and the text of the other side, and carries the heights of the rows and the scroll place
// between the two pages. The commands of the registration go to the next and the previous change, with the context
// key `<view type>.diff`, which is true while the active tab is such a diff.
//
// The code gets the API of VS Code as a parameter and imports no module `vscode`, so that the tests give it an API of
// their own; it uses no Node.js API, so that it runs in the extension host of the web as well.

import { applyPatches, mergeTexts, patchesBetween, type TextSelection } from '@nimblescape/markdowntext';
import type * as vscode from 'vscode';
import { type DiffSide, type HostMessage, type PageFiles, type PageFolder, type PageFonts, pageMessage, type PageMessage, type PageView, pluginName, toBase64 } from '../messages';
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
   * showPagesCommand and showEditCommand are the IDs of the commands that switch the active panel to the view "Pages"
   * and back to "Edit" (docs/rendering.md, R-LAYOUT-003); the package.json of the extension contributes the commands
   * and their buttons in the title of the editor, with the context key `<view type>.pages`.
   */
  readonly showPagesCommand?: string;
  readonly showEditCommand?: string;
  /**
   * nextChangeCommand and previousChangeCommand are the IDs of the commands that go to the next and to the previous
   * change of a diff (docs/platforms.md, R-VSC-009); the package.json of the extension contributes the commands and
   * their buttons in the title of the editor, with the context key `<view type>.diff`.
   */
  readonly nextChangeCommand?: string;
  readonly previousChangeCommand?: string;
  /**
   * pagesScripts are the scripts of the pages, Paged.js last: the extension copies `paged.polyfill.js` of
   * @nimblescape/markdownlayout to the folder of its scripts. The page may load them.
   */
  readonly pagesScripts?: readonly vscode.Uri[];
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
  readonly plugins?: Readonly<Record<string, PluginConnect>>;
  /**
   * contributedPlugins gives the page the scripts of the plugins of the editor that other extensions contribute
   * (docs/plugins.md, R-PLUGIN-002; docs/platforms.md, R-VSC-008): the scripts that the package.json of an extension
   * names in `contributes["nimblescape.markdown.extensions"].editorScripts`. The page may load them, and loads them
   * with `loadPlugins` of @nimblescape/markdowneditor from `pluginScripts` of its connection. The default is false.
   */
  readonly contributedPlugins?: boolean;
}

/**
 * PluginConnect connects the part of a plugin of the editor in an extension with its part on the page of a panel: it
 * gets the channel of the plugin in the panel, and may return what to dispose when the panel closes.
 */
export type PluginConnect = (channel: PluginPanelChannel) => void | vscode.Disposable;

/** MarkdownEditorHandle ends the registration of the editor, and connects the plugins of other extensions. */
export interface MarkdownEditorHandle extends vscode.Disposable {
  /**
   * addPlugin connects the part of a plugin of the editor in an extension, as `plugins` of the registration does, in
   * each open panel and in each panel that opens later, for example the part of a plugin of Paper in the editor of
   * Notes (R-PLUGIN-002). The messages that the part on the page sent before wait for the first listener of the plugin.
   * @param name - The name of the plugin.
   * @param connect - The function that connects the plugin in a panel.
   * @returns The disposable that disconnects the plugin in every panel.
   */
  addPlugin(name: string, connect: PluginConnect): vscode.Disposable;
}

/** pluginContribution is the contribution point of the package.json of an extension for the plugins of the editor. */
export const pluginContribution = 'nimblescape.markdown.extensions';

/**
 * contributedPluginScripts returns the scripts of the plugins of the editor that the extensions contribute, in the
 * order of the IDs of the extensions (R-VSC-008). A script must be a file `.js` in the folder of its extension.
 * @param api - The API of VS Code.
 */
export function contributedPluginScripts(api: VsCode): vscode.Uri[] {
  const scripts: vscode.Uri[] = [];
  const extensions = [...api.extensions.all].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const extension of extensions) {
    const contributes: unknown = (extension.packageJSON as { contributes?: unknown } | undefined)?.contributes;
    const contribution = isRecord(contributes) ? contributes[pluginContribution] : undefined;
    const editorScripts = isRecord(contribution) ? contribution.editorScripts : undefined;
    if (!Array.isArray(editorScripts)) {
      continue;
    }
    const root = slashed(extension.extensionUri.toString());
    for (const script of editorScripts) {
      if (typeof script !== 'string' || !script.endsWith('.js')) {
        continue;
      }
      const uri = api.Uri.joinPath(extension.extensionUri, script);
      if (uri.toString().startsWith(root)) {
        scripts.push(uri);
      }
    }
  }
  return scripts;
}

/** isRecord is true for an object that is no array. */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** AddedPlugin is a plugin that `addPlugin` connects. */
interface AddedPlugin {
  readonly name: string;
  readonly connect: PluginConnect;
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
 * @returns The handle that ends the registration and connects the plugins of other extensions.
 */
export function registerMarkdownEditor(api: VsCode, registration: MarkdownEditorRegistration): MarkdownEditorHandle {
  const panels = new Set<EditorPanel>();
  const added = new Set<AddedPlugin>();
  /** waiting holds the first panel of a diff until its other side opens, by the group and the label of the tab. */
  const waiting = new Map<string, { readonly panel: EditorPanel; readonly at: number }>();
  /** diffs holds the connected sides of the diffs. */
  const diffs = new Set<Diff>();
  const diffContext = registration.nextChangeCommand || registration.previousChangeCommand ? `${registration.viewType}.diff` : undefined;
  let diffActive: boolean | undefined;
  /** activeDiff returns the diff of the active tab. */
  const activeDiff = (): Diff | undefined => {
    const group = api.window.tabGroups?.activeTabGroup;
    const tab = group?.activeTab;
    return tab && tab.input === undefined ? [...diffs].find((diff) => diff.column === group.viewColumn && diff.label === tab.label) : undefined;
  };
  /** showDiff sets the context key of the diff, for the buttons of the changes in the title of the editor. */
  const showDiff = () => {
    const active = activeDiff() !== undefined;
    if (diffContext && active !== diffActive) {
      diffActive = active;
      void api.commands.executeCommand('setContext', diffContext, active);
    }
  };
  /** connectDiff connects the two panels of a diff, or opens the text diff for a file that does not open in the editor. */
  const connectDiff = async (first: EditorPanel, second: EditorPanel, tab: vscode.Tab) => {
    const [original, modified] = diffSides(first, second);
    if (registration.opens && !registration.opens(modified.document)) {
      // The text diff of VS Code takes the place of the diff: the option `override` of the command opens the editor of
      // the text, as "Reopen Editor With" does for a file.
      await api.window.tabGroups.close(tab);
      await api.commands.executeCommand('vscode.diff', original.uri, modified.uri, tab.label, {
        viewColumn: tab.group.viewColumn,
        preview: tab.isPreview,
        override: true,
      });
      return;
    }
    const diff: Diff = { original, modified, column: tab.group.viewColumn, label: tab.label };
    diffs.add(diff);
    original.setDiff('original', modified);
    modified.setDiff('modified', original);
    showDiff();
  };
  const provider: vscode.CustomTextEditorProvider = {
    resolveCustomTextEditor: async (document, webviewPanel) => {
      const diffTab = diffTabOf(api, webviewPanel);
      if (!diffTab && registration.opens && !registration.opens(document)) {
        // The text editor takes the place of the panel in the same group.
        await api.commands.executeCommand('vscode.openWith', document.uri, 'default', webviewPanel.viewColumn);
        webviewPanel.dispose();
        return;
      }
      const panel = new EditorPanel(api, registration, document, webviewPanel, [...added]);
      panels.add(panel);
      webviewPanel.onDidDispose(() => {
        panels.delete(panel);
        panel.dispose();
        [...diffs].filter((diff) => diff.original === panel || diff.modified === panel).forEach((diff) => diffs.delete(diff));
        showDiff();
      });
      if (diffTab) {
        const key = `${diffTab.group.viewColumn}\n${diffTab.label}`;
        const first = waiting.get(key);
        waiting.delete(key);
        if (first && !first.panel.isDisposed && Date.now() - first.at <= diffPairTime) {
          await connectDiff(first.panel, panel, diffTab);
        } else {
          waiting.set(key, { panel, at: Date.now() });
        }
      }
    },
  };
  const disposables: vscode.Disposable[] = [
    api.window.registerCustomEditorProvider(registration.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: registration.retainContextWhenHidden ?? true },
    }),
  ];
  if (diffContext && api.window.tabGroups) {
    disposables.push(api.window.tabGroups.onDidChangeTabs(showDiff), api.window.tabGroups.onDidChangeTabGroups(showDiff));
  }
  for (const [command, direction] of [
    [registration.nextChangeCommand, 'next'],
    [registration.previousChangeCommand, 'previous'],
  ] as const) {
    if (command) {
      disposables.push(
        api.commands.registerCommand(command, () => {
          const diff = activeDiff();
          // The side with the focus goes, else the newer side; the other side follows its scroll.
          const side = diff && (diff.original.active ? diff.original : diff.modified);
          side?.goToChange(direction);
        }),
      );
    }
  }
  /** panelOf returns the panel of a file, the active one when no file is given, as for the button in the title. */
  const panelOf = (uri?: vscode.Uri): EditorPanel | undefined => {
    const key = uri?.toString();
    const matching = [...panels].filter((panel) => key === undefined || panel.uri.toString() === key);
    return matching.find((candidate) => candidate.active) ?? matching[0];
  };
  for (const [command, view] of [
    [registration.showPagesCommand, 'pages'],
    [registration.showEditCommand, 'edit'],
  ] as const) {
    if (command) {
      disposables.push(api.commands.registerCommand(command, (uri?: vscode.Uri) => panelOf(uri)?.setView(view)));
    }
  }
  if (registration.openTextCommand) {
    disposables.push(
      api.commands.registerCommand(registration.openTextCommand, async (uri?: vscode.Uri) => {
        // The button in the title of the editor gives the file; without it, the command takes the active editor.
        const panel = panelOf(uri);
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
      added.clear();
    },
    addPlugin: (name, connect) => {
      if (!pluginName.test(name)) {
        throw new Error(`No name of a plugin: ${name}`);
      }
      const plugin: AddedPlugin = { name, connect };
      added.add(plugin);
      panels.forEach((panel) => panel.connect(plugin));
      return {
        dispose: () => {
          added.delete(plugin);
          panels.forEach((panel) => panel.disconnect(plugin));
        },
      };
    },
  };
}

/** Diff holds the two connected sides of a diff, with the group and the label of its tab. */
interface Diff {
  readonly original: EditorPanel;
  readonly modified: EditorPanel;
  readonly column: vscode.ViewColumn;
  readonly label: string;
}

/** diffPairTime is the time in milliseconds in which the second side of a diff opens after the first one. */
const diffPairTime = 2000;

/**
 * diffTabOf returns the tab of a diff that a panel opens in: the active tab of the group of the panel, when the API of
 * VS Code knows no input for it, as for a diff of two custom editors.
 * @param api - The API of VS Code.
 * @param panel - The panel.
 */
function diffTabOf(api: VsCode, panel: vscode.WebviewPanel): vscode.Tab | undefined {
  const group = api.window.tabGroups?.all.find((each) => each.viewColumn === panel.viewColumn);
  const tab = group?.activeTab;
  return tab && tab.input === undefined ? tab : undefined;
}

/** gitRef returns the reference of a version of Git, from the URI of the Git extension, or undefined. */
function gitRef(uri: vscode.Uri): string | undefined {
  if (uri.scheme !== 'git') {
    return undefined;
  }
  try {
    const query: unknown = JSON.parse(uri.query);
    return isRecord(query) && typeof query.ref === 'string' ? query.ref : undefined;
  } catch {
    return undefined;
  }
}

/** parentOf is true when a reference of Git names the parent of another one, for example `abc^` of `abc`. */
const parentOf = (parent: string, child: string): boolean => [`${child}^`, `${child}~`, `${child}~1`, `${child}^1`].includes(parent);

/**
 * diffSides returns the older and the newer side of the two panels of a diff. VS Code does not say which panel is on
 * the left: the document that cannot change is the older version, for example a version from Git; of two versions from
 * Git, the version of the parent commit is the older one; else the panel that opened first is the older one, as VS Code
 * opens them for the command `vscode.diff`.
 */
function diffSides(first: EditorPanel, second: EditorPanel): [EditorPanel, EditorPanel] {
  if (first.writable !== second.writable) {
    return first.writable ? [second, first] : [first, second];
  }
  const firstRef = gitRef(first.uri);
  const secondRef = gitRef(second.uri);
  if (firstRef !== undefined && secondRef !== undefined && parentOf(secondRef, firstRef)) {
    return [second, first];
  }
  return [first, second];
}

/** slashed returns the address of a folder with a slash at its end. */
const slashed = (address: string): string => (address.endsWith('/') ? address : `${address}/`);

/** Sent is a version of the document that the extension sent to the page, with its text. */
interface Sent {
  readonly version: number;
  readonly text: string;
}

/** pendingLimit is the number of the messages of the page that wait for the plugins without a listener. */
const pendingLimit = 100;

/** EditorPanel connects one webview panel of the editor to its document. */
class EditorPanel {
  private sent: Sent | undefined;
  /** texts holds the text of each version that the page may still give as the base of a change. */
  private readonly texts = new Map<number, string>();
  private applying = false;
  private lost = false;
  private disposed = false;
  private selection: TextSelection | undefined;
  private view: PageView = 'edit';
  /** folders are the folders from which the page may load and read files, with their addresses in the webview. */
  private readonly folders: PageFolder[];
  private readonly pagesScripts: string[];
  /** top is the top folder of the search for a layout: the workspace folder of the file, else its folder. */
  private readonly top: vscode.Uri | undefined;
  private readonly subscriptions: vscode.Disposable[] = [];
  /** listeners holds the listeners of the messages of the plugins, by the name of the plugin. */
  private readonly listeners = new Map<string, Set<(message: unknown) => void>>();
  /** pending holds the messages of the page for the plugins without a listener, by the name of the plugin. */
  private readonly pending = new Map<string, unknown[]>();
  private pendingCount = 0;
  /** connections holds the functions that disconnect the plugins in this panel. */
  private readonly connections = new Map<object, () => void>();
  /** pluginScripts are the addresses of the scripts of the plugins of other extensions in the webview. */
  private readonly pluginScripts: string[];
  /** diffSide is the side of the panel in a diff, and partner the panel of the other side. */
  private diffSide: DiffSide | undefined;
  private partner: EditorPanel | undefined;

  constructor(
    private readonly api: VsCode,
    private readonly registration: MarkdownEditorRegistration,
    readonly document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
    added: readonly AddedPlugin[],
  ) {
    const folder = (uri: vscode.Uri) => api.Uri.joinPath(uri, '..');
    const styles = registration.styles ?? [];
    const scripts = registration.pagesScripts ?? [];
    const workspaceFolder = api.workspace.getWorkspaceFolder(document.uri)?.uri;
    const fileFolder = document.isUntitled ? undefined : folder(document.uri);
    const documentRoot = workspaceFolder ?? fileFolder;
    this.top = documentRoot;
    const roots = [
      ...(registration.resourceRoots ?? []),
      folder(registration.script),
      ...styles.map(folder),
      ...scripts.map(folder),
      ...(documentRoot ? [documentRoot] : []),
    ];
    const webview = panel.webview;
    this.folders = roots.map((root) => ({ folder: slashed(root.toString()), webview: slashed(webview.asWebviewUri(root).toString()) }));
    this.pagesScripts = scripts.map((script) => webview.asWebviewUri(script).toString());
    // The page may load the scripts of the plugins of other extensions, but reads no other file of their folders.
    const pluginScripts = registration.contributedPlugins ? contributedPluginScripts(api) : [];
    this.pluginScripts = pluginScripts.map((script) => webview.asWebviewUri(script).toString());
    webview.options = { enableScripts: true, localResourceRoots: [...roots, ...pluginScripts.map(folder)] };
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
        if (panel.active) {
          this.showView();
        }
      }),
    );
    for (const [name, connect] of Object.entries(registration.plugins ?? {})) {
      this.connect({ name, connect });
    }
    added.forEach((plugin) => this.connect(plugin));
  }

  /**
   * connect connects a plugin in this panel.
   * @param plugin - The name of the plugin and the function that connects it.
   */
  connect(plugin: AddedPlugin): void {
    if (this.disposed || this.connections.has(plugin)) {
      return;
    }
    const own = new Set<(message: unknown) => void>();
    const disposable = plugin.connect(this.channel(plugin.name, own));
    this.connections.set(plugin, () => {
      own.forEach((listener) => this.listeners.get(plugin.name)?.delete(listener));
      disposable?.dispose();
    });
  }

  /**
   * disconnect disconnects a plugin in this panel: its listeners stop, and what its function returned is disposed.
   * @param plugin - The plugin, as `connect` got it.
   */
  disconnect(plugin: AddedPlugin): void {
    this.connections.get(plugin)?.();
    this.connections.delete(plugin);
  }

  /**
   * channel returns the channel of a plugin in this panel.
   * @param plugin - The name of the plugin.
   * @param own - The set of the listeners that the channel adds, so that a disconnect stops them.
   */
  private channel(plugin: string, own: Set<(message: unknown) => void>): PluginPanelChannel {
    return {
      document: this.document,
      panel: this.panel,
      post: (message) => (this.disposed ? Promise.resolve(false) : this.panel.webview.postMessage({ type: 'plugin', plugin, message } satisfies HostMessage)),
      onMessage: (listener) => {
        const listeners = this.listeners.get(plugin) ?? new Set();
        listeners.add(listener);
        own.add(listener);
        this.listeners.set(plugin, listeners);
        this.deliverPending(plugin);
        return {
          dispose: () => {
            listeners.delete(listener);
            own.delete(listener);
          },
        };
      },
    };
  }

  /**
   * deliverPending gives the messages of the page that waited for a plugin to its listeners, after the function that
   * connects the plugin added all of them.
   */
  private deliverPending(plugin: string): void {
    const messages = this.pending.get(plugin);
    if (!messages) {
      return;
    }
    this.pending.delete(plugin);
    this.pendingCount -= messages.length;
    queueMicrotask(() => messages.forEach((message) => this.deliver(plugin, message)));
  }

  /** deliver gives a message of the page to the listeners of its plugin, or keeps it while the plugin has none. */
  private deliver(plugin: string, message: unknown): void {
    const listeners = this.listeners.get(plugin);
    if (this.disposed) {
      return;
    }
    if (listeners && listeners.size > 0) {
      [...listeners].forEach((listener) => listener(message));
    } else if (this.pendingCount < pendingLimit) {
      // The part of the plugin in another extension may connect later (R-PLUGIN-002).
      this.pending.set(plugin, [...(this.pending.get(plugin) ?? []), message]);
      this.pendingCount++;
    }
  }

  /** uri is the URI of the file. */
  get uri(): vscode.Uri {
    return this.document.uri;
  }

  /** active is true while the panel is the active editor. */
  get active(): boolean {
    return this.panel.active;
  }

  /** isDisposed is true after the panel closed. */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /** writable is false when the file system of the file cannot write, for example an older version from Git. */
  get writable(): boolean {
    return this.api.workspace.fs.isWritableFileSystem(this.document.uri.scheme) !== false;
  }

  /**
   * setDiff makes the panel a side of a diff (docs/platforms.md, R-VSC-009): the page gets its side and the text of the
   * other side, and each new text of the other side. The older side is read-only.
   * @param side - The side of the panel.
   * @param partner - The panel of the other side.
   */
  setDiff(side: DiffSide, partner: EditorPanel): void {
    this.diffSide = side;
    this.partner = partner;
    this.subscriptions.push(
      this.api.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === partner.uri.toString()) {
          this.post({ type: 'diffText', text: partner.document.getText() });
        }
      }),
    );
    this.sendDiff();
  }

  /**
   * goToChange asks the page to go to the next or the previous change of the diff.
   * @param direction - The direction.
   */
  goToChange(direction: 'next' | 'previous'): void {
    this.post({ type: 'diffGo', direction });
  }

  /** forward gives the page a message of the page of the other side of the diff. */
  private forward(message: HostMessage): void {
    this.post(message);
  }

  /** sendDiff gives the page its side in the diff and the text of the other side. */
  private sendDiff(): void {
    if (this.diffSide && this.partner) {
      this.post({ type: 'diff', side: this.diffSide, text: this.partner.document.getText(), editable: this.editable() });
    }
  }

  /**
   * setView switches the page to a view (docs/rendering.md, R-LAYOUT-003).
   * @param view - The view: "edit" or "pages".
   */
  setView(view: PageView): void {
    this.view = view;
    this.post({ type: 'view', view });
    this.showView();
  }

  /** showView sets the context key of the view of the active panel, for the buttons in the title of the editor. */
  private showView(): void {
    if (this.panel.active && (this.registration.showPagesCommand || this.registration.showEditCommand)) {
      void this.api.commands.executeCommand('setContext', `${this.registration.viewType}.pages`, this.view === 'pages');
    }
  }

  /** files returns what the pages of the file need from the extension. */
  private files(): PageFiles {
    return {
      document: this.document.uri.toString(),
      ...(this.top ? { top: slashed(this.top.toString()) } : {}),
      folders: this.folders,
      sources: this.panel.webview.cspSource,
      scripts: this.pagesScripts,
    };
  }

  /**
   * read answers the question of the page for a file of a layout with its bytes, or with nothing for a file outside
   * the folders from which the page may load files and for a file that cannot be read.
   */
  private async read(message: Extract<PageMessage, { type: 'read' }>): Promise<void> {
    let data: Uint8Array | undefined;
    try {
      const uri = this.api.Uri.parse(message.url, true);
      const address = uri.toString();
      if (this.folders.some((folder) => address.startsWith(folder.folder))) {
        data = await this.api.workspace.fs.readFile(uri);
      }
    } catch {
      data = undefined;
    }
    if (!this.disposed) {
      this.panel.webview.postMessage({ type: 'file', id: message.id, ...(data ? { base64: toBase64(data) } : {}) } satisfies HostMessage).then(undefined, () => undefined);
    }
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
    this.connections.forEach((disconnect) => disconnect());
    this.connections.clear();
    this.listeners.clear();
    this.pending.clear();
    this.pendingCount = 0;
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
      case 'view':
        this.view = message.view;
        this.showView();
        break;
      case 'read':
        void this.read(message);
        break;
      case 'plugin':
        this.deliver(message.plugin, message.message);
        break;
      case 'diffLayout':
      case 'diffScroll':
        // The page of the other side of the diff gets the heights of the rows and the scroll place of this page.
        this.partner?.forward(message);
        break;
    }
  }

  /**
   * editable is false when the file system of the file cannot write, for example an older version from Git, and for the
   * older side of a diff.
   */
  private editable(): boolean {
    return this.diffSide !== 'original' && this.writable;
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
    this.post({
      type: 'init',
      text,
      version: this.document.version,
      editable: this.editable(),
      fonts: this.fonts(),
      view: this.view,
      files: this.files(),
      plugins: this.pluginScripts,
    });
    this.sendDiff();
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
