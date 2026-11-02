// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the tables (docs/editor.md, R-EDIT-008 to R-EDIT-010): each command of the table menu changes the
// table as one step of undo, and the editor writes the GFM table with its comments.

import type { Command } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor } from '../../editor';
import {
  alignColumn,
  colorCells,
  compareCells,
  deleteColumn,
  deleteRow,
  deleteTable,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  selectColumn,
  setWidths,
  sortColumn,
  tableAt,
  widthsWith,
} from './grid';
import { tableMenuItems } from './tableHandles';

let editor: MarkdownEditor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

const table = '| Name | Size |\n| --- | ---: |\n| b | 10 |\n| a | 9 |\n| C | 2.5 |\n';

/** open returns an editor with a text, and the position of its first table. */
function open(markdown: string): { opened: MarkdownEditor; pos: number } {
  const element = document.createElement('div');
  editor = new MarkdownEditor(element, { markdown });
  let pos = -1;
  editor.tiptap.state.doc.descendants((node, at) => {
    if (pos < 0 && node.type.name === 'table') {
      pos = at;
    }
    return pos < 0;
  });
  return { opened: editor, pos };
}

/** run runs a command in an editor and returns its Markdown. */
function run(opened: MarkdownEditor, command: Command): string {
  expect(command(opened.tiptap.state, opened.tiptap.view.dispatch)).toBe(true);
  return opened.getMarkdown();
}

