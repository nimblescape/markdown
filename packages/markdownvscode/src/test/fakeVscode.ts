// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// A small API of VS Code for the tests of the adapter: URIs, ranges, text documents, workspace edits, the files, the
// custom editors, the commands and the settings, and a webview panel whose messages wait in queues, so that a test decides
// when each side gets them. The page side of a test runs in the window of happy-dom.

import type * as vscode from 'vscode';
import type { VsCode } from '../extension/editor';

/** Emitter is an event of the fake API. */
class Emitter<T> {
  private readonly listeners = new Set<(value: T) => void>();
  readonly event = (listener: (value: T) => void) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(value: T): void {
    [...this.listeners].forEach((listener) => listener(value));
  }
}

/** FakeUri is a URI with a scheme and a path. */
export class FakeUri {
  constructor(
    readonly scheme: string,
    readonly path: string,
  ) {}
  static file(path: string): FakeUri {
    return new FakeUri('file', path);
  }
  static parse(value: string): FakeUri {
    const found = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/.exec(value);
    if (!found) {
      throw new Error(`No URI: ${value}`);
    }
    return new FakeUri(found[1], found[2]);
  }
  static joinPath(base: FakeUri, ...parts: string[]): FakeUri {
    const segments = base.path.split('/');
    for (const part of parts.flatMap((part) => part.split('/'))) {
      if (part === '..') {
        segments.pop();
      } else if (part !== '.' && part !== '') {
        segments.push(part);
      }
    }
    return new FakeUri(base.scheme, segments.join('/') || '/');
  }
  toString(): string {
    return `${this.scheme}://${this.path}`;
  }
}

/** FakePosition is a line and a character. */
export class FakePosition {
  constructor(
    readonly line: number,
    readonly character: number,
  ) {}
}

/** FakeRange is a range between two positions, in their order. */
export class FakeRange {
  readonly start: FakePosition;
  readonly end: FakePosition;
  constructor(a: FakePosition, b: FakePosition) {
    const first = a.line < b.line || (a.line === b.line && a.character <= b.character);
    this.start = first ? a : b;
    this.end = first ? b : a;
  }
}

/** FakeWorkspaceEdit holds the replacements of an edit. */
export class FakeWorkspaceEdit {
  readonly replacements: { uri: FakeUri; range: FakeRange; text: string }[] = [];
  replace(uri: FakeUri, range: FakeRange, text: string): void {
    this.replacements.push({ uri, range, text });
  }
}

/** FakeDocument is a text document. */
export class FakeDocument {
  version = 1;
  readonly isUntitled: boolean;
  constructor(
    readonly uri: FakeUri,
    public text: string,
  ) {
    this.isUntitled = uri.scheme === 'untitled';
  }
  getText(): string {
    return this.text;
  }
  positionAt(offset: number): FakePosition {
    const before = this.text.slice(0, Math.max(0, Math.min(offset, this.text.length)));
    const lines = before.split('\n');
    return new FakePosition(lines.length - 1, lines[lines.length - 1].length);
  }
  offsetAt(position: FakePosition): number {
    const lines = this.text.split('\n');
    let offset = 0;
    for (let line = 0; line < position.line && line < lines.length; line++) {
      offset += lines[line].length + 1;
    }
    return Math.min(offset + position.character, this.text.length);
  }
}

/** FakePanel is a webview panel whose messages wait in queues. */
export class FakePanel {
  viewColumn = 1;
  active = true;
  visible = true;
  disposed = false;
  /** toPage holds the messages of the extension that the page did not get yet. */
  readonly toPage: unknown[] = [];
  /** toHost holds the messages of the page that the extension did not get yet. */
  readonly toHost: unknown[] = [];
  private readonly received = new Emitter<unknown>();
  private readonly disposeEmitter = new Emitter<void>();
  private readonly viewState = new Emitter<{ webviewPanel: FakePanel }>();
  readonly webview = {
    options: {} as { enableScripts?: boolean; localResourceRoots?: FakeUri[] },
    html: '',
    cspSource: 'https://webview.test',
    asWebviewUri: (uri: FakeUri) => new FakeUri('https', `webview.test${uri.path}`),
    // A hidden panel cannot get messages in this fake, as a panel without retainContextWhenHidden.
    postMessage: (message: unknown) => {
      if (!this.visible || this.disposed) {
        return Promise.resolve(false);
      }
      this.toPage.push(structuredClone(message));
      return Promise.resolve(true);
    },
    onDidReceiveMessage: this.received.event,
  };
  readonly onDidDispose = this.disposeEmitter.event;
  readonly onDidChangeViewState = this.viewState.event;
  /** pageApi is the API of the webview for the page. */
  readonly pageApi = { postMessage: (message: unknown) => this.toHost.push(structuredClone(message)) };

  dispose(): void {
    if (!this.disposed) {
      this.disposed = true;
      this.disposeEmitter.fire();
    }
  }
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.viewState.fire({ webviewPanel: this });
  }
  /** deliverToHost gives the extension the next message of the page. */
  deliverToHost(): boolean {
    const message = this.toHost.shift();
    if (message === undefined) {
      return false;
    }
    this.received.fire(message);
    return true;
  }
  /** deliverToPage gives the page the next message of the extension. */
  deliverToPage(): boolean {
    const message = this.toPage.shift();
    if (message === undefined) {
      return false;
    }
    window.dispatchEvent(new MessageEvent('message', { data: message }));
    return true;
  }
  /** settle gives both sides their messages until no message waits. */
  async settle(): Promise<void> {
    for (let round = 0; round < 1000; round++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const moved = this.deliverToHost() || this.deliverToPage();
      if (!moved && this.toHost.length === 0 && this.toPage.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (this.toHost.length === 0 && this.toPage.length === 0) {
          return;
        }
      }
    }
    throw new Error('The messages do not settle.');
  }
}

