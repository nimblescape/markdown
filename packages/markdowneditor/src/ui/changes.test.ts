// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the rendered changes (docs/editor.md, R-EDIT-012): the rows of the diff of the top-level blocks, the
// marks of the removed and the new blocks and words on each side, the spacers of the rows, the text of the other side
// after a change, and that the text of the file stays the same.

import { TextSource } from '@nimblescape/markdowntext';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor } from '../editor';
import { changeRows, changeStarts, rowsKey, spacerHeights, type ChangeSide } from './changes';

const editors: MarkdownEditor[] = [];
afterEach(() => {
  editors.forEach((editor) => editor.destroy());
  editors.length = 0;
  document.body.innerHTML = '';
});

/** open returns an editor of a text that shows its changes against another text. */
function open(text: string, other: string, side: ChangeSide) {
  const element = document.createElement('div');
  document.body.append(element);
  const source = new TextSource(text);
  const editor = new MarkdownEditor(element, { source, id: side });
  editors.push(editor);
  const changes = editor.showChanges({ side, other });
  return { editor, source, element, changes };
}

/** marked returns the texts of the elements of a class in an element. */
const marked = (element: HTMLElement, name: string) => [...element.querySelectorAll(`.${name}`)].map((node) => node.textContent);

const older = '# Title\n\nThe first paragraph stays.\n\nThe old words of the second paragraph.\n\nA paragraph that goes.\n';
const newer = '# Title\n\nThe first paragraph stays.\n\nThe new words of the second paragraph.\n\n- A new list\n- with two items\n\nOne more paragraph.\n';

describe('the rows of a diff', () => {
  it('pairs equal blocks, compares a changed pair word by word, and keeps the rest of a run in one row', () => {
    expect(changeRows(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'y', 'z'])).toEqual([
      { original: [0, 1], modified: [0, 1], kind: 'same' },
      { original: [1, 2], modified: [1, 2], kind: 'changed' },
      { original: [2, 3], modified: [2, 3], kind: 'same' },
      { original: [3, 4], modified: [3, 5], kind: 'other' },
    ]);
  });

  it('gives a row without blocks to the side that has none', () => {
    expect(changeRows(['a', 'b'], ['a'])).toEqual([
      { original: [0, 1], modified: [0, 1], kind: 'same' },
      { original: [1, 2], modified: [1, 1], kind: 'other' },
    ]);
    expect(changeRows(['a'], ['n', 'a'])).toEqual([
      { original: [0, 0], modified: [0, 1], kind: 'other' },
      { original: [0, 1], modified: [1, 2], kind: 'same' },
    ]);
  });

  it('gives the spacers what each row lacks against the other side, and the starts of the changes', () => {
    expect(spacerHeights([20, 40, 0], [30, 10, 25])).toEqual([10, 0, 25]);
    const rows = changeRows(['a', 'b', 'c', 'd', 'e'], ['a', 'x', 'y', 'd', 'z']);
    expect(changeStarts(rows)).toEqual([1, 4]);
    expect(rowsKey(rows)).toBe(rowsKey(changeRows(['a', 'b', 'c', 'd', 'e'], ['a', 'x', 'y', 'd', 'z'])));
  });
});

