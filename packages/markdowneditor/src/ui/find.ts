// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// Find and replace (docs/editor.md, R-GEN-003): the plugin finds a text in the rendered text of the document, marks
// each match, and moves the selection to the current match; replace changes the current match or all matches, each as
// one step of undo. A match never crosses a node that is not text, for example a footnote reference. Replace leaves a
// match that holds a piece of a generated part (R-EDIT-011), and the search leaves out the markers of the GitHub alerts,
// which show as their titles (R-EDIT-013).

import { closeHistory } from '@tiptap/pm/history';
import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { breaks, generatedPartsOf } from '../plugins/generated';
import { alertsOf } from './alerts';

/** Match is a range of the document that matches the searched text. */
export interface Match {
  from: number;
  to: number;
}

/** FindState is the state of find and replace. */
export interface FindState {
  query: string;
  caseSensitive: boolean;
  matches: Match[];
  /** current is the index of the current match, or -1. */
  current: number;
  decorations: DecorationSet;
}

/** findKey is the key of the plugin of find and replace. */
export const findKey = new PluginKey<FindState>('nsmdFind');

/**
 * findMatches returns the ranges of a document that match a text.
 * @param doc - The document.
 * @param query - The searched text.
 * @param caseSensitive - true to tell capital and small letters apart.
 */
export function findMatches(doc: Node, query: string, caseSensitive: boolean): Match[] {
  if (query === '') {
    return [];
  }
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'gu' : 'giu');
  const matches: Match[] = [];
  const search = (text: string, start: number) => {
    for (const found of text.matchAll(pattern)) {
      if (found[0].length > 0) {
        matches.push({ from: start + (found.index ?? 0), to: start + (found.index ?? 0) + found[0].length });
      }
    }
  };
  doc.descendants((node, position) => {
    if (!node.isTextblock) {
      return true;
    }
    // A run of text nodes is one text; a node that is not text ends the run.
    let run = '';
    let start = position + 1;
    node.forEach((child, offset) => {
      if (child.isText) {
        if (run === '') {
          start = position + 1 + offset;
        }
        run += child.text ?? '';
      } else {
        search(run, start);
        run = '';
      }
    });
    search(run, start);
    return false;
  });
  return matches;
}

/** decorationsOf returns the marks of the matches, with the current match marked apart. */
function decorationsOf(doc: Node, matches: readonly Match[], current: number): DecorationSet {
  return DecorationSet.create(
    doc,
    matches.map((match, index) => Decoration.inline(match.from, match.to, { class: index === current ? 'nsmd-find-match nsmd-find-current' : 'nsmd-find-match' })),
  );
}

/** stateOf returns the state of find and replace for a text in a document, with the match nearest a position current. */
function stateOf(doc: Node, query: string, caseSensitive: boolean, near: number): FindState {
  // The marker of a GitHub alert shows as the title of the alert, so the search leaves it out (R-EDIT-013).
  const markers = alertsOf(doc);
  const matches = findMatches(doc, query, caseSensitive).filter((match) => !markers.some((alert) => match.from < alert.to && match.to > alert.from));
  let current = matches.findIndex((match) => match.from >= near);
  if (current < 0) {
    current = matches.length > 0 ? 0 : -1;
  }
  return { query, caseSensitive, matches, current, decorations: decorationsOf(doc, matches, current) };
}

/** FindMeta is a change of find and replace that a transaction carries. */
type FindMeta = { query: string; caseSensitive: boolean } | { current: number };

/** findPlugin returns the plugin of find and replace. */
export function findPlugin(): Plugin<FindState> {
  return new Plugin<FindState>({
    key: findKey,
    state: {
      init: () => ({ query: '', caseSensitive: false, matches: [], current: -1, decorations: DecorationSet.empty }),
      apply(tr, value) {
        const meta = tr.getMeta(findKey) as FindMeta | undefined;
        if (meta && 'query' in meta) {
          return stateOf(tr.doc, meta.query, meta.caseSensitive, tr.selection.from);
        }
        if (meta && 'current' in meta) {
          return { ...value, current: meta.current, decorations: decorationsOf(tr.doc, value.matches, meta.current) };
        }
        if (tr.docChanged && value.query !== '') {
          return stateOf(tr.doc, value.query, value.caseSensitive, tr.selection.from);
        }
        return value;
      },
    },
    props: {
      decorations: (state) => findKey.getState(state)?.decorations,
    },
  });
}

/**
 * setFind searches a text, or ends the search with an empty text.
 * @param view - The view of the editor.
 * @param query - The searched text.
 * @param caseSensitive - true to tell capital and small letters apart.
 */
export function setFind(view: EditorView, query: string, caseSensitive: boolean): void {
  view.dispatch(view.state.tr.setMeta(findKey, { query, caseSensitive }).setMeta('addToHistory', false));
}

/** selectMatch selects a match and shows it. */
function selectMatch(tr: Transaction, match: Match): Transaction {
  return tr.setSelection(TextSelection.create(tr.doc, match.from, match.to)).scrollIntoView();
}

/**
 * findNext makes the next match current and selects it.
 * @param view - The view of the editor.
 * @param step - 1 for the next match, -1 for the match before.
 */
export function findNext(view: EditorView, step: 1 | -1): boolean {
  const state = findKey.getState(view.state);
  if (!state || state.matches.length === 0) {
    return false;
  }
  const current = (state.current + step + state.matches.length) % state.matches.length;
  view.dispatch(selectMatch(view.state.tr.setMeta(findKey, { current }), state.matches[current]));
  return true;
}

/**
 * replaceMatch replaces the current match with a text, as one step of undo, and makes the next match current.
 * @param view - The view of the editor.
 * @param text - The new text.
 */
export function replaceMatch(view: EditorView, text: string): boolean {
  const state = findKey.getState(view.state);
  const match = state?.matches[state.current];
  if (!state || !match || !view.editable || breaksPart(view.state, match)) {
    return false;
  }
  const tr = closeHistory(replaced(view.state, view.state.tr, match, text));
  const next = findKey.getState(view.state.apply(tr));
  const nextMatch = next?.matches[next.current];
  view.dispatch(nextMatch ? selectMatch(tr, nextMatch) : tr);
  return true;
}

/**
 * replaceAll replaces every match with a text, as one step of undo. It returns the number of replaced matches.
 * @param view - The view of the editor.
 * @param text - The new text.
 */
export function replaceAll(view: EditorView, text: string): number {
  const state = findKey.getState(view.state);
  if (!state || state.matches.length === 0 || !view.editable) {
    return 0;
  }
  let tr = view.state.tr;
  // A match in a piece of a generated part stays (docs/editor.md, R-EDIT-011).
  const matches = state.matches.filter((match) => !breaksPart(view.state, match));
  // From the end, so that the positions of the matches before stay valid.
  for (const match of [...matches].reverse()) {
    tr = replaced(view.state, tr, match, text);
  }
  if (matches.length > 0) {
    view.dispatch(closeHistory(tr));
  }
  return matches.length;
}

/** breaksPart returns true when a match holds a piece of a generated part, which a replace would break. */
const breaksPart = (state: EditorState, match: Match): boolean => generatedPartsOf(state).some((part) => breaks(match, part));

/** replaced replaces a match with a text that keeps the marks of the first character of the match. */
function replaced(state: EditorState, tr: Transaction, match: Match, text: string): Transaction {
  if (text === '') {
    return tr.delete(match.from, match.to);
  }
  const marks = state.doc.resolve(match.from + 1).marks();
  return tr.replaceWith(match.from, match.to, state.schema.text(text, marks));
}
