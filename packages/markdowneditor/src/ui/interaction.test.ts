// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the interaction of the editor (docs/editor.md, R-GEN-003, R-EDIT-007, R-GEN-008): the slash commands,
// find and replace, the moves of blocks, the insert items, the link, the GitHub alerts and read-only mode. Each test
// drives the editor through its commands and checks the Markdown that it writes.

import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor, type MarkdownEditorOptions } from '../editor';
import { moveCurrentBlock } from './blockHandle';
import { findKey, findNext, replaceAll, replaceMatch, setFind } from './find';
import { insertAlert, insertFootnote } from './items';
import { matches } from './menu';

let editor: MarkdownEditor | undefined;
let element: HTMLElement;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  element?.remove();
});

/** open returns an editor in a page with a text. */
function open(markdown: string, options: MarkdownEditorOptions = {}): MarkdownEditor {
  element = document.createElement('div');
  document.body.append(element);
  editor = new MarkdownEditor(element, { markdown, ...options });
  return editor;
}

/** viewOf returns the view of an editor. */
const viewOf = (opened: MarkdownEditor): EditorView => opened.tiptap.view;

/** select puts the cursor or the selection at positions of the document. */
function select(opened: MarkdownEditor, from: number, to = from): void {
  const view = viewOf(opened);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
}

/** key sends a key to the editor as the browser does, and returns true when the editor used it. */
function key(opened: MarkdownEditor, name: string, init: KeyboardEventInit = {}): boolean {
  const view = viewOf(opened);
  const event = new KeyboardEvent('keydown', { key: name, ...init });
  return view.someProp('handleKeyDown', (handle) => handle(view, event)) ?? false;
}

/** type types a text at the cursor; a slash goes through the input of text, as the browser does. */
function type(opened: MarkdownEditor, text: string): void {
  const view = viewOf(opened);
  for (const character of text) {
    const { from, to } = view.state.selection;
    const used = view.someProp('handleTextInput', (handle) => handle(view, from, to, character, () => view.state.tr.insertText(character, from, to)));
    if (!used) {
      view.dispatch(view.state.tr.insertText(character, from, to));
    }
  }
}

/** labels returns the labels of the items of the open menu. */
const labels = (): string[] => [...element.querySelectorAll('.nsmd-menu-item .nsmd-menu-label')].map((item) => item.textContent ?? '');

describe('the menus', () => {
  it('find the items whose words start with the typed words', () => {
    const items = [
      { id: 'bulletList', label: 'Bulleted list', run: () => undefined },
      { id: 'orderedList', label: 'Numbered list', keywords: ['ol'], run: () => undefined },
    ];
    expect(matches(items, 'num').map((item) => item.id)).toEqual(['orderedList']);
    expect(matches(items, 'list').map((item) => item.id)).toEqual(['bulletList', 'orderedList']);
    expect(matches(items, 'ol').map((item) => item.id)).toEqual(['orderedList']);
    expect(matches(items, 'x')).toEqual([]);
  });

  it('find an item by its name as a slash command, and put the item of that name first', () => {
    const items = [
      { id: 'alert-note', label: 'Note', slash: 'alert', run: () => undefined },
      { id: 'note', label: 'Add a note', slash: 'note', run: () => undefined },
      { id: 'heading1', label: 'Heading 1', slash: 'h1', run: () => undefined },
    ];
    expect(matches(items, 'h1').map((item) => item.id)).toEqual(['heading1']);
    expect(matches(items, 'note').map((item) => item.id)).toEqual(['note', 'alert-note']);
  });
});

