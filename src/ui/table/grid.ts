// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The commands of the tables (docs/editor.md, R-EDIT-008 to R-EDIT-010): insert, move, delete, sort, align and color
// rows, columns and cells, and the widths of the columns. A GFM table is a grid without merged cells, whose first row
// is the header row; each command writes the whole table again in one transaction, so each is one step of undo
// (R-EDIT-001), and the first row always holds header cells. The alignment of a column is the alignment of its cells
// (R-EDIT-009); the color of a cell and the widths of the columns are the comments of R-EDIT-010.

import { closeHistory } from '@tiptap/pm/history';
import type { Node, Schema } from '@tiptap/pm/model';
import { type Command, type EditorState, TextSelection, type Transaction } from '@tiptap/pm/state';
import { CellSelection, TableMap } from '@tiptap/pm/tables';
import { widthsPattern } from '../../markdown/tableComments';

/** Alignment is the alignment of a column. */
export type Alignment = 'left' | 'center' | 'right' | null;

/** cellColors are the colors of the cells, as the comments `<!--cell red-->` name them. */
export const cellColors = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;

/** CellColor is the color of a cell. */
export type CellColor = (typeof cellColors)[number];

/** TableAt is a table of the document: its position and its node. */
export interface TableAt {
  pos: number;
  node: Node;
}

/**
 * tableAt returns the table around a position, or undefined outside a table.
 * @param doc - The document.
 * @param pos - The position.
 */
export function tableAt(doc: Node, pos: number): TableAt | undefined {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.spec.tableRole === 'table') {
      return { pos: $pos.before(depth), node };
    }
  }
  const after = $pos.nodeAfter;
  return after?.type.spec.tableRole === 'table' ? { pos: $pos.pos, node: after } : undefined;
}

/** rowsOf returns the cells of a table, row by row. */
export function rowsOf(table: Node): Node[][] {
  const rows: Node[][] = [];
  table.forEach((row) => {
    const cells: Node[] = [];
    row.forEach((cell) => cells.push(cell));
    rows.push(cells);
  });
  return rows;
}

/** emptyCell returns an empty cell of a type with the alignment of its column. */
function emptyCell(schema: Schema, header: boolean, align: Alignment): Node {
  const type = header ? schema.nodes.tableHeader : schema.nodes.tableCell;
  return type.create({ align }, schema.nodes.paragraph.create());
}

/**
 * tableOf returns a table with rows of cells. The cells of the first row become header cells and the cells of the
 * other rows plain cells, with their attributes and their content.
 * @param table - The table whose type and attributes the new table keeps.
 * @param rows - The cells, row by row.
 */
export function tableOf(table: Node, rows: readonly (readonly Node[])[]): Node {
  const { schema } = table.type;
  const rowType = schema.nodes.tableRow;
  return table.type.create(
    table.attrs,
    rows.map((cells, index) => {
      const type = index === 0 ? schema.nodes.tableHeader : schema.nodes.tableCell;
      return rowType.create(
        null,
        cells.map((cell) => (cell.type === type ? cell : type.create(cell.attrs, cell.content, cell.marks))),
      );
    }),
  );
}

/** replaceTable replaces a table with a new one and keeps the cursor in the same cell when it still exists. */
function replaceTable(state: EditorState, table: TableAt, rows: readonly (readonly Node[])[], cursor?: { row: number; column: number }): Transaction {
  const tr = state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, tableOf(table.node, rows));
  if (cursor) {
    const node = tr.doc.nodeAt(table.pos);
    if (node) {
      const map = TableMap.get(node);
      const row = Math.max(0, Math.min(cursor.row, map.height - 1));
      const column = Math.max(0, Math.min(cursor.column, map.width - 1));
      const cellPos = table.pos + 1 + map.map[row * map.width + column];
      tr.setSelection(TextSelection.near(tr.doc.resolve(cellPos + 1)));
    }
  }
  // Each command is one step of undo, also right after another command (R-EDIT-001).
  return closeHistory(tr).scrollIntoView();
}

/**
 * insertRow inserts an empty row at an index; 0 inserts a new header row, and the old header row becomes a row of the
 * body.
 * @param pos - The position of the table.
 * @param index - The index of the new row.
 */
export function insertRow(pos: number, index: number): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    if (!table) {
      return false;
    }
    const rows = rowsOf(table.node);
    const at = Math.max(0, Math.min(index, rows.length));
    const aligns = (rows[0] ?? []).map((cell) => cell.attrs.align as Alignment);
    rows.splice(
      at,
      0,
      aligns.map((align) => emptyCell(state.schema, at === 0, align)),
    );
    dispatch?.(replaceTable(state, table, rows, { row: at, column: 0 }));
    return true;
  };
}

