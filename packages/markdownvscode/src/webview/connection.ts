// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The page side of the editor in a webview of VS Code (docs/platforms.md, R-VSC-001, R-VSC-002; docs/source.md,
// R-SRC-001): a TextSource that holds the text of the document of VS Code. The editors of the page work with the
// source; each change of the user goes to the extension, and each change of the document comes into the source with
// the origin `program` and the name `vscode` (src/messages.ts). The page sends one change at a time: a change that the
// user makes while the extension has not yet answered waits, and goes with the next message.
//
// VS Code gives each key of a webview to its own key bindings as well, and Undo and Redo of a custom text editor work
// on the document of VS Code, step by step as the page sent the changes. A key that the page handled, and Undo and Redo
// in a field of text, stay in the page, so that Undo of the editor undoes the steps of the user and a key of the
// editor, for example Ctrl+K for a link, starts no key binding of VS Code.

import { applyPatches, mergeTexts, patchesBetween, TextSource, type Origin, type TextPatch } from '@nimblescape/markdowntext';
import { editorElementId, type HostMessage, type PageFonts, type PageMessage } from '../messages';

/** VsCodeWebviewApi is the part of the API of the webview that the page needs, from `acquireVsCodeApi()`. */
export interface VsCodeWebviewApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeWebviewApi;

/** vscodeOrigin is the origin of a change of the document of VS Code: VS Code does not say who made it. */
export const vscodeOrigin: Origin = Object.freeze({ kind: 'program', name: 'vscode' });

/** VsCodePluginChannel carries the messages of a plugin of the editor between the page and the extension. */
export interface VsCodePluginChannel {
  /** post sends a message to the part of the plugin in the extension. */
  post(message: unknown): void;
  /** onMessage calls a listener with each message of the part of the plugin in the extension, and returns a function that stops it. */
  onMessage(listener: (message: unknown) => void): () => void;
}

/**
 * VsCodePluginHost is the API of the platform VS Code for the plugins of the editor, the option `host` of the
 * MarkdownEditor of @nimblescape/markdowneditor (docs/plugins.md, R-PLUGIN-001).
 */
export interface VsCodePluginHost {
  readonly platform: 'vscode';
  /** channel returns the channel of a plugin to its part in the extension, which `plugins` of the registration connects. */
  channel(plugin: string): VsCodePluginChannel;
}

/** VsCodeConnection is the connection of the page to the document of VS Code. */
export interface VsCodeConnection {
  /** source holds the text of the document: the editors of the page take it as their source. */
  readonly source: TextSource;
  /** editable is false when the file cannot change, for example an older version from Git. */
  readonly editable: boolean;
  /** element is the element of the page for the editor. */
  readonly element: HTMLElement;
  /** host is the API of the platform for the plugins of the editor. */
  readonly host: VsCodePluginHost;
  /** openText opens the text editor of the file to the side, with the last selection of the page (R-VSC-002). */
  openText(): void;
  /** dispose ends the connection. */
  dispose(): void;
}

/** ConnectOptions configure the connection. */
export interface ConnectOptions {
  /** api is the API of the webview, when the page has it already; `acquireVsCodeApi` gives it only once. */
  readonly api?: VsCodeWebviewApi;
}

/** fontProperties are the variables of the fonts of the Markdown preview, which vscode.css uses (R-THEME-003). */
const fontProperties = {
  fontFamily: '--nsmd-preview-font-family',
  fontSize: '--nsmd-preview-font-size',
  lineHeight: '--nsmd-preview-line-height',
} as const;

/** applyFonts sets the variables of the fonts on the root element of the page. */
function applyFonts(fonts: PageFonts): void {
  const style = document.documentElement.style;
  const values = {
    fontFamily: fonts.fontFamily,
    fontSize: fonts.fontSize === undefined ? undefined : `${fonts.fontSize}px`,
    lineHeight: fonts.lineHeight === undefined ? undefined : String(fonts.lineHeight),
  };
  for (const [key, property] of Object.entries(fontProperties) as [keyof typeof fontProperties, string][]) {
    const value = values[key];
    if (value === undefined) {
      style.removeProperty(property);
    } else {
      style.setProperty(property, value);
    }
  }
}

/** isUndoRedo is true for the keys of Undo and Redo, as the webview of VS Code knows them: Ctrl or Cmd with Z or Y. */
function isUndoRedo(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y');
}

/** inField is true for an event in a field of text, where the field or the editor undoes its own steps. */
function inField(event: Event): boolean {
  const target = event.target;
  return target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !== null;
}

/** keepKey stops a key that the page handled, and Undo and Redo in a field of text, before VS Code gets them. */
function keepKey(event: KeyboardEvent): void {
  if (event.defaultPrevented || (isUndoRedo(event) && inField(event))) {
    event.stopPropagation();
  }
}

/** Known is the last version of the document that the page knows, with its text. */
interface Known {
  readonly version: number;
  readonly text: string;
}

/**
 * connectVsCode connects the page to the document of its webview, and returns the connection once the text of the
 * document is there.
 * @param options - The API of the webview, when the page has it already.
 */
export function connectVsCode(options: ConnectOptions = {}): Promise<VsCodeConnection> {
  const api = options.api ?? acquireVsCodeApi();
  return new Promise((resolve) => new Connection(api, resolve));
}

