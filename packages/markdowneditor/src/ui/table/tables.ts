// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The view of the comments of the tables (docs/editor.md, R-EDIT-010): the comment of the widths of the columns,
// `<!-- table: widths=30,70 -->` on the line before a table, gives the columns of the table their widths and hides
// itself; in the mode to learn Markdown, it shows as the file writes it. The colors of the cells come from the
// attribute of each cell, which the CSS shows.

import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { widthsComment } from './grid';

/** TableWidths are the widths of the columns of a table from the comment before it. */
interface TableWidths {
  comment: { pos: number; size: number };
  table: { pos: number; node: Node };
  widths: number[];
}

/** tableWidthsOf returns the tables of a document that have the comment of the widths of their columns. */
function tableWidthsOf(doc: Node): TableWidths[] {
  const found: TableWidths[] = [];
  doc.descendants((node, pos) => {
    if (node.type.spec.tableRole === 'table') {
      const comment = widthsComment(doc, pos);
      const before = comment ? doc.nodeAt(comment.pos) : null;
      if (comment && before) {
        found.push({ comment: { pos: comment.pos, size: before.nodeSize }, table: { pos, node }, widths: comment.widths });
      }
      return false;
    }
    return !node.isTextblock;
  });
  return found;
}

/** tablesKey is the key of the plugin of the comments of the tables. */
export const tablesKey = new PluginKey<TableWidths[]>('nsmdTables');

/** decorationsOf returns the widths of the cells of the first row, and the class that hides each comment. */
function decorationsOf(state: EditorState, tables: readonly TableWidths[], learn: boolean): DecorationSet {
  const decorations: Decoration[] = [];
  for (const { comment, table, widths } of tables) {
    decorations.push(
      Decoration.node(comment.pos, comment.pos + comment.size, { class: learn ? 'nsmd-table-widths' : 'nsmd-table-widths nsmd-hidden' }),
      Decoration.node(table.pos, table.pos + table.node.nodeSize, { class: 'nsmd-table-fixed' }),
    );
    const first = table.node.firstChild;
    if (first) {
      let cellPos = table.pos + 2;
      first.forEach((cell, _offset, index) => {
        const width = widths[index];
        if (width !== undefined) {
          decorations.push(Decoration.node(cellPos, cellPos + cell.nodeSize, { style: `width: ${width}%` }));
        }
        cellPos += cell.nodeSize;
      });
    }
  }
  return DecorationSet.create(state.doc, decorations);
}

/**
 * tablesPlugin returns the plugin of the comments of the tables.
 * @param isLearning - Returns true while the mode to learn Markdown is on, which shows the comments as text.
 */
export function tablesPlugin(isLearning: (state: EditorState) => boolean): Plugin<TableWidths[]> {
  return new Plugin<TableWidths[]>({
    key: tablesKey,
    state: {
      init: (_config, state) => tableWidthsOf(state.doc),
      apply: (tr, value) => (tr.docChanged ? tableWidthsOf(tr.doc) : value),
    },
    props: {
      decorations(state) {
        const tables = tablesKey.getState(state) ?? [];
        return tables.length > 0 ? decorationsOf(state, tables, isLearning(state)) : undefined;
      },
    },
  });
}
