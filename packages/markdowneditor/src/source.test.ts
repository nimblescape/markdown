// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the editor with a source (docs/editor.md, R-EDIT-002; docs/source.md, R-SRC-001, R-SRC-002): two editors
// of one file, the changes of the user with their origin, the changes from outside, which replace only the blocks whose
// text changed, Undo after a change from outside, and the selection of the editor in the text.

import { TextSource, type TextChange } from '@nimblescape/markdowntext';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor } from './editor';

const text = '---\ntitle: A\n---\n\n# Title\n\nFirst paragraph.\n\nSecond paragraph.\n';

const editors: MarkdownEditor[] = [];
afterEach(() => {
  editors.forEach((editor) => editor.destroy());
  editors.length = 0;
});

/** open returns a new editor of a source. */
function open(source: TextSource, options: { id?: string; onChange?: () => void } = {}): MarkdownEditor {
  const editor = new MarkdownEditor(document.createElement('div'), { source, ...options });
  editors.push(editor);
  return editor;
}

/** positionOf returns the position in the document of an editor after the first match of a text. */
function positionOf(editor: MarkdownEditor, words: string): number {
  let found = -1;
  editor.tiptap.state.doc.descendants((node, position) => {
    if (found < 0 && node.isText && node.text?.includes(words)) {
      found = position + (node.text.indexOf(words) + words.length);
    }
  });
  if (found < 0) {
    throw new Error(`The editor has no text ${words}.`);
  }
  return found;
}

