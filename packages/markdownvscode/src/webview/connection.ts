// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The page side of the editor in a webview of VS Code (docs/platforms.md, R-VSC-001, R-VSC-002; docs/source.md,
// R-SRC-001): a TextSource that holds the text of the document of VS Code. The editors of the page work with the
// source; each change of the user goes to the extension, and each change of the document comes into the source with
// the origin `program` and the name `vscode` (src/messages.ts). The page sends one change at a time: a change that the
// user makes while the extension has not yet answered waits, and goes with the next message.
//
// The page shows the editor ("Edit") or the frame of the pages ("Pages", docs/rendering.md, R-LAYOUT-003): the
// connection shows one of the two elements and tells the script of the page each switch. For the pages, the connection
// gives the host of the layout part: it reads the files of the layouts through the extension, and maps the URI of a
// file to its address in the webview.
//
// In a diff of VS Code, the page is one side (docs/platforms.md, R-VSC-009): the connection gives the side, the text of
// the other side with each new text, and carries the heights of the rows and the scroll place between the two pages;
// `followDiff` connects them with the rendered changes of the editor. The older side cannot change.
//
// VS Code gives each key of a webview to its own key bindings as well, and Undo and Redo of a custom text editor work
// on the document of VS Code, step by step as the page sent the changes. A key that the page handled, and Undo and Redo
// in a field of text, stay in the page, so that Undo of the editor undoes the steps of the user and a key of the
// editor, for example Ctrl+K for a link, starts no key binding of VS Code.

import { applyPatches, mergeTexts, patchesBetween, TextSource, type Origin, type TextPatch } from '@nimblescape/markdowntext';
import {
  type DiffLayout,
  type DiffPosition,
  type DiffSide,
  editorElementId,
  fromBase64,
  type HostMessage,
  type PageFiles,
  type PageFonts,
  type PageMessage,
  pagesElementId,
  type PageView,
} from '../messages';

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

/**
 * VsCodePagesHost is the host of the pages of the file for the layout part, the `Host` of @nimblescape/markdownlayout
 * (docs/rendering.md, R-LAYOUT-003), with the URI of the file.
 */
export interface VsCodePagesHost {
  /** document is the URI of the file. */
  readonly document: string;
  /** reader reads the files of the layouts through the extension. */
  readonly reader: { read(url: string): Promise<Uint8Array | undefined> };
  /** top is the URI of the top folder of the search for a layout. */
  readonly top?: string;
  /** resource maps the URI of a file to its address in the webview. */
  resource(url: string): string;
  /** sources is the source of the webview for the policy of the page. */
  readonly sources: string;
  /** scripts are the scripts of the pages, Paged.js last. */
  readonly scripts: { readonly src: string }[];
  /** nonce is the nonce of the scripts of the page of the webview, which the page in the frame must use as well. */
  readonly nonce: string;
  /**
   * embed are the addresses of the folders in the webview: the webview gives its files only to its own page, so the
   * view of the pages loads them for the page in the frame (`embed` of showPages).
   */
  readonly embed: readonly string[];
}

