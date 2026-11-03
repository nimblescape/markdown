// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the adapter for VS Code (docs/platforms.md, R-GEN-004, R-VSC-001 to R-VSC-009, R-THEME-003): the custom
// text editor with its page, the text and the changes between the page and the document, also when both change at the
// same time, the read-only mode, the fonts, the text editor to the side, a MarkdownEditor in the page, and the rendered
// changes in a diff.

import { MarkdownEditor } from '@nimblescape/markdowneditor';
import type { TextChange } from '@nimblescape/markdowntext';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerMarkdownEditor, type MarkdownEditorHandle, type MarkdownEditorRegistration, type PluginPanelChannel } from './extension/editor';
import { editorElementId, pageMessage, pagesElementId } from './messages';
import { FakeRange, FakeUri, fakeVsCode, openPanel, type FakeDocument, type FakePanel, type FakeVsCode } from './test/fakeVscode';
import { connectVsCode, followDiff, vscodeOrigin, type VsCodeConnection } from './webview/connection';

const text = '# Title\n\nFirst paragraph.\n\nSecond paragraph.\n';
const viewType = 'nimblescape.test.editor';

let fake: FakeVsCode;
let stop: MarkdownEditorHandle | undefined;
const connections: VsCodeConnection[] = [];

beforeEach(() => {
  fake = fakeVsCode();
  document.documentElement.removeAttribute('style');
  document.body.innerHTML = `<div id="${editorElementId}"></div><iframe id="${pagesElementId}" srcdoc="" hidden></iframe><script nonce="abc"></script>`;
});

afterEach(() => {
  connections.forEach((connection) => connection.dispose());
  connections.length = 0;
  stop?.dispose();
  stop = undefined;
});

/** register registers the editor with the scripts of a test extension. */
function register(options: Partial<MarkdownEditorRegistration> = {}): void {
  stop = registerMarkdownEditor(fake.api, {
    viewType,
    script: FakeUri.file('/extension/dist/webview.js') as never,
    styles: [FakeUri.file('/extension/dist/markdown.css') as never, FakeUri.file('/extension/dist/vscode.css') as never],
    openTextCommand: 'test.openText',
    ...options,
  });
}

/** start opens a document in the editor and connects the page. */
async function start(content = text, options: Partial<MarkdownEditorRegistration> = {}): Promise<{ document: FakeDocument; panel: FakePanel; connection: VsCodeConnection }> {
  register(options);
  const document = fake.open(content);
  const panel = await openPanel(fake, document);
  const connecting = connectVsCode({ api: panel.pageApi });
  await panel.settle();
  const connection = await connecting;
  connections.push(connection);
  return { document, panel, connection };
}

/** insert inserts a text in the source of the page after the first match of a text, as an editor of the user does. */
function insert(connection: VsCodeConnection, after: string, words: string): void {
  const at = connection.source.text.indexOf(after) + after.length;
  connection.source.apply([{ from: at, to: at, insert: words }], { kind: 'user', editor: 'page' });
}

