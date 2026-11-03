// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The read-only generated parts (docs/editor.md, R-EDIT-011): a plugin returns the parts of the document that it
// generates, for example the text of a citation. The user cannot type in a part, delete a piece of it, paste into it or
// format a piece of it: the editor drops such a change. The cursor jumps over a part, a selection that touches a part
// holds the whole part, and Backspace and Delete next to a part delete the whole part in one step of Undo. Text typed at
// the edge of a part does not take the marks of the part. A part can hold whole blocks, for example the code block of a
// listing: the cursor then stays in the text before or after it. Ctrl+click (Cmd+click on macOS) on a part goes to its
// target, and a double click opens its form, when the plugin gives them. Changes from outside, Undo and Redo, and the
// writes of the plugins, with the meta `generatedWrite`, may change a part.

import { isHistoryTransaction } from '@tiptap/pm/history';
import type { Node } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey, Selection, TextSelection, type Transaction } from '@tiptap/pm/state';
import { AddMarkStep, type Mapping, RemoveMarkStep, ReplaceAroundStep, ReplaceStep, type StepMap } from '@tiptap/pm/transform';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { outsideChange } from '../markdown/update';
import type { GeneratedPart } from './api';
import type { DocCache } from './cache';

/** generatedWrite is the meta of a transaction in which a plugin writes its generated parts. */
export const generatedWrite = 'nsmdGeneratedWrite';

/** generatedKey is the key of the plugin of the generated parts; its state is the cache of the parts. */
export const generatedKey = new PluginKey<DocCache<GeneratedPart[]>>('nsmdGenerated');

/** generatedPartsOf returns the generated parts of the document of a state, for example to skip them in a replace. */
export function generatedPartsOf(state: EditorState): readonly GeneratedPart[] {
  return generatedKey.getState(state)?.get(state.doc) ?? [];
}

/**
 * validParts returns the parts of a document with positions inside the document and a length, in their order.
 * @param doc - The document.
 * @param parts - The parts that the plugins returned.
 */
export function validParts(doc: Node, parts: readonly GeneratedPart[]): GeneratedPart[] {
  const size = doc.content.size;
  return parts.filter((part) => Number.isInteger(part.from) && Number.isInteger(part.to) && part.from >= 0 && part.to <= size && part.from < part.to).sort((a, b) => a.from - b.from);
}

/** Range is a range of positions. */
interface Range {
  readonly from: number;
  readonly to: number;
}

/**
 * breaks returns true when a change of a range touches a part without the whole part: an insert inside the part, or a
 * replacement that holds a piece of the part.
 */
export function breaks(change: Range, part: Range): boolean {
  if (change.from === change.to) {
    return part.from < change.from && change.from < part.to;
  }
  return change.from < part.to && change.to > part.from && !(change.from <= part.from && change.to >= part.to);
}

/** changesOf returns the ranges of a step in the document before the step. */
function changesOf(step: unknown, map: StepMap): Range[] {
  if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
    return [{ from: step.from, to: step.to }];
  }
  if (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) {
    const ranges: Range[] = [];
    map.forEach((from, to) => ranges.push({ from, to }));
    return ranges;
  }
  return [];
}

/** mapParts returns the parts after a change, without the parts that the change removed. */
function mapParts(parts: readonly Range[], mapping: Mapping | StepMap): Range[] {
  return parts.map((part) => ({ from: mapping.map(part.from, 1), to: mapping.map(part.to, -1) })).filter((part) => part.from < part.to);
}

/**
 * keepsParts returns false for a transaction of the user that breaks a generated part of the document before it.
 * @param tr - The transaction.
 * @param parts - The parts of the document before the transaction.
 */
export function keepsParts(tr: Transaction, parts: readonly Range[]): boolean {
  if (!tr.docChanged || parts.length === 0 || tr.getMeta(outsideChange) || tr.getMeta(generatedWrite) || isHistoryTransaction(tr)) {
    return true;
  }
  let current: Range[] = [...parts];
  for (const [index, step] of tr.steps.entries()) {
    const map = tr.mapping.maps[index];
    if (changesOf(step, map).some((change) => current.some((part) => breaks(change, part)))) {
      return false;
    }
    current = mapParts(current, map);
  }
  return true;
}