/**
 * insertColumn inserts an empty column at an index.
 * @param pos - The position of the table.
 * @param index - The index of the new column.
 */
export function insertColumn(pos: number, index: number): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    if (!table) {
      return false;
    }
    const rows = rowsOf(table.node);
    const at = Math.max(0, Math.min(index, rows[0]?.length ?? 0));
    rows.forEach((cells, row) => cells.splice(at, 0, emptyCell(state.schema, row === 0, null)));
    dispatch?.(replaceTable(state, table, rows, { row: 0, column: at }));
    return true;
  };
}

/** moved returns a list with the item at one index moved to another index. */
function moved<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

/**
 * moveRow moves a row to another index. A row moved to the index 0 becomes the header row.
 * @param pos - The position of the table.
 * @param from - The index of the row.
 * @param to - The new index of the row.
 */
export function moveRow(pos: number, from: number, to: number): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    if (!table || from === to || from < 0 || to < 0 || from >= table.node.childCount || to >= table.node.childCount) {
      return false;
    }
    dispatch?.(replaceTable(state, table, moved(rowsOf(table.node), from, to), { row: to, column: 0 }));
    return true;
  };
}

/**
 * moveColumn moves a column to another index, with the alignment of its cells.
 * @param pos - The position of the table.
 * @param from - The index of the column.
 * @param to - The new index of the column.
 */
export function moveColumn(pos: number, from: number, to: number): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    const width = table?.node.firstChild?.childCount ?? 0;
    if (!table || from === to || from < 0 || to < 0 || from >= width || to >= width) {
      return false;
    }
    dispatch?.(replaceTable(state, table, rowsOf(table.node).map((cells) => moved(cells, from, to)), { row: 0, column: to }));
    return true;
  };
}

/**
 * deleteRow deletes a row; the row after a deleted header row becomes the header row. Without rows left, the table is
 * deleted.
 * @param pos - The position of the table.
 * @param index - The index of the row.
 */
export function deleteRow(pos: number, index: number): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    if (!table || index < 0 || index >= table.node.childCount) {
      return false;
    }
    if (table.node.childCount === 1) {
      return deleteTable(pos)(state, dispatch);
    }
    const rows = rowsOf(table.node);
    rows.splice(index, 1);
    dispatch?.(replaceTable(state, table, rows, { row: index, column: 0 }));
    return true;
  };
}

/**
 * deleteColumn deletes a column. Without columns left, the table is deleted.
 * @param pos - The position of the table.
 * @param index - The index of the column.
 */
export function deleteColumn(pos: number, index: number): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    const width = table?.node.firstChild?.childCount ?? 0;
    if (!table || index < 0 || index >= width) {
      return false;
    }
    if (width === 1) {
      return deleteTable(pos)(state, dispatch);
    }
    const rows = rowsOf(table.node).map((cells) => cells.filter((_cell, column) => column !== index));
    dispatch?.(replaceTable(state, table, rows, { row: 0, column: index }));
    return true;
  };
}

/**
 * deleteTable deletes a table, with the comment of the widths of its columns.
 * @param pos - The position of the table.
 */
export function deleteTable(pos: number): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    if (!table) {
      return false;
    }
    const widths = widthsComment(state.doc, table.pos);
    const from = widths ? widths.pos : table.pos;
    const tr = state.tr.delete(from, table.pos + table.node.nodeSize);
    dispatch?.(closeHistory(tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(from, tr.doc.content.size))))).scrollIntoView());
    return true;
  };
}

/** numberOf returns the number that the text of a cell holds, or undefined for a text that is not a number. */
function numberOf(text: string): number | undefined {
  const trimmed = text.trim().replace(/\s/g, '');
  if (!/^[-+]?(\d+([.,]\d+)?|[.,]\d+)%?$/.test(trimmed)) {
    return undefined;
  }
  return Number(trimmed.replace('%', '').replace(',', '.'));
}

/**
 * compareCells compares the texts of two cells for sorting (R-EDIT-009): numbers as numbers and before texts, texts in
 * the order of the language of the document, and empty cells last.
 * @param a - The text of the first cell.
 * @param b - The text of the second cell.
 * @param collator - The order of the texts.
 */