describe('the custom text editor', () => {
  it('registers the editor of the view type, which keeps its page in the background, and the command of the text editor', () => {
    register();
    expect(fake.provider()?.viewType).toBe(viewType);
    expect(fake.provider()?.options).toEqual({ webviewOptions: { retainContextWhenHidden: true } });
    expect(fake.commands.has('test.openText')).toBe(true);
    stop?.dispose();
    stop = undefined;
    expect(fake.provider()).toBeUndefined();
    expect(fake.commands.has('test.openText')).toBe(false);
  });

  it('writes a page that allows only the script with its nonce, and loads the styles and the images of the folder', async () => {
    register();
    const panel = await openPanel(fake, fake.open(text));
    const html = panel.webview.html;
    const nonce = /script-src &#39;nonce-([0-9a-f]{32})&#39;/.exec(html)?.[1];
    expect(nonce).toBeDefined();
    expect(html).toContain(`<script nonce="${nonce}" src="https://webview.test/extension/dist/webview.js"></script>`);
    expect(html).toContain('default-src &#39;none&#39;');
    expect(html.indexOf('markdown.css')).toBeLessThan(html.indexOf('vscode.css'));
    expect(html).toContain('<base href="https://webview.test/work/docs/">');
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('<title>file.md</title>');
    expect(html).toContain(`<div id="${editorElementId}"></div>`);
    expect(html).toContain(`<iframe id="${pagesElementId}" title="Pages" hidden></iframe>`);
    expect(html).toContain('font-src https://webview.test data: blob:');
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(panel.webview.options.enableScripts).toBe(true);
    expect(panel.webview.options.localResourceRoots?.map(String)).toEqual(['file:///extension/dist', 'file:///extension/dist', 'file:///extension/dist', 'file:///work']);
  });

  it('shows the text editor in place of the editor for a document that the extension does not open', async () => {
    register({ opens: (document) => !document.uri.path.endsWith('plain.md') });
    const document = fake.open(text, FakeUri.file('/work/plain.md'));
    const panel = await openPanel(fake, document);
    expect(panel.disposed).toBe(true);
    expect(fake.executed).toEqual([['vscode.openWith', document.uri, 'default', 1]]);
    expect(panel.webview.html).toBe('');
  });
});

describe('the text between the page and the document', () => {
  it('gives the page the text of the document, whether it can change and the fonts of the Markdown preview', async () => {
    fake.settings['markdown.preview.fontFamily'] = "'Segoe UI', sans-serif";
    fake.settings['markdown.preview.fontSize'] = 15;
    fake.settings['markdown.preview.lineHeight'] = 1.5;
    const { connection } = await start();
    expect(connection.source.text).toBe(text);
    expect(connection.editable).toBe(true);
    expect(connection.element.id).toBe(editorElementId);
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--nsmd-preview-font-family')).toBe("'Segoe UI', sans-serif");
    expect(style.getPropertyValue('--nsmd-preview-font-size')).toBe('15px');
    expect(style.getPropertyValue('--nsmd-preview-line-height')).toBe('1.5');
  });

  it('makes each change of the user in the page a change of the document', async () => {
    const { document, panel, connection } = await start();
    insert(connection, 'First', ' new');
    expect(panel.toHost).toEqual([{ type: 'edit', id: 1, base: 1, patches: [{ from: 14, to: 14, insert: ' new' }] }]);
    await panel.settle();
    expect(document.text).toBe(text.replace('First', 'First new'));
    expect(document.version).toBe(2);
    expect(connection.source.text).toBe(document.text);
  });

  it('takes each change of the document from outside with the origin vscode', async () => {
    const { document, panel, connection } = await start();
    const changes: TextChange[] = [];
    connection.source.onChange((change) => changes.push(change));
    fake.change(document, text.replace('Second', 'Last'));
    expect(panel.toPage).toEqual([{ type: 'text', from: 1, version: 2, patches: [{ from: 27, to: 33, insert: 'Last' }] }]);
    await panel.settle();
    expect(connection.source.text).toBe(document.text);
    expect(changes.map((change) => change.origin)).toEqual([vscodeOrigin]);
    // The change from the document goes not back to the document.
    expect(panel.toHost).toEqual([]);
    expect(document.version).toBe(2);
  });

  it('merges a change of the user with a change of the document at the same time', async () => {
    const { document, panel, connection } = await start();
    // The user types in the page while the text editor to the side changes the document.
    insert(connection, 'First', ' new');
    fake.change(document, text.replace('Second', 'Last'));
    await panel.settle();
    expect(document.text).toBe('# Title\n\nFirst new paragraph.\n\nLast paragraph.\n');
    expect(connection.source.text).toBe(document.text);
  });

  it('sends the changes of the user one at a time and keeps the later ones on top of the answer', async () => {
    const { document, panel, connection } = await start();
    insert(connection, 'First', ' 1');
    insert(connection, 'First 1', ' 2');
    insert(connection, 'Second', ' 3');
    expect(panel.toHost).toHaveLength(1);
    // A change of the document comes before the answer.
    fake.change(document, document.text.replace('# Title', '# The title'));
    await panel.settle();
    expect(document.text).toBe('# The title\n\nFirst 1 2 paragraph.\n\nSecond 3 paragraph.\n');
    expect(connection.source.text).toBe(document.text);
    // The user types while the answer is on its way.
    insert(connection, 'paragraph', '!');
    panel.deliverToHost();
    await new Promise((resolve) => setTimeout(resolve, 0));
    insert(connection, 'paragraph!', '?');
    await panel.settle();
    expect(document.text).toBe('# The title\n\nFirst 1 2 paragraph!?.\n\nSecond 3 paragraph.\n');
    expect(connection.source.text).toBe(document.text);
  });

  it('goes back to the text of the document when VS Code does not take a change', async () => {
    const { document, panel, connection } = await start();
    fake.applyResult = false;
    insert(connection, 'First', ' lost');
    await panel.settle();
    expect(document.text).toBe(text);
    expect(connection.source.text).toBe(text);
  });

  it('is read-only for a file system that cannot write, for example an older version from Git', async () => {
    fake.writable.set('file', false);
    const { document, panel, connection } = await start();
    expect(connection.editable).toBe(false);
    insert(connection, 'First', ' not sent');
    expect(panel.toHost).toEqual([]);
    expect(document.text).toBe(text);
  });

  it('starts again from the document when the page missed a message', async () => {
    const { document, panel, connection } = await start();
    panel.setVisible(false);
    fake.change(document, text.replace('Second', 'Hidden'));
    await panel.settle();
    expect(connection.source.text).toBe(text);
    panel.setVisible(true);
    await panel.settle();
    expect(connection.source.text).toBe(document.text);
    // A message that does not start at the version of the page makes the page ask for the whole text.
    panel.toPage.push({ type: 'text', from: 99, version: 100, patches: [] });
    await panel.settle();
    expect(connection.source.text).toBe(document.text);
    insert(connection, 'First', ' again');
    await panel.settle();
    expect(document.text).toBe(text.replace('Second', 'Hidden').replace('First', 'First again'));
  });

  it('sends the fonts again after a change of the settings of the Markdown preview', async () => {
    const { panel } = await start();
    expect(document.documentElement.style.getPropertyValue('--nsmd-preview-font-size')).toBe('');
    fake.settings['markdown.preview.fontSize'] = 18;
    fake.changeSettings('markdown.preview.fontSize');
    fake.changeSettings('editor');
    await panel.settle();
    expect(document.documentElement.style.getPropertyValue('--nsmd-preview-font-size')).toBe('18px');
  });
});

