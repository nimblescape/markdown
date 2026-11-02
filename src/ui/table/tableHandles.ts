// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The handles and markers of the tables (docs/editor.md, R-EDIT-008, R-EDIT-009): over a row, a handle shows at its
// left edge; over a column, at its top edge. A click on a handle selects the row or the column and opens the table
// menu; a drag moves it. Over the border between two rows or two columns, a marker "+" shows; a click inserts a row or
// a column there. Tab in the last cell adds a row, as the table extension of the engine does.

import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { button, element, icon } from '../dom';
import type { Menu, MenuItem } from '../menu';
import {
  type Alignment,
  alignColumn,
  cellColors,
  colorCells,
  deleteColumn,
  deleteRow,
  deleteTable,
  insertColumn,
  insertRow,
  moveColumn,
  moveRow,
  selectColumn,
  selectedCells,
  selectRow,
  setWidths,
  sortColumn,
  type TableAt,
  tableAt,
  widthsComment,
  widthsWith,
} from './grid';

/** TableHandleHost is what the handles of the tables need from the editor. */
export interface TableHandleHost {
  box: HTMLElement;
  menu: Menu;
  /** ask asks the user for a text, for example the width of a column. */
  ask: (label: string, value?: string) => Promise<string | undefined>;
  /** language returns the language of the document, for the order of the texts of a sorted column. */
  language: () => string | undefined;
  /** insertItems returns the items of the insert menu. */
  insertItems: () => MenuItem[];
  /** menuOpened is called after the table menu opens, for example to hide the format bar. */
  menuOpened?: () => void;
}

/** Hover is the cell under the mouse: the table element, its row and its column. */
interface Hover {
  table: HTMLTableElement;
  row: number;
  column: number;
}

/** Axis is a row or a column. */
type Axis = 'row' | 'column';