/** VsCodeDiff is the side of the page in a diff of VS Code (docs/platforms.md, R-VSC-009). */
export interface VsCodeDiff {
  /** side is `original` for the older version, on the left, and `modified` for the newer version, on the right. */
  readonly side: DiffSide;
  /** text is the last text of the other side. */
  readonly text: string;
  /** layout is the last layout of the rows of the other side, or undefined before the first one. */
  readonly layout: DiffLayout | undefined;
  /** onText calls a listener with each new text of the other side, and returns a function that stops it. */
  onText(listener: (text: string) => void): () => void;
  /** postLayout gives the other side the natural heights of the rows of this side. */
  postLayout(layout: DiffLayout): void;
  /** onLayout calls a listener with each layout of the rows of the other side, and returns a function that stops it. */
  onLayout(listener: (layout: DiffLayout) => void): () => void;
  /** postScroll gives the other side the place at the top of the view of this side. */
  postScroll(position: DiffPosition): void;
  /** onScroll calls a listener with each scroll place of the other side, and returns a function that stops it. */
  onScroll(listener: (position: DiffPosition) => void): () => void;
  /** onGo calls a listener when the user goes to the next or the previous change, and returns a function that stops it. */
  onGo(listener: (direction: 'next' | 'previous') => void): () => void;
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
  /** view is the view that the page shows: the editor ("edit") or the pages ("pages"). */
  readonly view: PageView;
  /** pagesFrame is the frame of the page for the pages. */
  readonly pagesFrame: HTMLIFrameElement;
  /** pages is the host of the pages for the layout part. */
  readonly pages: VsCodePagesHost;
  /**
   * pluginScripts are the addresses of the scripts of the plugins of the editor that other extensions contribute
   * (docs/plugins.md, R-PLUGIN-002), when the registration of the editor asks for them: the page loads them with
   * `loadPlugins(connection.pluginScripts, { nonce: connection.nonce })` of @nimblescape/markdowneditor, and gives
   * the plugins to its editor.
   */
  readonly pluginScripts: readonly string[];
  /** nonce is the nonce of the scripts of the page, which the policy of its content asks for. */
  readonly nonce: string;
  /** diff is the side of the page in a diff of VS Code, or undefined while the page is no side of a diff. */
  readonly diff: VsCodeDiff | undefined;
  /** onDiff calls a listener when the page becomes a side of a diff, and returns a function that stops it. */
  onDiff(listener: (diff: VsCodeDiff) => void): () => void;
  /** onView calls a listener after each switch of the view, and returns a function that stops it. */
  onView(listener: (view: PageView) => void): () => void;
  /** setView switches the view of the page, for example to "edit" after a double click on a page. */
  setView(view: PageView): void;
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

/**
 * DiffChanges is what followDiff needs from the rendered changes of the editor, the EditorChanges of
 * @nimblescape/markdowneditor.
 */
export interface DiffChanges {
  setOther(text: string): void;
  setOtherLayout(layout: DiffLayout): void;
  scrollTo(position: DiffPosition): void;
  next(): boolean;
  previous(): boolean;
}

/** DiffEditor is what followDiff needs from the editor of the page, the MarkdownEditor of @nimblescape/markdowneditor. */
export interface DiffEditor {
  showChanges(options: {
    readonly side: DiffSide;
    readonly other: string;
    readonly onLayout?: (layout: DiffLayout) => void;
    readonly onScroll?: (position: DiffPosition) => void;
  }): DiffChanges;
  setEditable(editable: boolean): void;
  setReadOnlyToggle?(shown: boolean): void;
}

/**
 * followDiff shows the rendered changes in the editor of the page while the page is a side of a diff
 * (docs/platforms.md, R-VSC-009): the marks against the text of the other side, the rows that line up with the other
 * side, the scroll together, and the next and the previous change. The older side is read-only, without the switch to
 * editing.
 * @param connection - The connection of the page.
 * @param editor - The editor of the page.
 * @returns A function that stops it.
 */
export function followDiff(connection: VsCodeConnection, editor: DiffEditor): () => void {
  const stops: (() => void)[] = [];
  const show = (diff: VsCodeDiff) => {
    stops.splice(0).forEach((stop) => stop());
    if (diff.side === 'original' || !connection.editable) {
      editor.setEditable(false);
      editor.setReadOnlyToggle?.(false);
    }
    const changes = editor.showChanges({
      side: diff.side,
      other: diff.text,
      onLayout: (layout) => diff.postLayout(layout),
      onScroll: (position) => diff.postScroll(position),
    });
    if (diff.layout) {
      changes.setOtherLayout(diff.layout);
    }
    stops.push(
      diff.onText((text) => changes.setOther(text)),
      diff.onLayout((layout) => changes.setOtherLayout(layout)),
      diff.onScroll((position) => changes.scrollTo(position)),
      diff.onGo((direction) => (direction === 'next' ? changes.next() : changes.previous())),
    );
  };
  const stop = connection.onDiff(show);
  if (connection.diff) {
    show(connection.diff);
  }
  return () => {
    stop();
    stops.splice(0).forEach((each) => each());
  };
}

/** listen adds a listener to a set, and returns a function that removes it. */
function listen<T>(listeners: Set<(value: T) => void>, listener: (value: T) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** call calls the listeners of a set with a value. */
function call<T>(listeners: Set<(value: T) => void>, value: T): void {
  [...listeners].forEach((listener) => listener(value));
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
  private shownView: PageView = 'edit';
  private files: PageFiles | undefined;
  private scripts: readonly string[] = [];
  private reads = 0;
  /** waiting holds the reads of files that wait for the answer of the extension, by their IDs. */
  private readonly waiting = new Map<number, (data: Uint8Array | undefined) => void>();
  private readonly viewListeners = new Set<(view: PageView) => void>();
  /** diffState is the side of the page in a diff, with the last text and layout of the other side. */
  private diffState: { side: DiffSide; text: string; layout: DiffLayout | undefined } | undefined;
  private diffApi: VsCodeDiff | undefined;
  private readonly diffListeners = new Set<(diff: VsCodeDiff) => void>();
  private readonly diffTextListeners = new Set<(text: string) => void>();
  private readonly diffLayoutListeners = new Set<(layout: DiffLayout) => void>();
  private readonly diffScrollListeners = new Set<(position: DiffPosition) => void>();
  private readonly diffGoListeners = new Set<(direction: 'next' | 'previous') => void>();
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

  get view(): PageView {
    return this.shownView;
  }

  get pagesFrame(): HTMLIFrameElement {
    const element = document.getElementById(pagesElementId);
    if (!(element instanceof HTMLIFrameElement)) {
      throw new Error(`The page has no frame ${pagesElementId}.`);
    }
    return element;
  }

  get pages(): VsCodePagesHost {
    const files = this.files;
    if (!files) {
      throw new Error('The connection has no files yet.');
    }
    // A URI and the folders compare in the form of the URL of the browser, which the layout part writes.
    const normal = (address: string) => {
      try {
        return new URL(address).href;
      } catch {
        return address;
      }
    };
    const folders = files.folders.map((folder) => ({ folder: normal(folder.folder), webview: normal(folder.webview) }));
    return {
      document: normal(files.document),
      reader: { read: (url) => this.read(url) },
      ...(files.top ? { top: normal(files.top) } : {}),
      resource: (url) => {
        const address = normal(url);
        const folder = folders.find((each) => address.startsWith(each.folder));
        return folder ? folder.webview + address.slice(folder.folder.length) : url;
      },
      sources: files.sources,
      scripts: files.scripts.map((src) => ({ src: normal(src) })),
      nonce: this.nonce,
      embed: folders.map((folder) => folder.webview),
    };
  }

  get pluginScripts(): readonly string[] {
    return this.scripts;
  }

  get nonce(): string {
    // The browser hides the attribute of the nonce after the script ran, and keeps it in the property.
    const script = document.querySelector<HTMLScriptElement>('script[nonce]');
    return script?.nonce || script?.getAttribute('nonce') || '';
  }

  get diff(): VsCodeDiff | undefined {
    return this.diffApi;
  }

  onDiff(listener: (diff: VsCodeDiff) => void): () => void {
    return listen(this.diffListeners, listener);
  }

  onView(listener: (view: PageView) => void): () => void {
    return listen(this.viewListeners, listener);
  }

  setView(view: PageView): void {
    if (view !== this.shownView) {
      this.showView(view);
      this.post({ type: 'view', view });
    }
  }

  openText(): void {
    this.post({ type: 'openText' });
  }

  dispose(): void {
    this.stop.forEach((stop) => stop());
    this.stop.length = 0;
    this.listeners.clear();
    this.viewListeners.clear();
    for (const listeners of [this.diffListeners, this.diffTextListeners, this.diffLayoutListeners, this.diffScrollListeners, this.diffGoListeners]) {
      listeners.clear();
    }
    this.waiting.forEach((resolve) => resolve(undefined));
    this.waiting.clear();
  }

  /** read asks the extension for the bytes of a file. */
  private read(url: string): Promise<Uint8Array | undefined> {
    const id = ++this.reads;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.post({ type: 'read', id, url });
    });
  }