describe('the pages', () => {
  const pages = { showPagesCommand: 'test.showPages', showEditCommand: 'test.showEdit', pagesScripts: [FakeUri.file('/extension/dist/paged.polyfill.js') as never] };

  it('switches the page between "Edit" and "Pages" from the commands and from the page, with the context key of the view', async () => {
    const { panel, connection } = await start(text, pages);
    const views: string[] = [];
    connection.onView((view) => views.push(view));
    expect(connection.view).toBe('edit');
    expect(connection.pagesFrame.hidden).toBe(true);
    await fake.commands.get('test.showPages')?.();
    await panel.settle();
    expect(connection.view).toBe('pages');
    expect(connection.element.hidden).toBe(true);
    expect(connection.pagesFrame.hidden).toBe(false);
    expect(fake.executed).toContainEqual(['setContext', `${viewType}.pages`, true]);
    // A double click on a page switches back in the page, and the extension follows.
    connection.setView('edit');
    expect(connection.element.hidden).toBe(false);
    expect(connection.pagesFrame.hidden).toBe(true);
    await panel.settle();
    expect(fake.executed.at(-1)).toEqual(['setContext', `${viewType}.pages`, false]);
    expect(views).toEqual(['pages', 'edit']);
    // A page that starts again keeps the view of the panel.
    await fake.commands.get('test.showPages')?.();
    await panel.settle();
    panel.toHost.push({ type: 'ready' });
    await panel.settle();
    expect(connection.view).toBe('pages');
  });

  it('gives the page the host of the pages: the file, the top folder, the scripts and the addresses in the webview', async () => {
    const { connection } = await start(text, pages);
    const host = connection.pages;
    expect(host.document).toBe('file:///work/docs/file.md');
    expect(host.top).toBe('file:///work/');
    expect(host.sources).toBe('https://webview.test');
    expect(host.scripts).toEqual([{ src: 'https://webview.test/extension/dist/paged.polyfill.js' }]);
    expect(host.nonce).toBe('abc');
    expect(host.resource('file:///work/layouts/thesis/logo.png')).toBe('https://webview.test/work/layouts/thesis/logo.png');
    expect(host.resource('file:///elsewhere/logo.png')).toBe('file:///elsewhere/logo.png');
  });

  it('reads the files of the layouts through the extension, only from the folders that the page may load', async () => {
    const { panel, connection } = await start(text, pages);
    fake.files.set('file:///work/layouts/thesis/layout.json', new TextEncoder().encode('{}'));
    fake.files.set('file:///secret/key.txt', new TextEncoder().encode('secret'));
    const read = (url: string) => {
      const reading = connection.pages.reader.read(url);
      return panel.settle().then(() => reading);
    };
    expect(new TextDecoder().decode(await read('file:///work/layouts/thesis/layout.json'))).toBe('{}');
    expect(await read('file:///work/layouts/thesis/missing.css')).toBeUndefined();
    expect(await read('file:///secret/key.txt')).toBeUndefined();
    expect(await read('file:///work-other/key.txt')).toBeUndefined();
  });
});

