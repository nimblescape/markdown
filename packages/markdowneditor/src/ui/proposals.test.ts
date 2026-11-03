// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the proposed changes (docs/ai.md, R-AI-006): a change in the line and a change of blocks as tracked
// changes, Accept with the origin of the proposal and one step of Undo, Reject, a proposal that a change of the user or
// from outside makes outdated, and the line breaks of Windows.

import { TextSource, type JsonSchema, type TextChange } from '@nimblescape/markdowntext';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor } from '../editor';

const text = '# Title\n\nFirst paragraph with **bold** words.\n\nSecond paragraph.\n\nThird paragraph.\n';

const editors: MarkdownEditor[] = [];
afterEach(() => {
  editors.forEach((editor) => editor.destroy());
  editors.length = 0;
});

/** open returns a new editor of a source, in an element of the page. */
function open(source: TextSource, options: { editable?: boolean } = {}): MarkdownEditor {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new MarkdownEditor(element, { source, id: 'rendered', ...options });
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

/** range returns the range of the first match of a text in a text. */
function range(of: string, words: string): { from: number; to: number } {
  const from = of.indexOf(words);
  if (from < 0) {
    throw new Error(`The text has no ${words}.`);
  }
  return { from, to: from + words.length };
}

/** dom returns the element of the text of an editor. */
function dom(editor: MarkdownEditor): HTMLElement {
  return editor.tiptap.view.dom;
}

describe('the proposed changes', () => {
  it('shows a change in the line as a tracked change and leaves the file as it is', () => {
    const source = new TextSource(text);
    const editor = open(source);
    void editor.proposeChange({ id: 'a', ...range(text, 'paragraph with'), text: 'text with' });
    expect(source.text).toBe(text);
    expect(dom(editor).querySelector('.nsmd-change-removed')?.textContent).toBe('paragraph with');
    const added = dom(editor).querySelector('.nsmd-change-inline .nsmd-change-added');
    expect(added?.textContent).toBe('text with');
    expect(added?.querySelector('p')).toBeNull();
    expect(dom(editor).querySelectorAll('.nsmd-change-actions button')).toHaveLength(2);
    expect(editor.proposedChanges().map((change) => change.id)).toEqual(['a']);
  });

  it('applies an accepted change with the origin of the proposal, as one step of Undo', async () => {
    const source = new TextSource(text);
    const changes: TextChange[] = [];
    source.onChange((change) => changes.push(change));
    const editor = open(source);
    const result = editor.proposeChange({ id: 'a', ...range(text, 'Second paragraph'), text: 'Changed *paragraph*' });
    (dom(editor).querySelector('.nsmd-change-accept') as HTMLButtonElement).click();
    expect(await result).toBe('accepted');
    const changed = text.replace('Second paragraph', 'Changed *paragraph*');
    expect(source.text).toBe(changed);
    expect(changes).toHaveLength(1);
    expect(changes[0].origin).toEqual({ kind: 'ai', editor: 'rendered' });
    expect(dom(editor).querySelector('.nsmd-change')).toBeNull();
    expect(editor.proposedChanges()).toEqual([]);
    editor.tiptap.chain().setTextSelection(positionOf(editor, 'Third')).insertContent(' new').run();
    expect(changes[1].origin).toEqual({ kind: 'user', editor: 'rendered' });
    editor.tiptap.commands.undo();
    expect(source.text).toBe(changed);
    editor.tiptap.commands.undo();
    expect(source.text).toBe(text);
  });

  it('gives the change the origin of the program that proposes it', async () => {
    const source = new TextSource(text);
    const changes: TextChange[] = [];
    source.onChange((change) => changes.push(change));
    const editor = open(source);
    const result = editor.proposeChange({ id: 'a', ...range(text, 'Third'), text: 'Last', origin: { kind: 'program', name: 'formatter' } });
    expect(dom(editor).querySelector('.nsmd-change-added')?.getAttribute('title')).toBe('Proposed by formatter');
    expect(editor.acceptChange('a')).toBe(true);
    expect(await result).toBe('accepted');
    expect(changes[0].origin).toEqual({ kind: 'program', name: 'formatter', editor: 'rendered' });
  });

  it('removes a rejected change and leaves the text', async () => {
    const source = new TextSource(text);
    const editor = open(source);
    const result = editor.proposeChange({ id: 'a', ...range(text, 'Third'), text: 'Last' });
    (dom(editor).querySelector('.nsmd-change-reject') as HTMLButtonElement).click();
    expect(await result).toBe('rejected');
    expect(source.text).toBe(text);
    expect(dom(editor).querySelector('.nsmd-change')).toBeNull();
    expect(editor.rejectChange('a')).toBe(false);
  });

  it('shows a change of several blocks as the old blocks struck through and the new blocks below them', async () => {
    const source = new TextSource(text);
    const editor = open(source);
    const old = 'paragraph.\n\nThird';
    const result = editor.proposeChange({ id: 'b', ...range(text, old), text: 'part.\n\n- one\n- two\n\nLast' });
    const removed = [...dom(editor).querySelectorAll('.nsmd-change-removed')].map((element) => element.textContent);
    expect(removed).toEqual(['Second paragraph.', 'Third paragraph.']);
    const block = dom(editor).querySelector('.nsmd-change-block');
    expect(block?.getAttribute('contenteditable')).toBe('false');
    const added = block?.querySelector('.nsmd-change-added');
    expect([...(added?.children ?? [])].map((element) => element.tagName)).toEqual(['P', 'UL', 'P']);
    expect(added?.textContent).toContain('Second part.');
    expect(added?.textContent).toContain('Last paragraph.');
    expect(editor.acceptChange('b')).toBe(true);
    expect(await result).toBe('accepted');
    expect(source.text).toBe(text.replace(old, 'part.\n\n- one\n- two\n\nLast'));
  });

  it('shows a new paragraph between two blocks', async () => {
    const source = new TextSource(text);
    const editor = open(source);
    const at = text.indexOf('\nSecond');
    const result = editor.proposeChange({ id: 'c', from: at, to: at, text: '\nNew paragraph.\n' });
    expect(dom(editor).querySelector('.nsmd-change-removed')).toBeNull();
    expect(dom(editor).querySelector('.nsmd-change-block .nsmd-change-added')?.textContent?.trim()).toBe('New paragraph.');
    expect(editor.acceptChange('c')).toBe(true);
    expect(await result).toBe('accepted');
    expect(source.text).toBe(text.replace('\nSecond', '\nNew paragraph.\n\nSecond'));
  });

  it('keeps a proposal through a change of the user in another block, and ends it after a change in its block', async () => {
    const source = new TextSource(text);
    const editor = open(source);
    const kept = editor.proposeChange({ id: 'kept', ...range(text, 'Third'), text: 'Last' });
    const outdated = editor.proposeChange({ id: 'outdated', ...range(text, 'Second'), text: 'Other' });
    editor.tiptap.chain().setTextSelection(positionOf(editor, 'Title')).insertContent(' new').run();
    expect(editor.proposedChanges().map((change) => change.id)).toEqual(['outdated', 'kept']);
    editor.tiptap.chain().setTextSelection(positionOf(editor, 'Second par')).insertContent('t').run();
    expect(await outdated).toBe('outdated');
    expect(editor.proposedChanges().map((change) => change.id)).toEqual(['kept']);
    expect(editor.acceptChange('kept')).toBe(true);
    expect(await kept).toBe('accepted');
    expect(source.text).toBe(text.replace('Title', 'Title new').replace('Second par', 'Second part').replace('Third', 'Last'));
  });

  it('ends a proposal after a change from outside in its block', async () => {
    const source = new TextSource(text);
    const editor = open(source);
    const result = editor.proposeChange({ id: 'a', ...range(text, 'Third'), text: 'Last' });
    source.setText(text.replace('Third', 'Fourth'), { kind: 'program', name: 'git' });
    expect(await result).toBe('outdated');
    expect(dom(editor).querySelector('.nsmd-change')).toBeNull();
  });

  it('ends a proposal with a range outside the text, and a proposal that a new one with its ID replaces', async () => {
    const source = new TextSource(text);
    const editor = open(source);
    expect(await editor.proposeChange({ id: 'a', from: 5, to: text.length + 1, text: 'x' })).toBe('outdated');
    const first = editor.proposeChange({ id: 'a', ...range(text, 'Third'), text: 'Last' });
    const second = editor.proposeChange({ id: 'a', ...range(text, 'Second'), text: 'Other' });
    expect(await first).toBe('outdated');
    expect(editor.proposedChanges()).toEqual([{ id: 'a', ...range(text, 'Second'), text: 'Other' }]);
    expect(editor.acceptChange('a')).toBe(true);
    expect(await second).toBe('accepted');
    expect(source.text).toBe(text.replace('Second', 'Other'));
  });

  it('accepts no change in read-only mode', () => {
    const source = new TextSource(text);
    const editor = open(source, { editable: false });
    void editor.proposeChange({ id: 'a', ...range(text, 'Third'), text: 'Last' });
    expect(editor.acceptChange('a')).toBe(false);
    expect(source.text).toBe(text);
    expect(editor.proposedChanges()).toHaveLength(1);
  });

  it('keeps the line breaks of Windows of the file', async () => {
    const windows = text.replace(/\n/g, '\r\n');
    const source = new TextSource(windows);
    const editor = open(source);
    const result = editor.proposeChange({ id: 'a', ...range(windows, 'bold'), text: 'strong' });
    expect(dom(editor).querySelector('.nsmd-change-removed')?.textContent).toBe('bold');
    expect(editor.acceptChange('a')).toBe(true);
    expect(await result).toBe('accepted');
    expect(source.text).toBe(windows.replace('bold', 'strong'));
  });

  it('shows a change across a mark as a change of its block', async () => {
    const source = new TextSource(text);
    const editor = open(source);
    const result = editor.proposeChange({ id: 'a', ...range(text, 'with **bold**'), text: 'with *bold*' });
    expect(dom(editor).querySelector('.nsmd-change-block')).not.toBeNull();
    expect(dom(editor).querySelector('.nsmd-change-removed')?.textContent).toBe('First paragraph with bold words.');
    expect(editor.acceptChange('a')).toBe(true);
    expect(await result).toBe('accepted');
    expect(source.text).toBe(text.replace('with **bold**', 'with *bold*'));
  });

  it('ends the open proposals when the editor closes', async () => {
    const source = new TextSource(text);
    const editor = open(source);
    const result = editor.proposeChange({ id: 'a', ...range(text, 'Third'), text: 'Last' });
    editor.destroy();
    editors.length = 0;
    expect(await result).toBe('outdated');
  });
});

describe('the context for the AI', () => {
  it('gives the text of the file, the selection in the text, the schema of the front matter and the format rules', () => {
    const withFrontMatter = `---\ntitle: A\n---\n\n${text}`;
    const source = new TextSource(withFrontMatter);
    const element = document.createElement('div');
    document.body.append(element);
    const schema: JsonSchema = { type: 'object', required: ['title'] };
    const editor = new MarkdownEditor(element, {
      source,
      frontMatterSchema: schema,
      plugins: [
        { name: 'notes', apiVersion: 1, formatRules: 'A note is a footnote.' },
        { name: 'empty', apiVersion: 1, formatRules: ' ' },
      ],
    });
    editors.push(editor);
    const end = positionOf(editor, 'bold');
    editor.tiptap.commands.setTextSelection({ from: end - 4, to: end });
    const context = editor.aiContext('docs/a.md');
    expect(context.document).toEqual({ name: 'docs/a.md', text: withFrontMatter });
    expect(withFrontMatter.slice(context.selection.from, context.selection.to)).toBe('bold');
    expect(context.frontMatterSchema).toEqual(schema);
    expect(context.formatRules).toEqual(['A note is a footnote.']);
    editor.tiptap.commands.setTextSelection(positionOf(editor, 'Second'));
    const cursor = editor.aiContext('docs/a.md').selection;
    expect(cursor.from).toBe(cursor.to);
    expect(withFrontMatter.slice(0, cursor.from).endsWith('Second')).toBe(true);
  });
});
