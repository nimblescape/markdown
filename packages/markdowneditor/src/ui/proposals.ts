// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The proposed changes (docs/ai.md, R-AI-006, proposal): the AI, or another program, proposes a change of a range of the
// text of the file, and the editor shows it as a tracked change: the removed text struck through, the new text marked
// after it, with "Accept" and "Reject". Nothing changes the file before the user accepts. A change inside the text of
// one paragraph or heading shows in the line; another change shows the blocks that it touches struck through and the
// new blocks below them. A change of the user or from outside in the blocks of a proposed change makes the proposal
// outdated: it goes away. This module keeps the proposals in the state of the editor and draws them; the editor
// (src/editor.ts) finds their places in the text and applies an accepted change.

import type { Node } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Origin } from '@nimblescape/markdowntext';

/** ProposedChange is a change of the text of the file that the AI or another program proposes. */
export interface ProposedChange {
  /** id names the proposal; a second proposal with the same ID replaces the first one. */
  readonly id: string;
  /** from and to are the range of the text of the file that the change replaces, as the source counts the text. */
  readonly from: number;
  readonly to: number;
  /** text is the new text of the range, Markdown. */
  readonly text: string;
  /** origin is who proposes the change; the default is the AI. */
  readonly origin?: Origin;
}

/** ProposalResult is the end of a proposal: the user accepted or rejected it, or it went away before. */
export type ProposalResult = 'accepted' | 'rejected' | 'outdated';

/**
 * Tracked is a proposal in the state of the editor: the range of the document of the blocks that it touches, the text of
 * the file that it replaces and the new text, and for a change in the line its range in the line.
 */
export interface Tracked {
  readonly change: ProposedChange;
  /** from and to are the positions of the top-level blocks that the change touches; from equals to between blocks. */
  readonly from: number;
  readonly to: number;
  /** inline is the range in the line of a change inside the text of one textblock, or undefined. */
  readonly inline: { readonly from: number; readonly to: number } | undefined;
  /**
   * base says where the replaced text starts: `start` at the start of the text of the block at `from`, `end` at the
   * end of the text of the block that ends at `from`, `file` at the start of the file; offset counts from there.
   */
  readonly base: 'start' | 'end' | 'file';
  readonly offset: number;
  /** oldText is the text of the file that the change replaces, newText the text that replaces it. */
  readonly oldText: string;
  readonly newText: string;
}

/** ProposalsState is the state of the plugin: the proposals by their IDs. */
type ProposalsState = ReadonlyMap<string, Tracked>;

/** ProposalsMeta changes the proposals: adds one, or removes some by their IDs. */
type ProposalsMeta = { add: Tracked } | { remove: readonly string[] };

/** proposalsKey is the key of the plugin of the proposed changes. */
export const proposalsKey = new PluginKey<ProposalsState>('nsmdProposals');

/** proposalsOf returns the proposals of a state. */
export function proposalsOf(state: EditorState): ReadonlyMap<string, Tracked> {
  return proposalsKey.getState(state) ?? new Map();
}

/**
 * touches returns true when a transaction changes the document in a range or at its edges.
 * @param tr - The transaction.
 * @param from - The start of the range, in the document before the transaction.
 * @param to - The end of the range.
 */
function touches(tr: Transaction, from: number, to: number): boolean {
  let touched = false;
  let start = from;
  let end = to;
  for (const step of tr.mapping.maps) {
    step.forEach((oldStart, oldEnd) => {
      // A change between blocks touches only a proposal at the same place.
      if (from === to ? oldStart <= start && oldEnd >= end : oldStart < end && oldEnd > start) {
        touched = true;
      }
    });
    start = step.map(start, -1);
    end = step.map(end, 1);
  }
  return touched;
}

/**
 * mapped returns a proposal with its positions after a transaction, or undefined when the transaction changed its blocks.
 * @param tracked - The proposal.
 * @param tr - The transaction.
 */
function mapped(tracked: Tracked, tr: Transaction): Tracked | undefined {
  if (touches(tr, tracked.from, tracked.to)) {
    return undefined;
  }
  const map = (pos: number, side: number) => tr.mapping.map(pos, side);
  return {
    ...tracked,
    from: map(tracked.from, tracked.from === tracked.to ? -1 : 1),
    to: map(tracked.to, -1),
    inline: tracked.inline ? { from: map(tracked.inline.from, 1), to: map(tracked.inline.to, -1) } : undefined,
  };
}