/** partAround returns the part that holds a position inside, not at its edges. */
const partAround = (parts: readonly GeneratedPart[], pos: number): GeneratedPart | undefined => parts.find((part) => part.from < pos && pos < part.to);

/** holdsBlocks returns true for a part that holds whole blocks, for example the code block of a listing. */
const holdsBlocks = (doc: Node, part: GeneratedPart): boolean => !doc.resolve(part.from).parent.inlineContent;

/**
 * besidePart returns the cursor at an edge of a part: at the edge itself for a part in a line of text, and in the text
 * next to the edge for a part that holds whole blocks, or undefined when no text is next to it.
 * @param doc - The document.
 * @param parts - The parts of the document.
 * @param part - The part.
 * @param toEnd - true for the end of the part, false for its start.
 */
function besidePart(doc: Node, parts: readonly GeneratedPart[], part: GeneratedPart, toEnd: boolean): TextSelection | undefined {
  const edge = toEnd ? part.to : part.from;
  if (!holdsBlocks(doc, part)) {
    return TextSelection.create(doc, edge);
  }
  const found = Selection.findFrom(doc.resolve(edge), toEnd ? 1 : -1, true) ?? Selection.findFrom(doc.resolve(toEnd ? part.from : part.to), toEnd ? -1 : 1, true);
  return found instanceof TextSelection && !partAround(parts, found.head) ? found : undefined;
}

/**
 * outsideParts returns the selection of a state outside the generated parts: a cursor inside a part jumps to the edge in
 * the direction of its move, or to the nearer edge, and a selection that touches a part grows to hold the whole part.
 * For a part that holds whole blocks, the cursor goes to the text before or after it: in the direction of a move by the
 * keyboard, and to the nearer edge after a click.
 * @param state - The state after the transactions.
 * @param before - The position of the cursor before the transactions, in the document after them.
 * @param parts - The parts of the document.
 * @param pointer - true when the mouse set the selection.
 * @returns The new selection, or undefined when the selection stays.
 */
function outsideParts(state: EditorState, before: number, parts: readonly GeneratedPart[], pointer: boolean): TextSelection | undefined {
  const selection = state.selection;
  if (!(selection instanceof TextSelection)) {
    return undefined;
  }
  const { anchor, head } = selection;
  if (selection.empty) {
    const part = partAround(parts, head);
    if (!part) {
      return undefined;
    }
    const nearer = head - part.from > part.to - head;
    if (holdsBlocks(state.doc, part)) {
      return besidePart(state.doc, parts, part, pointer || (before > part.from && before < part.to) ? nearer : head > before);
    }
    return besidePart(state.doc, parts, part, Math.abs(head - before) === 1 ? head > before : nearer);
  }
  const forward = head > anchor;
  const anchorPart = partAround(parts, anchor);
  const headPart = partAround(parts, head);
  if (!anchorPart && !headPart) {
    return undefined;
  }
  const newAnchor = anchorPart ? (forward ? anchorPart.from : anchorPart.to) : anchor;
  const newHead = headPart ? (forward ? headPart.to : headPart.from) : head;
  return TextSelection.create(state.doc, newAnchor, newHead);
}

/**
 * deleteNext deletes the whole part next to the cursor, for Backspace before the cursor and for Delete after it. A part
 * that holds whole blocks is next to the cursor at the start of the textblock after it and at the end of the textblock
 * before it.
 * @returns true when it deleted a part.
 */
function deleteNext(view: EditorView, parts: readonly GeneratedPart[], backward: boolean): boolean {
  const { selection } = view.state;
  if (!selection.empty) {
    return false;
  }
  const { $head, head } = selection;
  const atEdge = $head.parent.isTextblock && $head.depth > 0 && (backward ? $head.parentOffset === 0 : $head.parentOffset === $head.parent.content.size);
  const block = atEdge ? (backward ? $head.before() : $head.after()) : undefined;
  const part = parts.find((each) => (backward ? each.to === head || each.to === block : each.from === head || each.from === block));
  if (!part) {
    return false;
  }
  view.dispatch(view.state.tr.delete(part.from, part.to).scrollIntoView());
  return true;
}