describe('the commands of the tables', () => {
  it('insert rows and columns; a new first row becomes the header row', () => {
    const { opened, pos } = open(table);
    expect(run(opened, insertRow(pos, 2))).toBe('| Name | Size |\n| ---- | ---: |\n| b    |   10 |\n|      |      |\n| a    |    9 |\n| C    |  2.5 |\n');
    expect(run(opened, insertColumn(pos, 0))).toBe(
      '|     | Name | Size |\n| --- | ---- | ---: |\n|     | b    |   10 |\n|     |      |      |\n|     | a    |    9 |\n|     | C    |  2.5 |\n',
    );
    expect(run(opened, insertRow(pos, 0)).split('\n').slice(0, 3)).toEqual(['|     |      |      |', '| --- | ---- | ---: |', '|     | Name | Size |']);
  });

  it('move rows and columns, each as one step of undo', () => {
    const { opened, pos } = open(table);
    expect(run(opened, moveRow(pos, 2, 1))).toBe('| Name | Size |\n| ---- | ---: |\n| a    |    9 |\n| b    |   10 |\n| C    |  2.5 |\n');
    expect(run(opened, moveColumn(pos, 1, 0))).toBe('| Size | Name |\n| ---: | ---- |\n|    9 | a    |\n|   10 | b    |\n|  2.5 | C    |\n');
    opened.tiptap.commands.undo();
    expect(opened.getMarkdown()).toBe('| Name | Size |\n| ---- | ---: |\n| a    |    9 |\n| b    |   10 |\n| C    |  2.5 |\n');
    expect(run(opened, moveRow(pos, 1, 0)).split('\n')[0]).toBe('| a    |    9 |');
  });

  it('delete rows, columns and the table with its comment', () => {
    const { opened, pos } = open(`Text\n\n<!-- table: widths=50,50 -->\n${table}`);
    expect(run(opened, deleteRow(pos, 0))).toBe('Text\n\n<!-- table: widths=50,50 -->\n| b   |  10 |\n| --- | --: |\n| a   |   9 |\n| C   | 2.5 |\n');
    expect(run(opened, deleteColumn(pos, 1))).toBe('Text\n\n<!-- table: widths=50,50 -->\n| b   |\n| --- |\n| a   |\n| C   |\n');
    expect(run(opened, deleteTable(pos))).toBe('Text\n');
  });

  it('sort the body by a column: numbers as numbers, the header row stays first', () => {
    const { opened, pos } = open(table);
    expect(run(opened, sortColumn(pos, 1, false, 'en'))).toBe('| Name | Size |\n| ---- | ---: |\n| C    |  2.5 |\n| a    |    9 |\n| b    |   10 |\n');
    expect(run(opened, sortColumn(pos, 0, false, 'en'))).toBe('| Name | Size |\n| ---- | ---: |\n| a    |    9 |\n| b    |   10 |\n| C    |  2.5 |\n');
    expect(run(opened, sortColumn(pos, 0, true, 'en'))).toBe('| Name | Size |\n| ---- | ---: |\n| C    |  2.5 |\n| b    |   10 |\n| a    |    9 |\n');
  });

  it('compare texts in the order of the language and keep empty cells last', () => {
    const sorted = (language: string) => {
      const collator = new Intl.Collator(language, { numeric: true, sensitivity: 'base' });
      return ['z', '', 'ä', '10', '9', 'b'].sort((a, b) => compareCells(a, b, collator));
    };
    expect(sorted('de')).toEqual(['9', '10', 'ä', 'b', 'z', '']);
    expect(sorted('sv')).toEqual(['9', '10', 'b', 'z', 'ä', '']);
  });

  it('align a column in the delimiter row', () => {
    const { opened, pos } = open(table);
    expect(run(opened, alignColumn(pos, 0, 'center')).split('\n')[1]).toBe('| :--: | ---: |');
    expect(run(opened, alignColumn(pos, 1, null)).split('\n')[1]).toBe('| :--: | ---- |');
  });

  it('color cells with the comment at the start of the cell, and read the comment back', () => {
    const { opened, pos } = open(table);
    const colored = run(opened, colorCells(pos, [{ row: 1, column: 0 }, { row: 2, column: 1 }], 'yellow'));
    expect(colored.split('\n').slice(2, 4)).toEqual(['| <!--cell yellow--> b |                   10 |', '| a                    | <!--cell yellow--> 9 |']);
    const again = open(colored);
    const cell = tableAt(again.opened.tiptap.state.doc, again.pos)?.node.child(1).child(0);
    expect(cell?.attrs.background).toBe('yellow');
    expect(cell?.textContent).toBe('b');
    expect(again.opened.getMarkdown()).toBe(colored);
  });

  it('write the widths of the columns into the comment before the table', () => {
    const { opened, pos } = open(table);
    expect(run(opened, setWidths(pos, [30, 70]))).toBe(`<!-- table: widths=30,70 -->\n${table}`);
    const tablePos = pos + (opened.tiptap.state.doc.child(0).nodeSize);
    expect(run(opened, setWidths(tablePos, [40, 60]))).toBe(`<!-- table: widths=40,60 -->\n${table}`);
    expect(run(opened, setWidths(tablePos, null))).toBe(table);
    expect(widthsWith(undefined, 4, 1, 40)).toEqual([20, 40, 20, 20]);
    expect(widthsWith([50, 30, 20], 3, 0, 20)).toEqual([20, 48, 32]);
  });

  it('give the columns the widths of the comment and hide the comment', () => {
    const element = document.createElement('div');
    editor = new MarkdownEditor(element, { markdown: `<!-- table: widths=30,70 -->\n${table}` });
    expect(element.querySelector('.nsmd-table-widths')?.classList.contains('nsmd-hidden')).toBe(true);
    expect(element.querySelector<HTMLElement>('th')?.style.width).toBe('30%');
    expect(element.querySelector('.nsmd-table-fixed')).not.toBeNull();
  });

  it('show the items of the table menu for a column', () => {
    const { opened, pos } = open(table);
    selectColumn(pos, 1)(opened.tiptap.state, opened.tiptap.view.dispatch);
    expect(opened.tiptap.state.selection).toBeInstanceOf(CellSelection);
    const host = { ask: async () => undefined, language: () => 'en', insertItems: () => [], box: document.createElement('div'), menu: { open: () => undefined } as never };
    const ids = tableMenuItems(opened.tiptap.view, 'column', 1, host).map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(['insertColumnLeft', 'moveColumnLeft', 'sortAscending', 'alignRight', 'columnWidth', 'deleteColumn', 'color-red', 'deleteTable']));
    expect(ids).not.toContain('moveColumnRight');
  });

  it('add a row with Tab in the last cell', () => {
    const { opened } = open('| a |\n| --- |\n| b |\n');
    const view = opened.tiptap.view;
    opened.tiptap.commands.setTextSelection(view.state.doc.content.size - 3);
    const event = new KeyboardEvent('keydown', { key: 'Tab' });
    expect(view.someProp('handleKeyDown', (handle) => handle(view, event))).toBe(true);
    expect(opened.getMarkdown()).toBe('| a   |\n| --- |\n| b   |\n|     |\n');
  });
});
