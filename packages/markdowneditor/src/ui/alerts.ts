// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The GitHub alerts in the rendered text (docs/editor.md, R-EDIT-003, R-EDIT-013): a block quote whose first paragraph
// starts with `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` shows as an alert of its kind, with the
// name of the kind as its title in place of the marker. The alert stays rendered while the user edits its text, and its
// title is fixed: the marker stays text of the document, but the cursor never stands in it, and an edit of the user
// cannot change a piece of it. Backspace at the start of the text of an alert removes the whole marker, so that the
// alert becomes a quote. An edit that takes the marker out of the first paragraph of the quote, for example the text
// style "Text" on the alert, removes the marker too, and a format on the marker goes away again. Changes from outside,
// Undo and Redo, and the writes of the plugins may change a marker.

import { isHistoryTransaction } from '@tiptap/pm/history';
import type { Node } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey, Selection, TextSelection, type Transaction } from '@tiptap/pm/state';
import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { outsideChange } from '../markdown/update';
import { generatedWrite } from '../plugins/generated';
import { alertKinds, type AlertKind } from './items';

/** Alert is a GitHub alert of the document: the position of its block quote and the range of its marker. */
export interface Alert {
  kind: AlertKind;
  /** pos is the position of the block quote. */
  pos: number;
  /** size is the size of the block quote. */
  size: number;
  /** from and to are the range of the marker, `[!NOTE]`, with the spaces and the line break after it. */
  from: number;
  to: number;
}

/** marker matches the marker of an alert at the start of the text of a paragraph, with the spaces after it. */
const marker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:[ \n]+|$)/i;

/**
 * alertsOf returns the GitHub alerts of a document.
 * @param doc - The document.
 */
export function alertsOf(doc: Node): Alert[] {
  const alerts: Alert[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') {
      return !node.isTextblock;
    }
    const first = node.firstChild;
    const text = first?.type.name === 'paragraph' ? first.firstChild : null;
    const found = text?.isText && text.marks.length === 0 ? marker.exec(text.text ?? '') : null;
    if (found) {
      // The text of the paragraph starts after the open tags of the block quote and of the paragraph.
      alerts.push({ kind: found[1].toLowerCase() as AlertKind, pos, size: node.nodeSize, from: pos + 2, to: pos + 2 + found[0].length });
    }
    return true;
  });
  return alerts;
}

/** alertsKey is the key of the plugin of the alerts. */
export const alertsKey = new PluginKey<Alert[]>('nsmdAlerts');

/** alertsOfState returns the GitHub alerts of the document of a state. */
export function alertsOfState(state: EditorState): readonly Alert[] {
  return alertsKey.getState(state) ?? [];
}

/**
 * alertTextStart returns the start of the text of the alert whose marker starts at a position, the place of the cursor
 * at the start of the alert, or undefined when no marker starts there.
 */
export function alertTextStart(state: EditorState, pos: number): number | undefined {
  return alertsOfState(state).find((alert) => alert.from === pos)?.to;
}

/** Range is a range of positions. */
interface Range {
  readonly from: number;
  readonly to: number;
}

/**
 * breaksMarker returns true when a change of a range breaks the marker of an alert: an insert before the first
 * paragraph of the alert, at the start of the marker or inside it, or a change that holds a piece of the marker or the
 * open tag of its paragraph without the whole marker. An insert at the end of the marker adds text to the alert.
 * @param change - The range of the change in the document before it.
 * @param alert - The alert.
 */
export function breaksMarker(change: Range, alert: Alert): boolean {
  if (change.from === change.to) {
    return alert.pos < change.from && change.from < alert.to;
  }
  return change.from < alert.to && change.to > alert.pos + 1 && !(change.from <= alert.from && change.to >= alert.to);
}

/**
 * keepsMarkers returns false for a transaction of the user that breaks the marker of an alert of the document before it.
 * @param tr - The transaction.
 * @param alerts - The alerts of the document before the transaction.
 */
export function keepsMarkers(tr: Transaction, alerts: readonly Alert[]): boolean {
  if (!tr.docChanged || alerts.length === 0 || tr.getMeta(outsideChange) || tr.getMeta(generatedWrite) || isHistoryTransaction(tr)) {
    return true;
  }
  let current: Alert[] = [...alerts];
  for (const [index, step] of tr.steps.entries()) {
    const map = tr.mapping.maps[index];
    if (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) {
      let broken = false;
      map.forEach((from, to) => {
        broken ||= current.some((alert) => breaksMarker({ from, to }, alert));
      });
      if (broken) {
        return false;
      }
    }
    current = current
      .map((alert) => ({ ...alert, pos: map.map(alert.pos, 1), from: map.map(alert.from, 1), to: map.map(alert.to, -1) }))
      .filter((alert) => alert.from < alert.to && alert.from === alert.pos + 2);
  }
  return true;
}