/**
 * typeAtEdge inserts typed text at the edge of a part without the marks of the text of the part, so that the text does
 * not become a piece of the part, for example of the link of a citation.
 * @returns true when it inserted the text.
 */
function typeAtEdge(view: EditorView, parts: readonly GeneratedPart[], from: number, to: number, text: string): boolean {
  const part = parts.find((each) => each.to === from || each.from === to);
  if (!part) {
    return false;
  }
  const { state } = view;
  const edge = part.to === from ? state.doc.resolve(from).nodeBefore : state.doc.resolve(to).nodeAfter;
  if (!edge?.isText) {
    return false;
  }
  const $from = state.doc.resolve(from);
  const marks = (state.storedMarks ?? $from.marks()).filter((mark) => !mark.isInSet(edge.marks));
  view.dispatch(state.tr.replaceWith(from, to, state.schema.text(text, marks)).scrollIntoView());
  return true;
}

/**
 * decorationsOf returns the decorations of the parts: the class `nsmd-generated` on their text, and the class
 * `nsmd-generated-block` on each block that a part holds whole.
 */
function decorationsOf(doc: Node, parts: readonly GeneratedPart[]): DecorationSet {
  const decorations: Decoration[] = [];
  for (const part of parts) {
    decorations.push(Decoration.inline(part.from, part.to, { class: 'nsmd-generated' }));
    doc.nodesBetween(part.from, part.to, (node, pos) => {
      if (node.isBlock && pos >= part.from && pos + node.nodeSize <= part.to) {
        decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'nsmd-generated-block' }));
        return false;
      }
      return true;
    });
  }
  return DecorationSet.create(doc, decorations);
}

/**
 * generatedPlugin returns the ProseMirror plugin of the generated parts.
 * @param parts - The generated parts of each document, from the plugins.
 */
export function generatedPlugin(parts: DocCache<GeneratedPart[]>): Plugin {
  const decorations = new WeakMap<GeneratedPart[], DecorationSet>();
  return new Plugin({
    key: generatedKey,
    state: { init: () => parts, apply: (_tr, value) => value },
    filterTransaction: (tr, state) => keepsParts(tr, parts.get(state.doc)),
    appendTransaction: (transactions, oldState, newState) => {
      if (!transactions.some((tr) => tr.selectionSet || tr.docChanged)) {
        return null;
      }
      let before = oldState.selection.head;
      for (const tr of transactions) {
        before = tr.mapping.map(before);
      }
      const pointer = transactions.some((tr) => tr.getMeta('pointer') === true);
      const selection = outsideParts(newState, before, parts.get(newState.doc), pointer);
      return selection ? newState.tr.setSelection(selection) : null;
    },
    props: {
      decorations: (state) => {
        const found = parts.get(state.doc);
        let set = decorations.get(found);
        if (!set) {
          set = decorationsOf(state.doc, found);
          decorations.set(found, set);
        }
        return set;
      },
      handleKeyDown: (view, event) => {
        if (event.key !== 'Backspace' && event.key !== 'Delete') {
          return false;
        }
        return deleteNext(view, parts.get(view.state.doc), event.key === 'Backspace');
      },
      handleTextInput: (view, from, to, text) => typeAtEdge(view, parts.get(view.state.doc), from, to, text),
      handleClick: (view, pos, event) => {
        if (!(event.ctrlKey || event.metaKey)) {
          return false;
        }
        const part = parts.get(view.state.doc).find((each) => each.from <= pos && pos <= each.to && each.open);
        part?.open?.();
        return part !== undefined;
      },
      handleDoubleClick: (view, pos) => {
        const part = parts.get(view.state.doc).find((each) => each.from <= pos && pos <= each.to && each.edit);
        part?.edit?.();
        return part !== undefined;
      },
    },
  });
}