export function compareCells(a: string, b: string, collator: Intl.Collator): number {
  const emptyA = a.trim() === '';
  const emptyB = b.trim() === '';
  if (emptyA || emptyB) {
    return Number(emptyA) - Number(emptyB);
  }
  const numberA = numberOf(a);
  const numberB = numberOf(b);
  if (numberA !== undefined && numberB !== undefined) {
    return numberA - numberB;
  }
  if (numberA !== undefined || numberB !== undefined) {
    return numberA !== undefined ? -1 : 1;
  }
  return collator.compare(a, b);
}

/**
 * sortColumn sorts the rows of the body of a table by the texts of a column; the header row stays first. Rows with
 * the same text keep their order.
 * @param pos - The position of the table.
 * @param column - The index of the column.
 * @param descending - true for the order from the last to the first.
 * @param language - The language of the document, for the order of texts, or undefined for the language of the page.
 */
export function sortColumn(pos: number, column: number, descending: boolean, language?: string): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    if (!table || table.node.childCount < 3) {
      return false;
    }
    const collator = new Intl.Collator(language || undefined, { numeric: true, sensitivity: 'base' });
    const [header, ...body] = rowsOf(table.node);
    const sorted = body
      .map((cells, index) => ({ cells, index, text: cells[column]?.textContent ?? '' }))
      .sort((a, b) => {
        // Empty cells stay last in both orders.
        const order = compareCells(a.text, b.text, collator);
        const flip = descending && a.text.trim() !== '' && b.text.trim() !== '' ? -order : order;
        return flip || a.index - b.index;
      })
      .map((row) => row.cells);
    dispatch?.(replaceTable(state, table, [header, ...sorted], { row: 0, column }));
    return true;
  };
}

/**
 * alignColumn sets the alignment of a column, which the delimiter row of GFM records (R-EDIT-009).
 * @param pos - The position of the table.
 * @param column - The index of the column.
 * @param align - The alignment, or null for none.
 */
export function alignColumn(pos: number, column: number, align: Alignment): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    if (!table) {
      return false;
    }
    const rows = rowsOf(table.node).map((cells) => cells.map((cell, index) => (index === column ? cell.type.create({ ...cell.attrs, align }, cell.content, cell.marks) : cell)));
    const { selection } = state;
    dispatch?.(replaceTable(state, table, rows, selection instanceof CellSelection ? undefined : { row: 0, column }));
    return true;
  };
}

/** Cell is a cell of a table by its row and its column. */
export interface Cell {
  row: number;
  column: number;
}

/**
 * colorCells sets the color of cells (R-EDIT-010).
 * @param pos - The position of the table.
 * @param cells - The cells.
 * @param color - The color, or null for none.
 */
export function colorCells(pos: number, cells: readonly Cell[], color: CellColor | null): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    if (!table || cells.length === 0) {
      return false;
    }
    const chosen = new Set(cells.map((cell) => `${cell.row}:${cell.column}`));
    const rows = rowsOf(table.node).map((row, rowIndex) =>
      row.map((cell, column) => (chosen.has(`${rowIndex}:${column}`) ? cell.type.create({ ...cell.attrs, background: color }, cell.content, cell.marks) : cell)),
    );
    dispatch?.(replaceTable(state, table, rows));
    return true;
  };
}

/**
 * selectedCells returns the cells of the selection in a table: the cells of a cell selection, or the cell of the cursor.
 * @param state - The state of the editor.
 * @param table - The table.
 */
export function selectedCells(state: EditorState, table: TableAt): Cell[] {
  const map = TableMap.get(table.node);
  const start = table.pos + 1;
  const { selection } = state;
  if (selection instanceof CellSelection) {
    const rect = map.rectBetween(selection.$anchorCell.pos - start, selection.$headCell.pos - start);
    const cells: Cell[] = [];
    for (let row = rect.top; row < rect.bottom; row++) {
      for (let column = rect.left; column < rect.right; column++) {
        cells.push({ row, column });
      }
    }
    return cells;
  }
  const cell = cellOf(state.doc, table, selection.from);
  return cell ? [cell] : [];
}

/**
 * cellOf returns the row and the column of the cell at a position of a table.
 * @param doc - The document.
 * @param table - The table.
 * @param pos - The position inside the cell.
 */
export function cellOf(doc: Node, table: TableAt, pos: number): Cell | undefined {
  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const role = $pos.node(depth).type.spec.tableRole as string | undefined;
    if ((role === 'cell' || role === 'header_cell') && $pos.before(depth - 2) === table.pos) {
      return { row: $pos.index(depth - 2), column: $pos.index(depth - 1) };
    }
  }
  return undefined;
}