describe('the slash commands', () => {
  it('open the insert menu, filter it, and insert the chosen item in place of the typed text', () => {
    const opened = open('Title\n');
    select(opened, 1);
    type(opened, '/heading 2');
    expect(labels()).toEqual(['Heading 2']);
    expect(key(opened, 'Enter')).toBe(true);
    expect(opened.getMarkdown()).toBe('## Title\n');
    expect(element.querySelector<HTMLElement>('.nsmd-menu')?.hidden).toBe(true);
  });

  it('show the name of each item as a slash command, the same name as in the text editor', () => {
    const opened = open('Title\n');
    select(opened, 1);
    type(opened, '/h2');
    expect(labels()).toEqual(['Heading 2']);
    expect(element.querySelector('.nsmd-menu-item .nsmd-menu-hint')?.textContent).toBe('/h2');
    expect(key(opened, 'Enter')).toBe(true);
    expect(opened.getMarkdown()).toBe('## Title\n');
    select(opened, opened.tiptap.state.doc.content.size - 1);
    type(opened, ' /alert');
    expect(labels()).toEqual(['Note', 'Tip', 'Important', 'Warning', 'Caution']);
  });

  it('keep selected text for the commands on selected text, and select it again before such a command runs', () => {
    const ran: string[] = [];
    const opened = open('Some text here.\n', {
      insertItems: (tiptap) => [
        { id: 'note', label: 'Add a note', slash: 'note', selection: true, run: () => ran.push(tiptap.state.doc.textBetween(tiptap.state.selection.from, tiptap.state.selection.to)) },
        { id: 'date', label: 'Date', slash: 'date', run: () => ran.push('date') },
      ],
    });
    select(opened, 6, 10);
    type(opened, '/no');
    expect(opened.getMarkdown()).toBe('Some text/no here.\n');
    expect(labels()).toEqual(['Add a note']);
    expect(element.querySelector('.nsmd-slash-selected')?.textContent).toBe('text');
    expect(key(opened, 'Enter')).toBe(true);
    expect(ran).toEqual(['text']);
    expect(opened.getMarkdown()).toBe('Some text here.\n');
    expect(element.querySelector('.nsmd-slash-selected')).toBeNull();
    // Without selected text, the list has no commands on selected text.
    select(opened, 16);
    type(opened, ' /');
    expect(labels()).toContain('Date');
    expect(labels()).not.toContain('Add a note');
  });

  it('let a slash replace selected text when no command works on selected text', () => {
    const opened = open('Some text here.\n');
    select(opened, 6, 10);
    type(opened, '/');
    expect(opened.getMarkdown()).toBe('Some / here.\n');
  });

  it('take an item of a plugin in place of the item of the editor with the same id, and keep the commands on selected text out of the insert menu', () => {
    const opened = open('\n', {
      insertItems: () => [
        { id: 'table', label: 'Table with caption', slash: 'table', run: () => undefined },
        { id: 'note', label: 'Add a note', slash: 'note', selection: true, run: () => undefined },
      ],
    });
    select(opened, 1);
    type(opened, '/table');
    expect(labels()).toEqual(['Table with caption']);
    key(opened, 'Escape');
    element.querySelector<HTMLElement>('.nsmd-toolbar button[aria-label="Insert"]')?.click();
    expect(labels()).toContain('Table with caption');
    expect(labels()).not.toContain('Table');
    expect(labels()).not.toContain('Add a note');
  });

  it('start only at the start of a line or after a space, and close with Escape', () => {
    const opened = open('a\n');
    select(opened, 2);
    type(opened, '/');
    expect(labels()).toEqual([]);
    expect(opened.getMarkdown()).toBe('a/\n');
    type(opened, ' /');
    expect(labels().length).toBeGreaterThan(5);
    expect(key(opened, 'Escape')).toBe(true);
    expect(element.querySelector<HTMLElement>('.nsmd-menu')?.hidden).toBe(true);
    expect(opened.getMarkdown()).toBe('a/ /\n');
  });
});

describe('find and replace', () => {
  const text = 'one two one\n\nOne[^1]\n\n[^1]: one\n';

  it('finds the matches in the rendered text, with or without the case of the letters', () => {
    const opened = open(text);
    const view = viewOf(opened);
    setFind(view, 'one', false);
    expect(findKey.getState(view.state)?.matches).toHaveLength(4);
    setFind(view, 'one', true);
    expect(findKey.getState(view.state)?.matches).toHaveLength(3);
    expect(element.querySelectorAll('.nsmd-find-match')).toHaveLength(3);
    expect(findNext(view, 1)).toBe(true);
    expect(element.querySelectorAll('.nsmd-find-current')).toHaveLength(1);
  });

  it('replaces one match or all matches, each as one step of undo', () => {
    const opened = open(text);
    const view = viewOf(opened);
    setFind(view, 'one', true);
    expect(replaceMatch(view, 'three')).toBe(true);
    expect(opened.getMarkdown()).toBe('three two one\n\nOne[^1]\n\n[^1]: one\n');
    expect(replaceAll(view, 'four')).toBe(2);
    expect(opened.getMarkdown()).toBe('three two four\n\nOne[^1]\n\n[^1]: four\n');
    opened.tiptap.commands.undo();
    expect(opened.getMarkdown()).toBe('three two one\n\nOne[^1]\n\n[^1]: one\n');
  });

  it('has no replace in read-only mode', () => {
    const opened = open(text, { editable: false });
    opened.openFind();
    const rows = element.querySelectorAll<HTMLElement>('.nsmd-find-row');
    expect(rows[0].hidden).toBe(false);
    expect(rows[1].hidden).toBe(true);
    expect(replaceAll(viewOf(opened), 'x')).toBe(0);
  });
});

describe('the moves of blocks', () => {
  it('moves an item of a list and a top-level block, and keeps the text of the unchanged blocks', () => {
    const opened = open('- a\n- b\n- c\n\nSome   text.\n');
    // The text of the first item starts after the open tags of the list, the item and its paragraph.
    select(opened, 3);
    expect(moveCurrentBlock(opened.tiptap.state, 1, viewOf(opened).dispatch)).toBe(true);
    expect(opened.getMarkdown()).toBe('- b\n- a\n- c\n\nSome   text.\n');
    select(opened, opened.tiptap.state.doc.content.size - 2);
    expect(key(opened, 'ArrowUp', { altKey: true })).toBe(true);
    expect(opened.getMarkdown()).toBe('Some   text.\n\n- b\n- a\n- c\n');
    expect(key(opened, 'ArrowUp', { altKey: true })).toBe(false);
  });
});

