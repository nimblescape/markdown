// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// A change of the text from outside in the document of the editor (docs/source.md, R-SRC-002): the editor parses the new
// text and replaces only the top-level blocks whose text changed. The diff of the library `diff` compares the blocks of
// the document with the blocks of the new text; a block stays when its text and its node are the same, so the cursor,
// the views and Undo of the other blocks stay. The transaction does not enter the history of Undo of the editor.

import type { Node } from '@tiptap/pm/model';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { diffArrays } from 'diff';
import { frontMatterRemoval } from '../extensions/core';
import type { MarkdownSource, ParsedMarkdown } from './parse';

/** outsideChange is the meta of a transaction that takes a change of the text from outside. */
export const outsideChange = 'nsmdOutsideChange';

/** Block is a top-level block with its text, or without a text when the source does not know it. */
interface Block {
  node: Node;
  text: string | undefined;
}

/** blocksOf returns the top-level blocks of a document with their text in a source. */
function blocksOf(doc: Node, source: MarkdownSource): Block[] {
  const blocks: Block[] = [];
  doc.forEach((node) => blocks.push({ node, text: source.blocks.get(node)?.text }));
  return blocks;
}

/** Replacement replaces the top-level blocks from the index `from` to the index `to` of the document with new blocks. */
interface Replacement {
  from: number;
  to: number;
  nodes: Node[];
}

/**
 * updated returns the transaction that changes a document into the document of a new text, with only the top-level
 * blocks that differ, and the source of the new text for the document after the transaction.
 * @param state - The state of the editor.
 * @param source - The source of the text that the document holds now, with the text of each block.
 * @param parsed - The new text, parsed.
 * @returns The transaction, or undefined when no block changes, and the new source.
 */
export function updated(state: EditorState, source: MarkdownSource, parsed: ParsedMarkdown): { tr: Transaction | undefined; source: MarkdownSource } {
  const old = blocksOf(state.doc, source);
  const fresh = blocksOf(parsed.doc, parsed.source);
  const same = (a: Block, b: Block): boolean => a.text !== undefined && a.text === b.text && a.node.eq(b.node);
  const parts = diffArrays(old, fresh, { comparator: same });
  const replacements: Replacement[] = [];
  let open: Replacement | undefined;
  let oldIndex = 0;
  let newIndex = 0;
  for (const part of parts) {
    if (!part.added && !part.removed) {
      // A block that stays is the node of the document; the new source gives it its place in the new text.
      for (let offset = 0; offset < part.count; offset++) {
        const kept = parsed.source.blocks.get(fresh[newIndex + offset].node);
        if (kept) {
          parsed.source.blocks.set(old[oldIndex + offset].node, kept);
        }
      }
      oldIndex += part.count;
      newIndex += part.count;
      open = undefined;
      continue;
    }
    if (!open) {
      open = { from: oldIndex, to: oldIndex, nodes: [] };
      replacements.push(open);
    }
    if (part.removed) {
      oldIndex += part.count;
      open.to = oldIndex;
    } else {
      open.nodes.push(...fresh.slice(newIndex, newIndex + part.count).map((block) => block.node));
      newIndex += part.count;
    }
  }
  if (replacements.length === 0) {
    return { tr: undefined, source: parsed.source };
  }
  const starts: number[] = [];
  let position = 0;
  state.doc.forEach((node) => {
    starts.push(position);
    position += node.nodeSize;
  });
  starts.push(position);
  const tr = state.tr;
  // From the end of the document, so that the positions of the replacements before stay.
  for (const replacement of replacements.reverse()) {
    tr.replaceWith(starts[replacement.from], starts[replacement.to], replacement.nodes);
  }
  tr.setMeta('addToHistory', false).setMeta(outsideChange, true).setMeta(frontMatterRemoval, true);
  return { tr, source: parsed.source };
}