/** colorNames are the names of the colors of the cells in the menu. */
const colorNames: Record<string, string> = { gray: 'Gray', red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue', purple: 'Purple' };

/** TableHandles are the handles and the markers of the table under the mouse. */
export class TableHandles {
  private readonly rowGrip: HTMLButtonElement;
  private readonly columnGrip: HTMLButtonElement;
  private readonly rowMarker: HTMLButtonElement;
  private readonly columnMarker: HTMLButtonElement;
  private readonly dropLine: HTMLElement;
  private readonly parts: HTMLElement[];
  private hover: Hover | undefined;
  private rowBorder = -1;
  private columnBorder = -1;
  private drag: { axis: Axis; index: number; x: number; y: number; moving: boolean; target: number } | undefined;

  /**
   * @param view - The view of the editor.
   * @param host - The box, the menu and the helpers of the editor.
   */
  constructor(
    private readonly view: EditorView,
    private readonly host: TableHandleHost,
  ) {
    this.rowGrip = this.grip('row', 'Drag to move the row, click for the table menu');
    this.columnGrip = this.grip('column', 'Drag to move the column, click for the table menu');
    this.rowMarker = button('Insert a row here', icon('plus'), () => this.insertAtBorder('row'));
    this.columnMarker = button('Insert a column here', icon('plus'), () => this.insertAtBorder('column'));
    this.rowMarker.classList.add('nsmd-table-marker');
    this.columnMarker.classList.add('nsmd-table-marker');
    this.dropLine = element('div', { class: 'nsmd-table-drop', hidden: true });
    this.parts = [this.rowGrip, this.columnGrip, this.rowMarker, this.columnMarker];
    for (const part of this.parts) {
      part.hidden = true;
      host.box.append(part);
    }
    host.box.append(this.dropLine);
    host.box.addEventListener('mousemove', this.onMove);
    host.box.addEventListener('mouseleave', this.onLeave);
  }

  /** hide hides the handles and the markers, but not while the table menu is open. */
  hide(): void {
    if (this.host.menu.isOpen && this.host.menu.owner === 'table') {
      return;
    }
    for (const part of this.parts) {
      part.hidden = true;
    }
    this.hover = undefined;
  }

  /** destroy removes the handles from the page. */
  destroy(): void {
    this.host.box.removeEventListener('mousemove', this.onMove);
    this.host.box.removeEventListener('mouseleave', this.onLeave);
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    for (const part of [...this.parts, this.dropLine]) {
      part.remove();
    }
  }

  private grip(axis: Axis, label: string): HTMLButtonElement {
    const grip = element('button', { type: 'button', class: `nsmd-button nsmd-table-grip nsmd-table-grip-${axis}`, title: label, 'aria-label': label }, icon('handle'));
    grip.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const index = axis === 'row' ? this.hover?.row : this.hover?.column;
      if (index === undefined || event.button !== 0) {
        return;
      }
      this.drag = { axis, index, x: event.clientX, y: event.clientY, moving: false, target: index };
      document.addEventListener('mousemove', this.onDragMove);
      document.addEventListener('mouseup', this.onDragEnd);
    });
    return grip;
  }

  private readonly onLeave = (event: MouseEvent) => {
    const next = event.relatedTarget;
    if (!(next instanceof globalThis.Node && this.parts.some((part) => part.contains(next))) && !this.drag) {
      this.hide();
    }
  };

  private readonly onMove = (event: MouseEvent) => {
    if (this.drag) {
      return;
    }
    const target = event.target as Element | null;
    if (target && this.parts.some((part) => part.contains(target))) {
      return;
    }
    if (!this.view.editable) {
      this.hide();
      return;
    }
    const cell = target?.closest?.('td, th');
    const table = cell?.closest('table');
    if (!cell || !table || !this.view.dom.contains(table)) {
      this.hide();
      return;
    }
    const row = (cell.parentElement as HTMLTableRowElement).sectionRowIndex;
    const column = (cell as HTMLTableCellElement).cellIndex;
    this.hover = { table, row, column };
    this.placeGrips(cell as HTMLElement);
    this.placeMarkers(event);
  };

  /** at returns a point of the page as a position in the box of the editor. */
  private at(left: number, top: number): { left: string; top: string } {
    const frame = this.host.box.getBoundingClientRect();
    return { left: `${Math.round(left - frame.left)}px`, top: `${Math.round(top - frame.top + this.host.box.scrollTop)}px` };
  }

  private placeGrips(cell: HTMLElement): void {
    if (!this.hover) {
      return;
    }
    const table = this.hover.table.getBoundingClientRect();
    const box = cell.getBoundingClientRect();
    const row = (cell.parentElement as HTMLElement).getBoundingClientRect();
    this.rowGrip.hidden = false;
    this.columnGrip.hidden = false;
    Object.assign(this.rowGrip.style, this.at(table.left - this.rowGrip.offsetWidth / 2, row.top + row.height / 2 - this.rowGrip.offsetHeight / 2));
    Object.assign(this.columnGrip.style, this.at(box.left + box.width / 2 - this.columnGrip.offsetWidth / 2, table.top - this.columnGrip.offsetHeight / 2));
  }

  /** borders returns the borders between the rows or the columns of the table, on the page. */
  private borders(axis: Axis): number[] {
    const table = this.hover?.table;
    if (!table) {
      return [];
    }
    if (axis === 'row') {
      const rows = [...table.rows].map((row) => row.getBoundingClientRect());
      return rows.length > 0 ? [rows[0].top, ...rows.map((rect) => rect.bottom)] : [];
    }
    const cells = [...(table.rows[0]?.cells ?? [])].map((cell) => cell.getBoundingClientRect());
    return cells.length > 0 ? [cells[0].left, ...cells.map((rect) => rect.right)] : [];
  }

  /** placeMarkers shows the marker "+" of the border of a row or of a column near the mouse. */
  private placeMarkers(event: MouseEvent): void {
    const table = this.hover?.table.getBoundingClientRect();
    if (!table) {
      return;
    }
    const near = (borders: number[], point: number) => borders.findIndex((border) => Math.abs(border - point) <= 6);
    // A row above the header row would be a new header row: the markers start below the header row.
    const rowBorder = near(this.borders('row'), event.clientY);
    this.rowBorder = rowBorder > 0 ? rowBorder : -1;
    this.columnBorder = near(this.borders('column'), event.clientX);
    this.rowMarker.hidden = this.rowBorder < 0;
    this.columnMarker.hidden = this.columnBorder < 0;
    if (this.rowBorder >= 0) {
      const y = this.borders('row')[this.rowBorder];
      Object.assign(this.rowMarker.style, this.at(table.left - this.rowMarker.offsetWidth - this.rowGrip.offsetWidth / 2 - 2, y - this.rowMarker.offsetHeight / 2));
    }
    if (this.columnBorder >= 0) {
      const x = this.borders('column')[this.columnBorder];
      Object.assign(this.columnMarker.style, this.at(x - this.columnMarker.offsetWidth / 2, table.top - this.columnMarker.offsetHeight - this.columnGrip.offsetHeight / 2 - 2));
    }
  }

  /** current returns the table of the hovered cell in the document. */
  private current(): TableAt | undefined {
    const cell = this.hover?.table.rows[this.hover.row]?.cells[this.hover.column];
    if (!cell) {
      return undefined;
    }
    try {
      return tableAt(this.view.state.doc, this.view.posAtDOM(cell, 0));
    } catch {
      return undefined;
    }
  }

  private run(command: (state: EditorView['state'], dispatch: EditorView['dispatch']) => boolean): void {
    command(this.view.state, this.view.dispatch);
    this.view.focus();
  }

  private insertAtBorder(axis: Axis): void {
    const table = this.current();
    const border = axis === 'row' ? this.rowBorder : this.columnBorder;
    if (!table || border < 0) {
      return;
    }
    this.run(axis === 'row' ? insertRow(table.pos, border) : insertColumn(table.pos, border));
    this.hide();
  }

  private readonly onDragMove = (event: MouseEvent) => {
    const drag = this.drag;
    if (!drag || !this.hover) {
      return;
    }
    if (!drag.moving && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) {
      return;
    }
    drag.moving = true;
    const borders = this.borders(drag.axis);
    const point = drag.axis === 'row' ? event.clientY : event.clientX;
    let border = 0;
    borders.forEach((value, index) => {
      if (Math.abs(value - point) < Math.abs(borders[border] - point)) {
        border = index;
      }
    });
    // A drop at a border puts the row or the column between the two beside it.
    drag.target = border > drag.index ? border - 1 : border;
    const table = this.hover.table.getBoundingClientRect();
    this.dropLine.hidden = false;
    this.dropLine.classList.toggle('nsmd-table-drop-column', drag.axis === 'column');
    if (drag.axis === 'row') {
      Object.assign(this.dropLine.style, this.at(table.left, borders[border] - 1), { width: `${Math.round(table.width)}px`, height: '2px' });
    } else {
      Object.assign(this.dropLine.style, this.at(borders[border] - 1, table.top), { width: '2px', height: `${Math.round(table.height)}px` });
    }
  };

  private readonly onDragEnd = () => {
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    const drag = this.drag;
    this.drag = undefined;
    this.dropLine.hidden = true;
    const table = this.current();
    if (!drag || !table) {
      return;
    }
    if (!drag.moving) {
      this.openMenu(drag.axis, drag.index, table);
      return;
    }
    if (drag.target !== drag.index) {
      this.run(drag.axis === 'row' ? moveRow(table.pos, drag.index, drag.target) : moveColumn(table.pos, drag.index, drag.target));
    }
    this.hide();
  };

  /** openMenu selects a row or a column and opens the table menu for it. */
  private openMenu(axis: Axis, index: number, table: TableAt): void {
    this.run(axis === 'row' ? selectRow(table.pos, index) : selectColumn(table.pos, index));
    const anchor = axis === 'row' ? this.rowGrip : this.columnGrip;
    const rect = anchor.getBoundingClientRect();
    this.host.menu.open(tableMenuItems(this.view, axis, index, this.host), rect.left, rect.bottom + 4, () => this.hide(), 'table');
    this.host.menuOpened?.();
  }
}

