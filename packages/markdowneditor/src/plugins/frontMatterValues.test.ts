// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the values of the front matter in the text (docs/editor.md, R-FM-007), which every editor has: the
// hidden markers that keep their text, the values as read-only generated parts when the front matter has their keys,
// Ctrl+click to the input in the form, the keys that jump over the markers, and the output of the renderer.

import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { MarkdownRenderer } from '@nimblescape/markdownrender';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor } from '../editor';
import { frontMatterValuesPlugin, valueNodeName } from './frontMatterValues';

let editors: MarkdownEditor[] = [];
let element: HTMLElement;
afterEach(() => {
  editors.forEach((each) => each.destroy());
  editors = [];
  element?.remove();
});

/** open returns an editor in a page with a text. */
function open(markdown: string): MarkdownEditor {
  element = document.createElement('div');
  document.body.append(element);
  const editor = new MarkdownEditor(element, { markdown });
  editors.push(editor);
  return editor;
}

/** viewOf returns the view of an editor. */
const viewOf = (editor: MarkdownEditor): EditorView => editor.tiptap.view;

/** select puts the cursor at a position of the document. */
function select(editor: MarkdownEditor, pos: number): void {
  const view = viewOf(editor);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

/** key sends a key to the editor as the browser does, and returns true when the editor used it. */
function key(editor: MarkdownEditor, name: string): boolean {
  const view = viewOf(editor);
  return view.someProp('handleKeyDown', (handle) => handle(view, new KeyboardEvent('keydown', { key: name }))) ?? false;
}

/** markersOf returns the markers of the values of a document, with their keys, edges and texts. */
function markersOf(editor: MarkdownEditor): string[] {
  const markers: string[] = [];
  editor.tiptap.state.doc.descendants((node) => {
    if (node.type.name === valueNodeName) {
      markers.push(`${node.attrs.edge as string} ${node.attrs.key as string} ${node.attrs.text as string}`);
    }
  });
  return markers;
}

/** posOf returns the position of the first place of a text in the document. */
function posOf(editor: MarkdownEditor, text: string): number {
  let found = -1;
  editor.tiptap.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text!.includes(text)) {
      found = pos + node.text!.indexOf(text);
    }
  });
  return found;
}

const frontMatter = '---\ntitle: A paper\nauthor:\n  name: Hannes Stauss\n---\n\n';
const line = 'This is <wbr><!--{title}-->A paper<!--{/title}--> of <wbr><!--{author.name}-->Hannes Stauss<!--{/author.name}-->.\n';

describe('the values of the front matter in the text', () => {
  it('hide the markers, which keep their text byte for byte', () => {
    const editor = open(frontMatter + line);
    expect(markersOf(editor)).toEqual([
      'open title <wbr><!--{title}-->',
      'close title <!--{/title}-->',
      'open author.name <wbr><!--{author.name}-->',
      'close author.name <!--{/author.name}-->',
    ]);
    expect(element.querySelector('.ProseMirror p')?.textContent).toBe('This is A paper of Hannes Stauss.');
    expect(editor.getMarkdown()).toBe(frontMatter + line);
  });

  it('keep a marker without its pair, in another line or of another key as inline HTML', () => {
    const text = 'One <wbr><!--{title}-->A paper\nand <!--{/title}--> and <!--{a}-->b<!--{/c}-->.\n';
    const editor = open(text);
    expect(markersOf(editor)).toEqual([]);
    expect(editor.getMarkdown()).toBe(text);
  });

  it('make a value with its markers a read-only part when the front matter has its key, and leave other values editable', () => {
    const editor = open(frontMatter + line + '\nAnd <wbr><!--{date}-->today<!--{/date}-->.\n');
    const parts = [...element.querySelectorAll('.nsmd-generated')].map((part) => part.textContent).filter((part) => part !== '');
    expect(parts).toEqual(['A paper', 'Hannes Stauss']);
    const view = viewOf(editor);
    const inside = posOf(editor, 'paper');
    view.dispatch(view.state.tr.insertText('x', inside));
    expect(editor.getMarkdown()).toContain('<!--{title}-->A paper<!--{/title}-->');
    const today = posOf(editor, 'today');
    view.dispatch(view.state.tr.insertText('not ', today));
    expect(editor.getMarkdown()).toContain('<wbr><!--{date}-->not today<!--{/date}-->');
  });

  it('go to the input of the key in the form with Ctrl+click', () => {
    const editor = open(frontMatter + line);
    const view = viewOf(editor);
    view.someProp('handleClick', (handle) => handle(view, posOf(editor, 'Stauss'), new MouseEvent('click', { ctrlKey: true })));
    const active = document.activeElement as HTMLElement | null;
    expect(active?.closest('.nsmd-fm')).not.toBeNull();
    expect(active?.dataset.focus).toBe('value ["author","name"]');
  });

  it('jump over the markers with Backspace and Delete, which delete a whole read-only value at its edge', () => {
    // Without a key in the front matter, the cursor jumps over the marker, and the browser deletes the character beyond it.
    const editor = open('Say <wbr><!--{date}-->today<!--{/date}-->!\n');
    const view = viewOf(editor);
    select(editor, posOf(editor, '!'));
    expect(key(editor, 'Backspace')).toBe(false);
    expect(view.state.selection.head).toBe(posOf(editor, 'today') + 'today'.length);
    select(editor, posOf(editor, 'today'));
    expect(key(editor, 'Delete')).toBe(false);
    expect(view.state.selection.head).toBe(posOf(editor, 'today'));
    select(editor, posOf(editor, 'today') - 1);
    expect(key(editor, 'Delete')).toBe(false);
    expect(view.state.selection.head).toBe(posOf(editor, 'today'));
    const read = open(frontMatter + 'Say <wbr><!--{title}-->A paper<!--{/title}-->!\n');
    select(read, posOf(read, '!'));
    expect(key(read, 'Backspace')).toBe(true);
    expect(read.getMarkdown()).toBe(frontMatter + 'Say !\n');
  });

  it('have no output in the renderer, as on GitHub', () => {
    for (const rawHtml of ['safe', 'trusted'] as const) {
      const renderer = new MarkdownRenderer({ plugins: [frontMatterValuesPlugin], rawHtml, lines: false });
      expect(renderer.toHtml(line).html).toBe('<p>This is A paper of Hannes Stauss.</p>\n');
    }
  });
});