/** FakeVsCode is the fake API with the parts that a test reads. */
export interface FakeVsCode {
  /** api is the API for the code of the adapter. */
  readonly api: VsCode;
  /** provider is the registered provider of the custom editor. */
  provider(): { viewType: string; provider: vscode.CustomTextEditorProvider; options: unknown } | undefined;
  /** commands are the registered commands. */
  readonly commands: Map<string, (...args: unknown[]) => unknown>;
  /** executed are the commands that the adapter ran, with their arguments. */
  readonly executed: unknown[][];
  /** settings are the values of the settings, by section and key. */
  readonly settings: Record<string, unknown>;
  /** writable is false for a scheme whose file system cannot write. */
  readonly writable: Map<string, boolean>;
  /** files are the files of the file system, by their URIs. */
  readonly files: Map<string, Uint8Array>;
  /** applyResult is the result of the next workspace edits. */
  applyResult: boolean;
  /** open returns a new document. */
  open(text: string, uri?: FakeUri): FakeDocument;
  /** change changes a document from outside, as the text editor or Git. */
  change(document: FakeDocument, text: string): void;
  /** changeSettings tells the adapter that settings of a section changed. */
  changeSettings(section: string): void;
}

/** fakeVsCode returns a new fake API. */
export function fakeVsCode(): FakeVsCode {
  const documents = new Map<string, FakeDocument>();
  const changes = new Emitter<{ document: FakeDocument; contentChanges: unknown[] }>();
  const configuration = new Emitter<{ affectsConfiguration(section: string): boolean }>();
  const commands = new Map<string, (...args: unknown[]) => unknown>();
  const executed: unknown[][] = [];
  const settings: Record<string, unknown> = {};
  const writable = new Map<string, boolean>();
  const files = new Map<string, Uint8Array>();
  let registered: ReturnType<FakeVsCode['provider']>;
  const fake: FakeVsCode = {
    api: undefined as unknown as VsCode,
    provider: () => registered,
    commands,
    executed,
    settings,
    writable,
    files,
    applyResult: true,
    open(text, uri = FakeUri.file('/work/docs/file.md')) {
      const document = new FakeDocument(uri, text);
      documents.set(uri.toString(), document);
      return document;
    },
    change(document, text) {
      document.text = text;
      document.version++;
      changes.fire({ document, contentChanges: [] });
    },
    changeSettings(section) {
      configuration.fire({ affectsConfiguration: (affected) => affected === section || affected.startsWith(`${section}.`) || section.startsWith(`${affected}.`) });
    },
  };
  const api = {
    Uri: FakeUri,
    Range: FakeRange,
    Position: FakePosition,
    WorkspaceEdit: FakeWorkspaceEdit,
    ViewColumn: { Active: -1, Beside: -2, One: 1, Two: 2 },
    env: { language: 'de' },
    window: {
      registerCustomEditorProvider: (viewType: string, provider: vscode.CustomTextEditorProvider, options: unknown) => {
        registered = { viewType, provider, options };
        return { dispose: () => (registered = undefined) };
      },
    },
    commands: {
      registerCommand: (id: string, run: (...args: unknown[]) => unknown) => {
        commands.set(id, run);
        return { dispose: () => commands.delete(id) };
      },
      executeCommand: (...args: unknown[]) => {
        executed.push(args);
        return Promise.resolve();
      },
    },
    workspace: {
      onDidChangeTextDocument: changes.event,
      onDidChangeConfiguration: configuration.event,
      getConfiguration: (section: string) => ({ get: (key: string) => settings[`${section}.${key}`] }),
      getWorkspaceFolder: (uri: FakeUri) => (uri.path.startsWith('/work/') ? { uri: FakeUri.file('/work') } : undefined),
      fs: {
        isWritableFileSystem: (scheme: string) => writable.get(scheme),
        readFile: (uri: FakeUri) => {
          const data = files.get(uri.toString());
          return data ? Promise.resolve(data) : Promise.reject(new Error(`No file ${uri.toString()}`));
        },
      },
      applyEdit: (edit: FakeWorkspaceEdit) => {
        if (!fake.applyResult) {
          return Promise.resolve(false);
        }
        const byDocument = new Map<FakeDocument, { from: number; to: number; text: string }[]>();
        for (const { uri, range, text } of edit.replacements) {
          const document = documents.get(uri.toString());
          if (document) {
            const list = byDocument.get(document) ?? [];
            list.push({ from: document.offsetAt(range.start), to: document.offsetAt(range.end), text });
            byDocument.set(document, list);
          }
        }
        for (const [document, list] of byDocument) {
          let text = document.text;
          for (const replacement of [...list].sort((a, b) => b.from - a.from)) {
            text = text.slice(0, replacement.from) + replacement.text + text.slice(replacement.to);
          }
          fake.change(document, text);
        }
        return Promise.resolve(true);
      },
    },
  };
  (fake as { api: VsCode }).api = api as unknown as VsCode;
  return fake;
}

/**
 * openPanel opens a document in the registered editor and returns its panel.
 * @param fake - The fake API.
 * @param document - The document.
 */
export async function openPanel(fake: FakeVsCode, document: FakeDocument): Promise<FakePanel> {
  const panel = new FakePanel();
  const registered = fake.provider();
  if (!registered) {
    throw new Error('No editor is registered.');
  }
  await registered.provider.resolveCustomTextEditor(
    document as unknown as vscode.TextDocument,
    panel as unknown as vscode.WebviewPanel,
    {} as vscode.CancellationToken,
  );
  return panel;
}