/** Connection keeps the source of the page and the document of VS Code the same. */
class Connection implements VsCodeConnection {
  private textSource: TextSource | undefined;
  private known: Known = { version: 0, text: '' };
  private inFlight: { readonly id: number; readonly text: string } | undefined;
  private count = 0;
  private resyncing = false;
  private canEdit = true;
  private readonly stop: (() => void)[] = [];
  /** listeners holds the listeners of the messages of the plugins, by the name of the plugin. */
  private readonly listeners = new Map<string, Set<(message: unknown) => void>>();
  readonly host: VsCodePluginHost = {
    platform: 'vscode',
    channel: (plugin) => ({
      post: (message) => this.post({ type: 'plugin', plugin, message }),
      onMessage: (listener) => {
        const listeners = this.listeners.get(plugin) ?? new Set();
        listeners.add(listener);
        this.listeners.set(plugin, listeners);
        return () => listeners.delete(listener);
      },
    }),
  };

  constructor(
    private readonly api: VsCodeWebviewApi,
    private readonly onInit: (connection: VsCodeConnection) => void,
  ) {
    const listener = (event: MessageEvent) => this.received(event.data as HostMessage);
    window.addEventListener('message', listener);
    // VS Code listens for the keys on the window, after the document.
    document.addEventListener('keydown', keepKey);
    this.stop.push(
      () => window.removeEventListener('message', listener),
      () => document.removeEventListener('keydown', keepKey),
    );
    this.post({ type: 'ready' });
  }

  get source(): TextSource {
    if (!this.textSource) {
      throw new Error('The connection has no text yet.');
    }
    return this.textSource;
  }

  get editable(): boolean {
    return this.canEdit;
  }

  get element(): HTMLElement {
    const element = document.getElementById(editorElementId);
    if (!element) {
      throw new Error(`The page has no element ${editorElementId}.`);
    }
    return element;
  }

  openText(): void {
    this.post({ type: 'openText' });
  }

  dispose(): void {
    this.stop.forEach((stop) => stop());
    this.stop.length = 0;
    this.listeners.clear();
  }

  /** received takes a message of the extension. */
  private received(message: HostMessage): void {
    if (typeof message !== 'object' || message === null) {
      return;
    }
    switch (message.type) {
      case 'init':
        this.init(message);
        break;
      case 'text':
        if (this.advance(message) && !this.inFlight) {
          // Without a change in flight, the source has the text that the page knew: it takes the new text.
          this.show(this.known.text);
        }
        break;
      case 'applied':
        if (this.advance(message) && this.inFlight?.id === message.id) {
          // The changes that the user made after the change in flight stay on top of the new text.
          const sent = this.inFlight.text;
          this.inFlight = undefined;
          const local = this.source.text;
          this.show(local === sent ? this.known.text : mergeTexts(sent, local, this.known.text));
          this.flush();
        } else if (!this.inFlight) {
          this.show(this.known.text);
        }
        break;
      case 'fonts':
        applyFonts(message.fonts);
        break;
      case 'plugin':
        [...(this.listeners.get(message.plugin) ?? [])].forEach((listener) => listener(message.message));
        break;
    }
  }

  /** init takes the whole text of the document, when the page starts or starts again. */
  private init(message: Extract<HostMessage, { type: 'init' }>): void {
    this.known = { version: message.version, text: message.text };
    this.inFlight = undefined;
    this.resyncing = false;
    this.canEdit = message.editable;
    applyFonts(message.fonts);
    if (this.textSource) {
      this.show(message.text);
      return;
    }
    const source = new TextSource(message.text);
    this.textSource = source;
    this.stop.push(
      source.onChange((change) => {
        if (change.origin !== vscodeOrigin) {
          this.flush();
        }
      }),
      source.onSelections((_editor, selections) => {
        if (selections[0]) {
          this.post({ type: 'selection', selection: selections[0] });
        }
      }),
    );
    this.onInit(this);
  }

  /**
   * advance takes the patches of a message into the version that the page knows. A message that does not start at
   * this version makes the page start again from the document.
   * @returns true when the page knows the version of the message.
   */
  private advance(message: { readonly from: number; readonly version: number; readonly patches: readonly TextPatch[] }): boolean {
    if (!this.textSource || this.resyncing) {
      return false;
    }
    let text: string | undefined;
    try {
      text = message.from === this.known.version ? applyPatches(this.known.text, message.patches) : undefined;
    } catch {
      text = undefined;
    }
    if (text === undefined) {
      this.resyncing = true;
      this.post({ type: 'ready' });
      return false;
    }
    this.known = { version: message.version, text };
    return true;
  }

  /** show gives the source a text of the document. */
  private show(text: string): void {
    this.textSource?.setText(text, vscodeOrigin);
  }

  /** flush sends the changes of the user, when no change is in flight. */
  private flush(): void {
    const source = this.textSource;
    if (!source || this.inFlight || this.resyncing || !this.canEdit) {
      return;
    }
    const text = source.text;
    if (text === this.known.text) {
      return;
    }
    const id = ++this.count;
    this.inFlight = { id, text };
    this.post({ type: 'edit', id, base: this.known.version, patches: patchesBetween(this.known.text, text) });
  }

  /** post sends a message to the extension. */
  private post(message: PageMessage): void {
    this.api.postMessage(message);
  }
}