describe('the editor with a source', () => {
  it('shows the text of the source and gives each change of the user to the source with its origin', () => {
    const source = new TextSource(text);
    const changes: TextChange[] = [];
    source.onChange((change) => changes.push(change));
    const editor = open(source, { id: 'rendered' });
    expect(editor.getMarkdown()).toBe(text);
    editor.tiptap.chain().setTextSelection(positionOf(editor, 'First')).insertContent(' new').run();
    expect(source.text).toBe(text.replace('First paragraph', 'First new paragraph'));
    expect(changes).toHaveLength(1);
    expect(changes[0].origin).toEqual({ kind: 'user', editor: 'rendered' });
    expect(changes[0].patches).toEqual([{ from: text.indexOf('First') + 5, to: text.indexOf('First') + 5, insert: ' new' }]);
  });

  it('shows at once in a second editor of the same source, which changes only the changed block', () => {
    const source = new TextSource(text);
    const first = open(source);
    const second = open(source);
    const heading = second.tiptap.state.doc.child(1);
    const untouched = second.tiptap.state.doc.child(3);
    first.tiptap.chain().setTextSelection(positionOf(first, 'First')).insertContent(' new').run();
    expect(second.getMarkdown()).toBe(source.text);
    // The blocks that did not change are the same nodes as before.
    expect(second.tiptap.state.doc.child(1)).toBe(heading);
    expect(second.tiptap.state.doc.child(3)).toBe(untouched);
    expect(second.tiptap.state.doc.child(2).textContent).toBe('First new paragraph.');
    // An edit in the second editor shows in the first one.
    second.tiptap.chain().setTextSelection(positionOf(second, 'Second')).insertContent(' and last').run();
    expect(first.getMarkdown()).toBe(text.replace('First paragraph', 'First new paragraph').replace('Second paragraph', 'Second and last paragraph'));
  });

  it('takes a change from outside: the cursor stays, onChange is not called, and Undo keeps the steps of the user', () => {
    const source = new TextSource(text);
    let changes = 0;
    const editor = open(source, { onChange: () => changes++ });
    editor.tiptap.chain().setTextSelection(positionOf(editor, 'Second')).insertContent('!').run();
    expect(changes).toBe(1);
    const cursor = editor.tiptap.state.selection.head;
    source.setText(source.text.replace('# Title', '# Changed title'), { kind: 'program', name: 'git' });
    expect(changes).toBe(1);
    expect(editor.getMarkdown()).toBe(text.replace('# Title', '# Changed title').replace('Second', 'Second!'));
    // The heading has 8 more characters before the cursor.
    expect(editor.tiptap.state.selection.head).toBe(cursor + 8);
    editor.tiptap.commands.undo();
    expect(source.text).toBe(text.replace('# Title', '# Changed title'));
    expect(changes).toBe(2);
  });

  it('takes a change of the front matter from outside, and its removal', () => {
    const source = new TextSource(text);
    const editor = open(source);
    source.setText(text.replace('title: A', 'title: B'), { kind: 'ai', name: 'agent' });
    expect(editor.tiptap.state.doc.firstChild?.attrs.text).toBe('---\ntitle: B\n---');
    source.setText(text.slice(text.indexOf('# Title')), { kind: 'program', name: 'git' });
    expect(editor.tiptap.state.doc.firstChild?.type.name).toBe('heading');
    expect(editor.getMarkdown()).toBe(text.slice(text.indexOf('# Title')));
  });

  it('keeps the text of the file byte for byte after changes from both sides, also with the line breaks of Windows', () => {
    const windows = '﻿# Title\r\n\r\nText *one*.\r\n\r\n- a\r\n- b\r\n';
    const source = new TextSource(windows);
    const editor = open(source);
    source.setText(windows.replace('- b', '- b\r\n- c'), { kind: 'program', name: 'git' });
    expect(editor.getMarkdown()).toBe(source.text);
    editor.tiptap.chain().setTextSelection(positionOf(editor, 'Title')).insertContent('!').run();
    expect(source.text).toBe('﻿# Title!\r\n\r\nText *one*.\r\n\r\n- a\r\n- b\r\n- c\r\n');
  });

  it('gives the source its selection as the text of the blocks that the selection touches', () => {
    const source = new TextSource(text);
    const editor = open(source, { id: 'rendered' });
    editor.tiptap.commands.setTextSelection(positionOf(editor, 'First'));
    const start = text.indexOf('First');
    expect(source.selections('rendered')).toEqual([{ anchor: start, head: start + 'First paragraph.'.length }]);
    editor.tiptap.commands.setTextSelection({ from: positionOf(editor, 'Second'), to: positionOf(editor, 'Tit') });
    expect(source.selections('rendered')).toEqual([{ anchor: text.indexOf('Second') + 'Second paragraph.'.length, head: text.indexOf('# Title') }]);
    const windows = new TextSource('﻿a\r\n\r\nb\r\n');
    const other = open(windows, { id: 'other' });
    other.tiptap.commands.setTextSelection(positionOf(other, 'b'));
    expect(windows.selections('other')).toEqual([{ anchor: 6, head: 7 }]);
  });

  it('goes to the block that holds a place of the text, for example a line from a double click on the pages', () => {
    const source = new TextSource(text);
    const editor = open(source, { id: 'rendered' });
    const blockOf = () => editor.tiptap.state.selection.$head.parent.textContent;
    editor.goToText(text.indexOf('Second'));
    expect(blockOf()).toBe('Second paragraph.');
    expect(editor.tiptap.state.selection.$head.parentOffset).toBe(0);
    // A place within a block and a place in the gap after it go to that block; the front matter goes to the first block.
    editor.goToText(text.indexOf('paragraph.'));
    expect(blockOf()).toBe('First paragraph.');
    editor.goToText(text.indexOf('First') + 'First paragraph.'.length + 1);
    expect(blockOf()).toBe('First paragraph.');
    editor.goToText(0);
    expect(source.selections('rendered')).toEqual([{ anchor: text.indexOf('# Title'), head: text.indexOf('# Title') + '# Title'.length }]);
    editor.goToText(text.length + 10);
    expect(blockOf()).toBe('Second paragraph.');
  });

  it('gives a new text of setMarkdown to the source, and leaves the source when it closes', () => {
    const source = new TextSource(text);
    const editor = open(source, { id: 'rendered' });
    const second = open(source);
    editor.setMarkdown('# New\n');
    expect(source.text).toBe('# New\n');
    expect(second.getMarkdown()).toBe('# New\n');
    editor.tiptap.commands.setTextSelection(1);
    expect(source.editors()).toContain('rendered');
    editor.destroy();
    editors.splice(editors.indexOf(editor), 1);
    expect(source.editors()).not.toContain('rendered');
    source.setText('# Other\n', { kind: 'program' });
    expect(second.getMarkdown()).toBe('# Other\n');
  });
});