describe('the marks of the changes', () => {
  it('marks the removed blocks and words on the side of the older version', () => {
    const { element, source } = open(older, newer, 'original');
    expect(element.classList.contains('nsmd-diff-original')).toBe(true);
    expect(marked(element, 'nsmd-diff-changed')).toEqual(['The old words of the second paragraph.']);
    expect(marked(element, 'nsmd-diff-word')).toEqual(['old']);
    expect(marked(element, 'nsmd-diff-block')).toEqual(['A paragraph that goes.']);
    expect(source.text).toBe(older);
  });

  it('pairs the similar blocks at the start and at the end of a run of changes', () => {
    const rows = changeRows(['a', 'b', 'c'], ['x', 'y', 'z', 'w'], { sameKind: () => true, similar: (a, b) => (a === 0 && b === 0) || (a === 2 && b === 3) });
    expect(rows).toEqual([
      { original: [0, 1], modified: [0, 1], kind: 'changed' },
      { original: [1, 2], modified: [1, 3], kind: 'other' },
      { original: [2, 3], modified: [3, 4], kind: 'changed' },
    ]);
  });

  it('marks the new blocks on the side of the newer version, and the changed words of a pair of blocks', () => {
    const { element } = open('# Title\n\nThe old words.\n\nStays.\n', '# Title\n\nThe new words.\n\nStays.\n', 'modified');
    expect(marked(element, 'nsmd-diff-changed')).toEqual(['The old words.']);
    expect(marked(element, 'nsmd-diff-word')).toEqual(['old']);
    const other = open('# Title\n\nThe new words.\n\nStays.\n', '# Title\n\nThe old words.\n\nStays.\n', 'original');
    expect(marked(other.element, 'nsmd-diff-word')).toEqual(['new']);
  });

  it('marks the changed words inside a list and a table', () => {
    const { element } = open('- one\n- two words\n', '- one\n- two other words\n', 'modified');
    expect(marked(element, 'nsmd-diff-changed').length).toBe(1);
    expect(marked(element, 'nsmd-diff-word')).toEqual([]);
    const table = open('| A | B |\n| --- | --- |\n| 1 | 2 |\n', '| A | B |\n| --- | --- |\n| 1 | 3 |\n', 'modified');
    expect(marked(table.element, 'nsmd-diff-word')).toEqual(['2']);
  });

  it('puts a spacer at the end of each row, also for a row without blocks on this side', () => {
    const { element, changes } = open(older, newer, 'modified');
    expect(changes.rows.map((row) => row.kind)).toEqual(['same', 'same', 'changed', 'other']);
    expect(element.querySelectorAll('.nsmd-diff-spacer:not(.nsmd-diff-lead)').length).toBe(4);
    expect(element.querySelectorAll('.nsmd-diff-lead').length).toBe(1);
    const only = open('Stays.\n', 'Stays.\n\nGoes.\n', 'modified');
    expect(only.changes.rows).toEqual([
      { original: [0, 1], modified: [0, 1], kind: 'same' },
      { original: [1, 2], modified: [1, 1], kind: 'other' },
    ]);
    expect(only.element.querySelectorAll('.nsmd-diff-spacer:not(.nsmd-diff-lead)').length).toBe(2);
  });

  it('follows a change of this side and a new text of the other side', () => {
    const { editor, element, changes, source } = open('# Title\n\nSame.\n', '# Title\n\nSame.\n', 'modified');
    expect(marked(element, 'nsmd-diff-block')).toEqual([]);
    editor.tiptap.chain().insertContentAt(editor.tiptap.state.doc.content.size, '<p>Added.</p>').run();
    expect(marked(element, 'nsmd-diff-block')).toEqual(['Added.']);
    changes.setOther('# Title\n\nSame.\n\nAdded.\n');
    expect(marked(element, 'nsmd-diff-block')).toEqual([]);
    changes.setOther('# Other title\n\nSame.\n\nAdded.\n');
    expect(marked(element, 'nsmd-diff-word')).toEqual(['Title']);
    expect(source.text).toBe('# Title\n\nSame.\n\nAdded.\n');
  });

  it('keeps the text of the other side after a new text of this side, and removes the marks with hideChanges', () => {
    const { editor, element } = open('One.\n', 'Two.\n', 'modified');
    editor.setMarkdown('One.\n\nThree.\n');
    expect(marked(element, 'nsmd-diff-changed')).toEqual(['One.']);
    expect(marked(element, 'nsmd-diff-block')).toEqual(['Three.']);
    editor.hideChanges();
    expect(element.querySelectorAll('.nsmd-diff-block, .nsmd-diff-spacer').length).toBe(0);
    expect(element.classList.contains('nsmd-diff')).toBe(false);
  });
});