/** ProposalsHost is what the drawing of the proposals needs from the editor. */
export interface ProposalsHost {
  /** render shows Markdown in an element, inline in the line or as blocks. */
  render(text: string, element: HTMLElement, inline: boolean): void;
  accept(id: string): void;
  reject(id: string): void;
}

/**
 * actions returns the buttons "Accept" and "Reject" of a proposal.
 * @param host - The editor.
 * @param id - The ID of the proposal.
 * @param tag - The element of the buttons.
 */
function actions(host: ProposalsHost, id: string, tag: 'span' | 'div'): HTMLElement {
  const box = document.createElement(tag);
  box.className = 'nsmd-change-actions';
  for (const [label, run, name] of [
    ['Accept', () => host.accept(id), 'accept'],
    ['Reject', () => host.reject(id), 'reject'],
  ] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `nsmd-change-${name}`;
    button.textContent = label;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', (event) => {
      event.preventDefault();
      run();
    });
    box.append(button);
  }
  return box;
}

/**
 * decorations returns the decorations of the proposals of a document: the removed text struck through, the new text
 * marked after it, and the buttons.
 * @param doc - The document.
 * @param tracked - The proposals.
 * @param host - The editor.
 */
function decorations(doc: Node, tracked: ReadonlyMap<string, Tracked>, host: ProposalsHost): DecorationSet {
  const all: Decoration[] = [];
  for (const proposal of tracked.values()) {
    const { id } = proposal.change;
    const title = `Proposed by ${proposal.change.origin?.name ?? 'the AI'}`;
    if (proposal.inline) {
      if (proposal.inline.from < proposal.inline.to) {
        all.push(Decoration.inline(proposal.inline.from, proposal.inline.to, { class: 'nsmd-change-removed', 'data-change': id }));
      }
      const widget = (): HTMLElement => {
        const box = document.createElement('span');
        box.className = 'nsmd-change nsmd-change-inline';
        box.dataset.change = id;
        const added = document.createElement('span');
        added.className = 'nsmd-change-added';
        added.title = title;
        host.render(proposal.change.text, added, true);
        box.append(added, actions(host, id, 'span'));
        return box;
      };
      all.push(Decoration.widget(proposal.inline.to, widget, { side: 1, key: `change-${id}`, ignoreSelection: true, stopEvent: () => true }));
      continue;
    }
    doc.nodesBetween(proposal.from, proposal.to, (node, pos) => {
      if (pos >= proposal.from && pos + node.nodeSize <= proposal.to) {
        all.push(Decoration.node(pos, pos + node.nodeSize, { class: 'nsmd-change-removed', 'data-change': id }));
      }
      return false;
    });
    const widget = (): HTMLElement => {
      const box = document.createElement('div');
      box.className = 'nsmd-change nsmd-change-block';
      box.dataset.change = id;
      box.contentEditable = 'false';
      const added = document.createElement('div');
      added.className = 'nsmd-change-added';
      added.title = title;
      host.render(proposal.newText, added, false);
      box.append(added, actions(host, id, 'div'));
      return box;
    };
    all.push(Decoration.widget(proposal.to, widget, { side: 1, key: `change-${id}`, ignoreSelection: true, stopEvent: () => true }));
  }
  return DecorationSet.create(doc, all);
}

/**
 * proposalsPlugin returns the plugin of the proposed changes, which keeps the proposals through the changes of the
 * document and draws them.
 * @param host - The editor.
 */
export function proposalsPlugin(host: ProposalsHost): Plugin<ProposalsState> {
  return new Plugin<ProposalsState>({
    key: proposalsKey,
    state: {
      init: () => new Map(),
      apply: (tr, value) => {
        const meta = tr.getMeta(proposalsKey) as ProposalsMeta | undefined;
        if (!meta && (!tr.docChanged || value.size === 0)) {
          return value;
        }
        // A change of the blocks of a proposal makes it outdated: it leaves the state, and the editor ends it.
        const tracked = new Map<string, Tracked>();
        for (const [id, proposal] of value) {
          const moved = tr.docChanged ? mapped(proposal, tr) : proposal;
          if (moved) {
            tracked.set(id, moved);
          }
        }
        if (meta && 'add' in meta) {
          tracked.set(meta.add.change.id, meta.add);
        } else if (meta && 'remove' in meta) {
          meta.remove.forEach((id) => tracked.delete(id));
        }
        return tracked;
      },
    },
    props: {
      decorations: (state) => {
        const tracked = proposalsOf(state);
        return tracked.size === 0 ? DecorationSet.empty : decorations(state.doc, tracked, host);
      },
    },
  });
}