  /** showView shows the element of a view and tells the listeners. */
  private showView(view: PageView): void {
    this.shownView = view;
    const editor = document.getElementById(editorElementId);
    const pages = document.getElementById(pagesElementId);
    if (editor) {
      editor.hidden = view !== 'edit';
    }
    if (pages) {
      pages.hidden = view !== 'pages';
    }
    [...this.viewListeners].forEach((listener) => listener(view));
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
      case 'view':
        if (message.view !== this.shownView) {
          this.showView(message.view);
        }
        break;
      case 'file': {
        const resolve = this.waiting.get(message.id);
        this.waiting.delete(message.id);
        resolve?.(typeof message.base64 === 'string' ? fromBase64(message.base64) : undefined);
        break;
      }
      case 'plugin':
        [...(this.listeners.get(message.plugin) ?? [])].forEach((listener) => listener(message.message));
        break;
      case 'diff':
        this.takeDiff(message);
        break;
      case 'diffText':
        if (this.diffState && typeof message.text === 'string') {
          this.diffState.text = message.text;
          call(this.diffTextListeners, message.text);
        }
        break;
      case 'diffLayout':
        if (this.diffState) {
          const layout: DiffLayout = { rows: message.rows, heights: message.heights, start: message.start };
          this.diffState.layout = layout;
          call(this.diffLayoutListeners, layout);
        }
        break;
      case 'diffScroll':
        call(this.diffScrollListeners, { row: message.row, offset: message.offset });
        break;
      case 'diffGo':
        call(this.diffGoListeners, message.direction);
        break;
    }
  }

  /**
   * takeDiff makes the page a side of a diff, or takes the text of the other side again, for example after the page
   * started again. The page tells the listeners once the editor can exist, after the text of the document.
   */
  private takeDiff(message: Extract<HostMessage, { type: 'diff' }>): void {
    this.canEdit = message.editable;
    if (this.diffState && this.diffState.side === message.side) {
      if (this.diffState.text !== message.text) {
        this.diffState.text = message.text;
        call(this.diffTextListeners, message.text);
      }
      return;
    }
    this.diffState = { side: message.side, text: message.text, layout: undefined };
    const state = this.diffState;
    this.diffApi = {
      side: state.side,
      get text() {
        return state.text;
      },
      get layout() {
        return state.layout;
      },
      onText: (listener) => listen(this.diffTextListeners, listener),
      postLayout: (layout) => this.post({ type: 'diffLayout', rows: layout.rows, heights: [...layout.heights], start: layout.start }),
      onLayout: (listener) => listen(this.diffLayoutListeners, listener),
      postScroll: (position) => this.post({ type: 'diffScroll', row: position.row, offset: position.offset }),
      onScroll: (listener) => listen(this.diffScrollListeners, listener),
      onGo: (listener) => listen(this.diffGoListeners, listener),
    };
    if (this.textSource) {
      call(this.diffListeners, this.diffApi);
    }
  }

  /** init takes the whole text of the document, when the page starts or starts again. */
  private init(message: Extract<HostMessage, { type: 'init' }>): void {
    this.known = { version: message.version, text: message.text };
    this.inFlight = undefined;
    this.resyncing = false;
    this.canEdit = message.editable;
    this.files = message.files;
    applyFonts(message.fonts);
    if (message.view !== this.shownView) {
      this.showView(message.view);
    }
    if (this.textSource) {
      this.show(message.text);
      return;
    }
    // The page loads the scripts of the plugins once, before it creates the editor.
    this.scripts = Array.isArray(message.plugins) ? message.plugins.filter((script): script is string => typeof script === 'string') : [];
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