/**
 * tableMenuItems returns the items of the table menu for a row or a column (R-EDIT-009).
 * @param view - The view of the editor.
 * @param axis - A row or a column.
 * @param index - The index of the row or the column.
 * @param host - The helpers of the editor.
 */
export function tableMenuItems(view: EditorView, axis: Axis, index: number, host: Pick<TableHandleHost, 'ask' | 'language' | 'insertItems' | 'box' | 'menu'>): MenuItem[] {
  const table = tableAt(view.state.doc, view.state.selection.from);
  if (!table) {
    return [];
  }
  const pos = table.pos;
  const rows = table.node.childCount;
  const columns = table.node.firstChild?.childCount ?? 0;
  const run = (command: (state: EditorView['state'], dispatch: EditorView['dispatch']) => boolean) => () => {
    command(view.state, view.dispatch);
    view.focus();
  };
  const items: MenuItem[] = [];
  if (axis === 'row') {
    items.push(
      { id: 'insertRowAbove', label: 'Insert row above', icon: 'up', run: run(insertRow(pos, index)) },
      { id: 'insertRowBelow', label: 'Insert row below', icon: 'down', run: run(insertRow(pos, index + 1)) },
    );
    if (index > 0) {
      items.push({ id: 'moveRowUp', label: 'Move row up', icon: 'up', run: run(moveRow(pos, index, index - 1)) });
    }
    if (index < rows - 1) {
      items.push({ id: 'moveRowDown', label: 'Move row down', icon: 'down', run: run(moveRow(pos, index, index + 1)) });
    }
    items.push({ id: 'deleteRow', label: 'Delete row', icon: 'close', run: run(deleteRow(pos, index)) });
  } else {
    const align = (table.node.firstChild?.child(index).attrs.align as Alignment) ?? null;
    const comment = widthsComment(view.state.doc, pos);
    items.push(
      { id: 'insertColumnLeft', label: 'Insert column left', icon: 'plus', run: run(insertColumn(pos, index)) },
      { id: 'insertColumnRight', label: 'Insert column right', icon: 'plus', run: run(insertColumn(pos, index + 1)) },
    );
    if (index > 0) {
      items.push({ id: 'moveColumnLeft', label: 'Move column left', keywords: ['move'], run: run(moveColumn(pos, index, index - 1)) });
    }
    if (index < columns - 1) {
      items.push({ id: 'moveColumnRight', label: 'Move column right', keywords: ['move'], run: run(moveColumn(pos, index, index + 1)) });
    }
    items.push(
      { id: 'sortAscending', label: 'Sort ascending', keywords: ['order'], hint: 'A→Z', run: run(sortColumn(pos, index, false, host.language())) },
      { id: 'sortDescending', label: 'Sort descending', keywords: ['order'], hint: 'Z→A', run: run(sortColumn(pos, index, true, host.language())) },
      { id: 'alignLeft', label: 'Align left', hint: ':---', active: align === 'left', run: run(alignColumn(pos, index, 'left')) },
      { id: 'alignCenter', label: 'Align center', hint: ':---:', active: align === 'center', run: run(alignColumn(pos, index, 'center')) },
      { id: 'alignRight', label: 'Align right', hint: '---:', active: align === 'right', run: run(alignColumn(pos, index, 'right')) },
      { id: 'alignNone', label: 'No alignment', keywords: ['align'], hint: '---', active: align === null, run: run(alignColumn(pos, index, null)) },
      {
        id: 'columnWidth',
        label: 'Width of the column…',
        keywords: ['size'],
        hint: comment?.widths[index] !== undefined ? `${comment.widths[index]} %` : undefined,
        run: () => {
          void host.ask('Width of the column in percent', comment?.widths[index] !== undefined ? String(comment.widths[index]) : '').then((value) => {
            const width = Number((value ?? '').replace('%', '').replace(',', '.'));
            if (value && Number.isFinite(width) && width > 0) {
              setWidths(pos, widthsWith(comment?.widths, columns, index, width))(view.state, view.dispatch);
            }
            view.focus();
          });
        },
      },
    );
    if (comment) {
      items.push({ id: 'automaticWidths', label: 'Widths from the text', keywords: ['size', 'automatic'], run: run(setWidths(pos, null)) });
    }
    items.push({ id: 'deleteColumn', label: 'Delete column', icon: 'close', run: run(deleteColumn(pos, index)) });
  }
  const cells = selectedCells(view.state, table);
  items.push(
    { id: 'colorNone', label: 'No cell color', keywords: ['color', 'background'], run: run(colorCells(pos, cells, null)) },
    ...cellColors.map((color) => ({
      id: `color-${color}`,
      label: `Cell color ${colorNames[color]}`,
      keywords: ['color', 'background'],
      hint: `<!--cell ${color}-->`,
      run: run(colorCells(pos, cells, color)),
    })),
    {
      id: 'insertAfterTable',
      label: 'Insert after the table…',
      keywords: ['block'],
      icon: 'plus',
      run: () => {
        const current = tableAt(view.state.doc, pos);
        if (!current) {
          return;
        }
        const after = current.pos + current.node.nodeSize;
        const tr = view.state.tr.insert(after, view.state.schema.nodes.paragraph.create());
        view.dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView());
        view.focus();
        let coords = { left: 0, bottom: 0 };
        try {
          coords = view.coordsAtPos(after + 1);
        } catch {
          // The menu shows at the top left of the text.
        }
        host.menu.open(host.insertItems(), coords.left, coords.bottom + 4, undefined, 'insert');
      },
    },
    { id: 'deleteTable', label: 'Delete table', icon: 'close', run: run(deleteTable(pos)) },
  );
  return items;
}