/**
 * selectRow selects the cells of a row.
 * @param pos - The position of the table.
 * @param row - The index of the row.
 */
export function selectRow(pos: number, row: number): Command {
  return (state, dispatch) => selectRect(state, pos, { row, column: 0 }, { row, column: Number.MAX_SAFE_INTEGER }, dispatch);
}

/**
 * selectColumn selects the cells of a column.
 * @param pos - The position of the table.
 * @param column - The index of the column.
 */
export function selectColumn(pos: number, column: number): Command {
  return (state, dispatch) => selectRect(state, pos, { row: 0, column }, { row: Number.MAX_SAFE_INTEGER, column }, dispatch);
}

/** selectRect selects the cells between two cells of a table. */
function selectRect(state: EditorState, pos: number, from: Cell, to: Cell, dispatch?: (tr: Transaction) => void): boolean {
  const table = tableAt(state.doc, pos);
  if (!table) {
    return false;
  }
  const map = TableMap.get(table.node);
  const at = (cell: Cell) => table.pos + 1 + map.map[Math.min(cell.row, map.height - 1) * map.width + Math.min(cell.column, map.width - 1)];
  dispatch?.(state.tr.setSelection(CellSelection.create(state.doc, at(from), at(to))));
  return true;
}

/** WidthsComment is the comment of the widths of the columns of a table, on the line before the table. */
export interface WidthsComment {
  /** pos is the position of the HTML block of the comment. */
  pos: number;
  widths: number[];
}

/**
 * widthsComment returns the comment of the widths of the columns of the table at a position: the HTML block right
 * before the table (R-EDIT-010).
 * @param doc - The document.
 * @param pos - The position of the table.
 */
export function widthsComment(doc: Node, pos: number): WidthsComment | undefined {
  const $pos = doc.resolve(pos);
  const before = $pos.nodeBefore;
  if (before?.type.name !== 'htmlBlock') {
    return undefined;
  }
  const found = widthsPattern.exec(((before.attrs.html as string) ?? '').trim());
  return found ? { pos: pos - before.nodeSize, widths: found[1].split(',').map((width) => Number(width.trim())) } : undefined;
}

/**
 * setWidths writes the widths of the columns of a table in percent into the comment before the table, or removes the
 * comment for null (R-EDIT-010).
 * @param pos - The position of the table.
 * @param widths - The widths in percent, one for each column, or null for widths that follow the text.
 */
export function setWidths(pos: number, widths: readonly number[] | null): Command {
  return (state, dispatch) => {
    const table = tableAt(state.doc, pos);
    const htmlBlock = state.schema.nodes.htmlBlock;
    if (!table || !htmlBlock) {
      return false;
    }
    const comment = widthsComment(state.doc, table.pos);
    const tr = state.tr;
    if (widths === null) {
      if (!comment) {
        return false;
      }
      tr.delete(comment.pos, table.pos);
    } else {
      const node = htmlBlock.create({ html: `<!-- table: widths=${widths.map((width) => Math.round(width)).join(',')} -->` });
      if (comment) {
        tr.replaceWith(comment.pos, table.pos, node);
      } else {
        tr.insert(table.pos, node);
      }
    }
    dispatch?.(closeHistory(tr));
    return true;
  };
}

/**
 * widthsWith returns the widths of the columns in percent with one column at a new width, and the other columns
 * sharing the rest in the proportion that they had.
 * @param current - The widths now, or undefined for equal widths.
 * @param columns - The number of columns.
 * @param column - The index of the changed column.
 * @param width - The new width of the column in percent.
 */
export function widthsWith(current: readonly number[] | undefined, columns: number, column: number, width: number): number[] {
  const base = current && current.length === columns ? [...current] : Array.from({ length: columns }, () => 100 / columns);
  const chosen = Math.max(1, Math.min(columns === 1 ? 100 : 99, width));
  const others = base.reduce((sum, value, index) => (index === column ? sum : sum + value), 0);
  const rest = 100 - chosen;
  const result = base.map((value, index) => (index === column ? chosen : others > 0 ? (value / others) * rest : rest / (columns - 1)));
  // The rounded widths add up to 100: the rounding error goes to the last other column.
  const rounded = result.map((value) => Math.round(value));
  const error = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const last = column === columns - 1 ? columns - 2 : columns - 1;
  if (last >= 0) {
    rounded[last] += error;
  }
  return rounded;
}