/** fromUser returns true for transactions that hold an edit of the user, not a change from outside, Undo or Redo. */
const fromUser = (transactions: readonly Transaction[]): boolean =>
  transactions.some((tr) => tr.docChanged) && !transactions.some((tr) => tr.getMeta(outsideChange) || tr.getMeta(generatedWrite) || isHistoryTransaction(tr));

/** inFirstParagraph returns true when a position is the start of the first paragraph of a block quote. */
function inFirstParagraph(doc: Node, pos: number): boolean {
  const $pos = doc.resolve(pos);
  return $pos.depth >= 2 && $pos.parent.type.name === 'paragraph' && $pos.parentOffset === 0 && $pos.node(-1).type.name === 'blockquote' && $pos.index(-1) === 0;
}

/**
 * repairedMarkers returns the transaction that keeps the markers of the alerts after an edit of the user: a format on
 * a marker goes away, a space separates a marker without one from text typed after it, and a marker that is no longer
 * at the start of the first paragraph of a quote goes away, for example after the text style "Text" on the alert.
 * @param transactions - The transactions of the edit.
 * @param oldState - The state before the edit.
 * @param newState - The state after the edit.
 * @returns The transaction, or null when each marker stays an alert.
 */
function repairedMarkers(transactions: readonly Transaction[], oldState: EditorState, newState: EditorState): Transaction | null {
  const before = alertsOfState(oldState);
  if (before.length === 0 || !fromUser(transactions)) {
    return null;
  }
  const after = new Set(alertsOfState(newState).map((alert) => alert.from));
  const tr = newState.tr;
  for (const alert of [...before].reverse()) {
    let from = alert.from;
    let to = alert.to;
    for (const each of transactions) {
      from = each.mapping.map(from, 1);
      to = each.mapping.map(to, -1);
    }
    const text = oldState.doc.textBetween(alert.from, alert.to);
    if (after.has(from) || to - from !== alert.to - alert.from || newState.doc.textBetween(from, to) !== text) {
      continue;
    }
    if (!inFirstParagraph(newState.doc, from)) {
      tr.delete(tr.mapping.map(from), tr.mapping.map(to));
      continue;
    }
    tr.removeMark(tr.mapping.map(from), tr.mapping.map(to));
    const next = newState.doc.resolve(to).nodeAfter;
    if (next?.isText && !/^[ \n]/.test(next.text ?? '') && !/[ \n]$/.test(text)) {
      tr.insertText(' ', tr.mapping.map(to));
    }
  }
  return tr.docChanged ? tr : null;
}

/**
 * outsideMarkers returns the selection of a state outside the markers of the alerts: a cursor that the arrow left at the
 * start of the text or the arrow up in its first line moves into a marker goes to the end of the text before the alert,
 * and any other cursor in a marker, for example after a click on the title, the key Home or the arrow up from the
 * second line, goes to the start of the text of the alert. A selection that
 * the user extends back into a marker extends to the text before the alert, and a selection that starts in a marker
 * starts at the start of the text of the alert.
 * @param state - The state after the transactions.
 * @param before - The position of the cursor before the transactions, in the document after them.
 * @param alerts - The alerts of the document.
 * @param back - true when a key moved the cursor back out of the text of an alert.
 * @returns The new selection, or undefined when the selection stays.
 */
function outsideMarkers(state: EditorState, before: number, alerts: readonly Alert[], back: boolean): TextSelection | undefined {
  const selection = state.selection;
  if (!(selection instanceof TextSelection) || alerts.length === 0) {
    return undefined;
  }
  const { doc } = state;
  const { anchor, head } = selection;
  const inMarker = (pos: number) => alerts.find((alert) => alert.from <= pos && pos < alert.to);
  const textBefore = (alert: Alert) => Selection.findFrom(doc.resolve(alert.pos), -1, true)?.head;
  const anchorAlert = inMarker(anchor);
  const headAlert = inMarker(head);
  if (!anchorAlert && !headAlert) {
    return undefined;
  }
  if (selection.empty || anchorAlert === headAlert) {
    const alert = (headAlert ?? anchorAlert) as Alert;
    const previous = back && selection.empty && head < before ? textBefore(alert) : undefined;
    return TextSelection.create(doc, previous ?? alert.to);
  }
  const newAnchor = anchorAlert ? anchorAlert.to : anchor;
  const newHead = headAlert ? (head < newAnchor ? (textBefore(headAlert) ?? headAlert.from) : headAlert.to) : head;
  if (newAnchor === anchor && newHead === head) {
    return undefined;
  }
  return TextSelection.create(doc, newAnchor, newHead);
}