describe('the insert items', () => {
  it('insert a footnote with the next number and put the cursor into its text', () => {
    const opened = open('Text[^1]\n\n[^1]: a\n');
    select(opened, 5);
    expect(insertFootnote(opened.tiptap)).toBe(true);
    type(opened, 'b');
    expect(opened.getMarkdown()).toBe('Text[^2][^1]\n\n[^1]: a\n\n[^2]: b\n');
  });

  it('insert a GitHub alert', () => {
    const opened = open('');
    expect(insertAlert(opened.tiptap, 'warning')).toBe(true);
    type(opened, 'Careful.');
    expect(opened.getMarkdown()).toBe('> [!WARNING]\n> Careful.\n');
    expect(element.querySelector('blockquote.nsmd-alert-warning .nsmd-alert-marker')?.getAttribute('data-label')).toBe('Warning');
  });

  it('set a link from the address that the user gives', async () => {
    const opened = open('Some text.\n');
    select(opened, 6, 10);
    expect(key(opened, 'k', { ctrlKey: true })).toBe(true);
    const input = element.querySelector<HTMLInputElement>('.nsmd-ask-input');
    expect(input).not.toBeNull();
    if (input) {
      input.value = 'https://example.com';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }
    await Promise.resolve();
    expect(opened.getMarkdown()).toBe('Some [text](https://example.com).\n');
  });
});

describe('the changes of the text of plugins', () => {
  it('change the text of the file as one step of Undo, and select a range of the text', () => {
    const opened = open('First.\n\nSecond.\n');
    expect(opened.changeText([{ from: 8, to: 8, insert: 'Table 1: Caption\n\n' }])).toBe(true);
    expect(opened.getMarkdown()).toBe('First.\n\nTable 1: Caption\n\nSecond.\n');
    expect(opened.selectText(17, 24)).toBe(true);
    const { from, to } = opened.tiptap.state.selection;
    expect(opened.tiptap.state.doc.textBetween(from, to)).toBe('Caption');
    expect(opened.changeText([{ from: 50, to: 50, insert: 'x' }])).toBe(false);
    opened.tiptap.commands.undo();
    expect(opened.getMarkdown()).toBe('First.\n\nSecond.\n');
  });
});

describe('the toolbar and read-only mode', () => {
  it('shows only the buttons that do not change the text in read-only mode', () => {
    let changes = 0;
    const opened = open('Text\n', { onChange: () => changes++ });
    const undo = element.querySelector<HTMLElement>('.nsmd-toolbar button[aria-label^="Undo"]');
    expect(undo?.hidden).toBe(false);
    element.querySelector<HTMLElement>('.nsmd-toolbar button[aria-label="Switch to read-only mode"]')?.click();
    expect(opened.isEditable).toBe(false);
    expect(undo?.hidden).toBe(true);
    expect(element.querySelector<HTMLElement>('.nsmd-toolbar button[aria-label^="Find"]')?.hidden).toBe(false);
    expect(changes).toBe(0);
    type(opened, '/');
    expect(labels()).toEqual([]);
  });

  it('leaves out the toolbar or its switches when the integrating code says so', () => {
    open('Text\n', { toolbar: false });
    expect(element.querySelector('.nsmd-toolbar')).toBeNull();
    editor?.destroy();
    open('Text\n', { readOnlyToggle: false });
    expect(element.querySelector('.nsmd-toolbar')).not.toBeNull();
    expect(element.querySelector('.nsmd-toolbar button[aria-label="Switch to read-only mode"]')).toBeNull();
  });

  it('adds the buttons of extensions to the format bar', () => {
    open('Text\n', { formatButtons: [{ id: 'comment', label: 'Comment', text: 'Comment', readOnly: true, run: () => undefined }] });
    expect(element.querySelector('.nsmd-format-bar [data-button="comment"]')).not.toBeNull();
    expect(element.querySelector('.nsmd-format-bar button[aria-label^="Underline"]')).not.toBeNull();
  });

  it('hides a button of an extension that does not apply', () => {
    let applies = false;
    const opened = open('Some text\n', { formatButtons: [{ id: 'research', label: 'Research', text: 'Research', isShown: () => applies, run: () => undefined }] });
    const button = () => element.querySelector<HTMLElement>('.nsmd-format-bar [data-button="research"]')!;
    viewOf(opened).focus();
    select(opened, 1, 5);
    expect(element.querySelector<HTMLElement>('.nsmd-format-bar')?.hidden).toBe(false);
    expect(button().hidden).toBe(true);
    applies = true;
    select(opened, 1, 6);
    expect(button().hidden).toBe(false);
  });
});