describe('the text editor to the side', () => {
  it('opens the text editor of the file to the side with the selection of the page, from the button and from the page', async () => {
    const { document, panel, connection } = await start();
    connection.source.setSelections('page', [{ anchor: 18, head: 9 }]);
    await panel.settle();
    await fake.commands.get('test.openText')?.(document.uri);
    const [command, uri, view, options] = fake.executed[0] as [string, unknown, string, { viewColumn: number; preview: boolean; selection: FakeRange }];
    expect([command, uri, view]).toEqual(['vscode.openWith', document.uri, 'default']);
    expect(options.viewColumn).toBe(-2);
    expect(options.preview).toBe(false);
    expect(options.selection.start).toEqual({ line: 2, character: 0 });
    expect(options.selection.end).toEqual({ line: 2, character: 9 });
    connection.openText();
    await panel.settle();
    expect(fake.executed).toHaveLength(2);
    expect(fake.executed[1]).toEqual(fake.executed[0]);
  });

  it('opens the text editor of a file without an editor of the page', async () => {
    register();
    const uri = FakeUri.file('/work/other.md');
    await fake.commands.get('test.openText')?.(uri);
    expect(fake.executed).toEqual([['vscode.openWith', uri, 'default', { viewColumn: -2, preview: false }]]);
  });
});