/**
 * removeMarker removes the marker of the alert whose text starts at the cursor, for Backspace, also with a modifier
 * that deletes a word: the alert becomes a quote.
 * @returns true when it removed a marker.
 */
function removeMarker(view: EditorView): boolean {
  const { selection } = view.state;
  const alert = selection.empty ? alertsOfState(view.state).find((each) => each.to === selection.head) : undefined;
  if (!alert) {
    return false;
  }
  // The removal is a change of the user, so that it does not break the marker that it removes as a whole.
  view.dispatch(view.state.tr.delete(alert.from, alert.to).scrollIntoView());
  return true;
}

/**
 * movesBack returns true for a key that moves the cursor back out of the text of an alert, over its title: the arrow
 * left at the start of the text, and the arrow up in the first line of the text.
 * @param view - The view of the editor.
 * @param key - The key.
 */
function movesBack(view: EditorView, key: string): boolean {
  const { selection } = view.state;
  if (key !== 'ArrowLeft' && key !== 'ArrowUp') {
    return false;
  }
  const { head, $head } = selection;
  const alert = alertsOfState(view.state).find((each) => $head.parent.isTextblock && $head.start() === each.from);
  if (!alert) {
    return false;
  }
  if (key === 'ArrowLeft') {
    return head === alert.to;
  }
  try {
    return Math.abs(view.coordsAtPos(head).top - view.coordsAtPos(alert.to).top) < 2;
  } catch {
    // A page without the layout of its text, for example in a test, has no lines.
    return true;
  }
}

/** decorationsOf returns the classes of the alerts, and the names of their kinds in place of their markers. */
function decorationsOf(state: EditorState, alerts: readonly Alert[]): DecorationSet {
  const decorations: Decoration[] = [];
  for (const alert of alerts) {
    decorations.push(Decoration.node(alert.pos, alert.pos + alert.size, { class: `nsmd-alert nsmd-alert-${alert.kind}` }));
    decorations.push(Decoration.inline(alert.from, alert.to, { class: 'nsmd-alert-marker', 'data-label': alertKinds[alert.kind] }));
  }
  return DecorationSet.create(state.doc, decorations);
}

/** alertsPlugin returns the plugin of the GitHub alerts. */
export function alertsPlugin(): Plugin<Alert[]> {
  // backKey is true after a key that moves the cursor back out of the text of an alert, over its title.
  let backKey = false;
  return new Plugin<Alert[]>({
    key: alertsKey,
    state: {
      init: (_config, state) => alertsOf(state.doc),
      apply: (tr, value) => (tr.docChanged ? alertsOf(tr.doc) : value),
    },
    filterTransaction: (tr, state) => keepsMarkers(tr, alertsOfState(state)),
    appendTransaction: (transactions, oldState, newState) => {
      const repaired = repairedMarkers(transactions, oldState, newState);
      if (repaired) {
        return repaired;
      }
      if (!transactions.some((tr) => tr.selectionSet || tr.docChanged)) {
        return null;
      }
      let before = oldState.selection.head;
      for (const tr of transactions) {
        before = tr.mapping.map(before);
      }
      const back = backKey && !transactions.some((tr) => tr.getMeta('pointer') === true);
      const selection = outsideMarkers(newState, before, alertsOfState(newState), back);
      return selection ? newState.tr.setSelection(selection) : null;
    },
    props: {
      decorations(state) {
        const alerts = alertsOfState(state);
        return alerts.length > 0 ? decorationsOf(state, alerts) : undefined;
      },
      handleKeyDown: (view, event) => {
        backKey = movesBack(view, event.key);
        return event.key === 'Backspace' && removeMarker(view);
      },
      handleDOMEvents: {
        mousedown: () => {
          backKey = false;
          return false;
        },
      },
    },
  });
}