describe('the messages of the page', () => {
  it('takes only messages of the known forms', () => {
    expect(pageMessage({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(pageMessage({ type: 'edit', id: 1, base: 2, patches: [{ from: 0, to: 1, insert: 'a' }] })).toEqual({
      type: 'edit',
      id: 1,
      base: 2,
      patches: [{ from: 0, to: 1, insert: 'a' }],
    });
    expect(pageMessage({ type: 'selection', selection: { anchor: 1, head: 2 }, more: true })).toEqual({ type: 'selection', selection: { anchor: 1, head: 2 } });
    expect(pageMessage({ type: 'edit', id: 1, base: 2, patches: [{ from: -1, to: 1, insert: 'a' }] })).toBeUndefined();
    expect(pageMessage({ type: 'edit', id: 1, base: 2, patches: {} })).toBeUndefined();
    expect(pageMessage({ type: 'selection', selection: { anchor: 'x', head: 2 } })).toBeUndefined();
    expect(pageMessage({ type: 'plugin', plugin: 'notes', message: { ask: 'login' } })).toEqual({ type: 'plugin', plugin: 'notes', message: { ask: 'login' } });
    expect(pageMessage({ type: 'plugin', plugin: 'not a name', message: 1 })).toBeUndefined();
    expect(pageMessage({ type: 'diffLayout', rows: '0:1', heights: [20, 0.5], start: 40, more: 1 })).toEqual({ type: 'diffLayout', rows: '0:1', heights: [20, 0.5], start: 40 });
    expect(pageMessage({ type: 'diffLayout', rows: '0:1', heights: [-1], start: 0 })).toBeUndefined();
    expect(pageMessage({ type: 'diffLayout', rows: '0:1', heights: [1] })).toBeUndefined();
    expect(pageMessage({ type: 'diffLayout', rows: 1, heights: [] })).toBeUndefined();
    expect(pageMessage({ type: 'diffScroll', row: 2, offset: -12.5 })).toEqual({ type: 'diffScroll', row: 2, offset: -12.5 });
    expect(pageMessage({ type: 'diffScroll', row: -1, offset: 0 })).toBeUndefined();
    expect(pageMessage({ type: 'diffScroll', row: 1, offset: Number.NaN })).toBeUndefined();
    expect(pageMessage({ type: 'run', command: 'x' })).toBeUndefined();
    expect(pageMessage('ready')).toBeUndefined();
    expect(pageMessage(null)).toBeUndefined();
  });

  it('gives a new text to the page when an edit does not fit the text of its base', async () => {
    const { document, panel, connection } = await start();
    panel.toHost.push({ type: 'edit', id: 7, base: 1, patches: [{ from: 0, to: 999, insert: '' }] });
    await panel.settle();
    expect(document.text).toBe(text);
    expect(connection.source.text).toBe(text);
  });
});

describe('the keys of the page', () => {
  it('keeps the keys that the page handled, and Undo and Redo in a field of text, from VS Code', async () => {
    await start();
    const field = document.createElement('div');
    field.contentEditable = 'true';
    const input = document.createElement('input');
    const button = document.createElement('button');
    document.body.append(field, input, button);
    const forwarded: string[] = [];
    const forward = (event: KeyboardEvent) => forwarded.push(`${event.ctrlKey ? 'Ctrl+' : ''}${event.key} in ${(event.target as Element).tagName}`);
    window.addEventListener('keydown', forward);
    try {
      const press = (target: Element, key: string, handled = false) => {
        const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true });
        if (handled) {
          target.addEventListener('keydown', (keydown) => keydown.preventDefault(), { once: true });
        }
        target.dispatchEvent(event);
      };
      press(field, 'z');
      press(field, 'y');
      press(input, 'Z');
      press(button, 'z');
      press(field, 's');
      press(field, 'k', true);
      expect(forwarded).toEqual(['Ctrl+z in BUTTON', 'Ctrl+s in DIV']);
    } finally {
      window.removeEventListener('keydown', forward);
    }
  });
});

describe('the plugins of the editor', () => {
  it('carry the messages of a plugin between its part on the page and its part in the extension', async () => {
    const inExtension: unknown[] = [];
    const disposed: string[] = [];
    let channel: PluginPanelChannel | undefined;
    const { panel, connection } = await start(text, {
      plugins: {
        notes: (each) => {
          channel = each;
          each.onMessage((message) => inExtension.push(message));
          return { dispose: () => disposed.push('notes') };
        },
      },
    });
    expect(connection.host.platform).toBe('vscode');
    const onPage: unknown[] = [];
    const pageChannel = connection.host.channel('notes');
    const stopListening = pageChannel.onMessage((message) => onPage.push(message));
    connection.host.channel('other').onMessage((message) => onPage.push(['other', message]));
    pageChannel.post({ ask: 'login' });
    connection.host.channel('unknown').post('dropped');
    await panel.settle();
    expect(inExtension).toEqual([{ ask: 'login' }]);
    expect(channel?.document.getText()).toBe(text);
    await channel?.post({ login: 'scalarion' });
    await panel.settle();
    expect(onPage).toEqual([{ login: 'scalarion' }]);
    stopListening();
    await channel?.post('after');
    await panel.settle();
    expect(onPage).toEqual([{ login: 'scalarion' }]);
    panel.dispose();
    expect(disposed).toEqual(['notes']);
  });

  it('give the page the scripts that other extensions contribute, only with the option and only from the folders of the extensions', async () => {
    const contributes = (editorScripts: unknown) => ({ contributes: { 'nimblescape.markdown.extensions': { editorScripts } } });
    fake.extensions.push(
      { id: 'nimblescape.nimblescape-markdownpaper', extensionUri: FakeUri.file('/ext/paper'), packageJSON: contributes(['dist/editorPlugins.js', '../notes/dist/webview.js', 'dist/paper.css', 7]) },
      { id: 'other.plain', extensionUri: FakeUri.file('/ext/plain'), packageJSON: {} },
      { id: 'a.first', extensionUri: FakeUri.file('/ext/first'), packageJSON: contributes(['main.js']) },
      { id: 'b.broken', extensionUri: FakeUri.file('/ext/broken'), packageJSON: contributes('main.js') },
    );
    const { panel, connection } = await start(text, { contributedPlugins: true });
    expect(connection.pluginScripts).toEqual(['https://webview.test/ext/first/main.js', 'https://webview.test/ext/paper/dist/editorPlugins.js']);
    expect(connection.nonce).toBe('abc');
    const roots = panel.webview.options.localResourceRoots?.map((root) => root.toString());
    expect(roots).toContain('file:///ext/paper/dist');
    expect(roots).not.toContain('file:///ext/notes/dist');
    // The page reads no file of the folders of the plugins through the extension.
    expect(connection.pages.embed).not.toContain('https://webview.test/ext/paper/dist/');
    stop?.dispose();
    connections.forEach((each) => each.dispose());
    connections.length = 0;
    const without = await start(text);
    expect(without.connection.pluginScripts).toEqual([]);
  });

  it('connect the part of a plugin of another extension later, and give it the messages that the page sent before', async () => {
    const { document, panel, connection } = await start(text);
    const pageChannel = connection.host.channel('paper');
    const onPage: unknown[] = [];
    pageChannel.onMessage((message) => onPage.push(message));
    pageChannel.post('first');
    pageChannel.post('second');
    await panel.settle();
    const received: unknown[] = [];
    const documents: string[] = [];
    const disposed: string[] = [];
    const added = stop!.addPlugin('paper', (channel) => {
      documents.push(channel.document.uri.toString());
      channel.onMessage((message) => received.push(message));
      void channel.post('hello');
      return { dispose: () => disposed.push(channel.document.uri.toString()) };
    });
    await panel.settle();
    expect(received).toEqual(['first', 'second']);
    expect(onPage).toEqual(['hello']);
    pageChannel.post('third');
    await panel.settle();
    expect(received).toEqual(['first', 'second', 'third']);
    // A panel that opens later connects the plugin as well.
    const other = fake.open(text, FakeUri.file('/work/docs/other.md'));
    await openPanel(fake, other);
    expect(documents).toEqual([document.uri.toString(), other.uri.toString()]);
    added.dispose();
    expect(disposed).toEqual([document.uri.toString(), other.uri.toString()]);
    pageChannel.post('after');
    await panel.settle();
    expect(received).toEqual(['first', 'second', 'third']);
    expect(() => stop!.addPlugin('no name', () => undefined)).toThrow();
  });

  it('keep at most 100 messages of the page for plugins without a listener', async () => {
    const { panel, connection } = await start(text);
    const pageChannel = connection.host.channel('late');
    for (let index = 0; index < 120; index++) {
      pageChannel.post(index);
    }
    await panel.settle();
    const received: unknown[] = [];
    stop!.addPlugin('late', (channel) => {
      channel.onMessage((message) => received.push(message));
    });
    await Promise.resolve();
    expect(received).toEqual(Array.from({ length: 100 }, (_, index) => index));
  });
});

describe('the editor in the page', () => {
  it('keeps a MarkdownEditor of the page and the document of VS Code the same', async () => {
    const { document, panel, connection } = await start('---\ntitle: A\n---\n\n' + text);
    const editor = new MarkdownEditor(connection.element, { source: connection.source, editable: connection.editable, id: 'page', host: connection.host });
    try {
      let at = -1;
      editor.tiptap.state.doc.descendants((node, position) => {
        if (at < 0 && node.isText && node.text?.startsWith('First')) {
          at = position + 'First'.length;
        }
      });
      editor.tiptap.chain().setTextSelection(at).insertContent(' new').run();
      await panel.settle();
      expect(document.text).toBe('---\ntitle: A\n---\n\n' + text.replace('First', 'First new'));
      fake.change(document, document.text.replace('title: A', 'title: B').replace('Second', 'Last'));
      await panel.settle();
      expect(editor.getMarkdown()).toBe(document.text);
      expect(editor.tiptap.state.doc.firstChild?.attrs.text).toBe('---\ntitle: B\n---');
    } finally {
      editor.destroy();
    }
  });
});

describe('the rendered changes', () => {
  const older = '# Title\n\nThe old words.\n\nStays.\n';
  const newer = '# Title\n\nThe new words.\n\nStays.\n\nAdded.\n';
  const gitUri = (ref: string) => new FakeUri('git', '/work/docs/file.md', JSON.stringify({ path: '/work/docs/file.md', ref }));
  const diffCommands = { nextChangeCommand: 'test.nextChange', previousChangeCommand: 'test.previousChange' };

  /** sent returns the messages of a type that the extension sent to a page. */
  const sent = (panel: FakePanel, type: string) => panel.toPage.filter((message) => (message as { type: string }).type === type);

  /** openDiff opens a diff of the version of Git and the file, the newer side first, as VS Code resolves them. */
  async function openDiff(options: Partial<MarkdownEditorRegistration> = {}) {
    register({ ...diffCommands, ...options });
    fake.writable.set('git', false);
    const original = fake.open(older, gitUri('~'));
    const modified = fake.open(newer);
    const tab = fake.showTab('file.md (Working Tree)');
    const modifiedPanel = await openPanel(fake, modified);
    const originalPanel = await openPanel(fake, original);
    return { original, modified, tab, originalPanel, modifiedPanel };
  }

  it('connects the two sides of a diff: each page gets its side and the text of the other side, and the older side is read-only', async () => {
    const { originalPanel, modifiedPanel } = await openDiff();
    expect(sent(originalPanel, 'diff')).toEqual([{ type: 'diff', side: 'original', text: newer, editable: false }]);
    expect(sent(modifiedPanel, 'diff')).toEqual([{ type: 'diff', side: 'modified', text: older, editable: true }]);
    expect(fake.executed).toContainEqual(['setContext', `${viewType}.diff`, true]);
    expect(fake.commands.has('test.nextChange') && fake.commands.has('test.previousChange')).toBe(true);
  });

  it('finds the older side by its version of Git, else by the order in which the sides open', async () => {
    register(diffCommands);
    fake.writable.set('git', false);
    fake.showTab('file.md (abc)');
    const child = await openPanel(fake, fake.open(newer, gitUri('abc')));
    const parent = await openPanel(fake, fake.open(older, gitUri('abc^')));
    expect(sent(parent, 'diff')).toEqual([{ type: 'diff', side: 'original', text: newer, editable: false }]);
    expect(sent(child, 'diff')).toEqual([{ type: 'diff', side: 'modified', text: older, editable: false }]);
    fake.showTab('a.md ↔ b.md');
    const first = await openPanel(fake, fake.open(older, FakeUri.file('/work/a.md')));
    const second = await openPanel(fake, fake.open(newer, FakeUri.file('/work/b.md')));
    expect(sent(first, 'diff')).toEqual([{ type: 'diff', side: 'original', text: newer, editable: false }]);
    expect(sent(second, 'diff')).toEqual([{ type: 'diff', side: 'modified', text: older, editable: true }]);
  });

  it('gives the other page the heights of the rows, the scroll place and each new text, and goes to a change from the commands', async () => {
    const { modified, originalPanel, modifiedPanel } = await openDiff();
    originalPanel.pageApi.postMessage({ type: 'diffLayout', rows: '0:1', heights: [20, 30], start: 48 });
    originalPanel.deliverToHost();
    expect(sent(modifiedPanel, 'diffLayout')).toEqual([{ type: 'diffLayout', rows: '0:1', heights: [20, 30], start: 48 }]);
    modifiedPanel.pageApi.postMessage({ type: 'diffScroll', row: 2, offset: 4 });
    modifiedPanel.deliverToHost();
    expect(sent(originalPanel, 'diffScroll')).toEqual([{ type: 'diffScroll', row: 2, offset: 4 }]);
    fake.change(modified, `${newer}\nMore.\n`);
    expect(sent(originalPanel, 'diffText')).toEqual([{ type: 'diffText', text: `${newer}\nMore.\n` }]);
    originalPanel.active = false;
    await fake.commands.get('test.nextChange')?.();
    expect(sent(modifiedPanel, 'diffGo')).toEqual([{ type: 'diffGo', direction: 'next' }]);
    originalPanel.active = true;
    await fake.commands.get('test.previousChange')?.();
    expect(sent(originalPanel, 'diffGo')).toEqual([{ type: 'diffGo', direction: 'previous' }]);
    modifiedPanel.dispose();
    fake.showTab('other.md', { uri: FakeUri.file('/work/other.md') });
    expect(fake.executed.at(-1)).toEqual(['setContext', `${viewType}.diff`, false]);
  });

  it('opens the text diff of VS Code for a file that the extension does not open', async () => {
    const { original, modified, tab, originalPanel } = await openDiff({ opens: () => false });
    expect(fake.closed).toEqual([tab]);
    expect(fake.executed).toContainEqual(['vscode.diff', original.uri, modified.uri, 'file.md (Working Tree)', { viewColumn: 1, preview: false, override: true }]);
    expect(sent(originalPanel, 'diff')).toEqual([]);
  });

  it('shows the changes in the editor of the page: the older side read-only, without the switch to editing', async () => {
    register(diffCommands);
    fake.writable.set('git', false);
    const original = fake.open(older, gitUri('~'));
    const modified = fake.open(newer);
    fake.showTab('file.md (Working Tree)');
    const panel = await openPanel(fake, original);
    const connecting = connectVsCode({ api: panel.pageApi });
    await panel.settle();
    const connection = await connecting;
    connections.push(connection);
    const editor = new MarkdownEditor(connection.element, { source: connection.source, editable: connection.editable, id: 'page', host: connection.host });
    try {
      const stopDiff = followDiff(connection, editor);
      expect(connection.diff).toBeUndefined();
      const other = await openPanel(fake, modified);
      await panel.settle();
      expect(connection.diff?.side).toBe('original');
      expect(connection.editable).toBe(false);
      expect(editor.isEditable).toBe(false);
      const toggle = [...connection.element.querySelectorAll<HTMLButtonElement>('.nsmd-toolbar button')].find((button) => button.title.includes('editing'));
      expect(toggle?.hidden).toBe(true);
      const marked = (name: string) => [...connection.element.querySelectorAll(`.${name}`)].map((node) => node.textContent);
      expect(marked('nsmd-diff-changed')).toEqual(['The old words.']);
      expect(marked('nsmd-diff-word')).toEqual(['old']);
      fake.change(modified, newer.replace('new words', 'old words'));
      await panel.settle();
      expect(marked('nsmd-diff-changed')).toEqual([]);
      for (let wait = 0; wait < 20 && sent(other, 'diffLayout').length === 0; wait++) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        await panel.settle();
      }
      expect(sent(other, 'diffLayout').length).toBeGreaterThan(0);
      stopDiff();
    } finally {
      editor.destroy();
    }
  });
});
