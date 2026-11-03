// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The rendered changes (docs/platforms.md, R-VSC-009): the editor of one side of a diff marks what changed against the
// text of the other side. The older version is the side `original`, on the left; the newer version is the side
// `modified`, on the right. Both sides compute the same rows from the same two texts:
//
// - The editor compares the top-level blocks of both versions with the line diff of the library `diff`: two blocks are
//   the same when the editor reads the same block from them. Equal blocks stand side by side, one row each. A run of
//   changed blocks with the same number of blocks of the same kinds on both sides becomes pairs, each a row of its
//   own, whose words are compared with the word diff. In another run, the similar blocks at its start and at its end
//   are pairs: blocks of the same kind that share at least half of their words; the other blocks of the run are one
//   row.
// - The side `original` marks the removed blocks and words in red, the side `modified` the new blocks and words in
//   green (markdown.css, the classes nsmd-diff-*). The marks are decorations: the text of the file does not change.
// - The rows line up: at the end of each row stands a spacer, an empty space of the height that the row lacks against
//   the same row of the other side. Each side measures the natural height of its rows, with all spacers at the height
//   0, and gives them to the other side (`onLayout`); with the heights of the other side, it sets its spacers so that
//   each row has the height of the higher side. A spacer never lets the margins of the blocks around it collapse, also
//   with the height 0 (markdown.css), so that its height adds to the height of its row exactly. A spacer before the
//   first row lines up the start of the text, when the parts above it, for example the toolbar, differ in height.
// - Both sides scroll together: each side gives the row at the top of its view and the offset in it (`onScroll`), and
//   the other side scrolls to the same place (`scrollTo`). With rows of the same height, the offset is the same.
// - `next` and `previous` go to the next and the previous change, a run of rows that are not the same.

import { diffArrays, diffWordsWithSpace } from 'diff';
import type { Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

/** ChangeSide is the side of an editor in a diff: the older version (`original`) or the newer one (`modified`). */
export type ChangeSide = 'original' | 'modified';

/**
 * ChangeRow is a row of a diff: the top-level blocks of the older and of the newer version that stand side by side, as
 * the ranges of their indexes, from the first block to the block after the last one.
 */
export interface ChangeRow {
  readonly original: readonly [number, number];
  readonly modified: readonly [number, number];
  /** kind is `same` for equal blocks, `changed` for one changed block on each side, and `other` for the rest. */
  readonly kind: 'same' | 'changed' | 'other';
}

/** ChangeLayout is the natural height of each row of one side, in pixels, with the key of the rows. */
export interface ChangeLayout {
  /** rows is the key of the rows (rowsKey): a side takes only the heights of the same rows. */
  readonly rows: string;
  readonly heights: readonly number[];
  /** start is the distance from the top of the content of the scroller to the first row, in pixels. */
  readonly start: number;
}

/** ChangePosition is a place in the rows: the index of a row and the offset from its top, in pixels. */
export interface ChangePosition {
  readonly row: number;
  readonly offset: number;
}

/** ChangesOptions configure the rendered changes of an editor. */
export interface ChangesOptions {
  /** side is the side of the editor. */
  readonly side: ChangeSide;
  /** other is the Markdown text of the other side. */
  readonly other: string;
  /** onLayout gets the natural heights of the rows of this side, for `setOtherLayout` of the other side. */
  readonly onLayout?: (layout: ChangeLayout) => void;
  /** onScroll gets the place at the top of the view after the user scrolled, for `scrollTo` of the other side. */
  readonly onScroll?: (position: ChangePosition) => void;
  /**
   * scroller is the element that scrolls the editor; the default is the nearest element around the editor that scrolls,
   * or the page.
   */
  readonly scroller?: HTMLElement;
}

/** BlockCompare compares a block of the older version with a block of the newer version, by their indexes. */
export interface BlockCompare {
  /** sameKind is true for two blocks of the same kind, for example two paragraphs. */
  sameKind(original: number, modified: number): boolean;
  /** similar is true for two blocks that are one changed block: of the same kind, with much of their text the same. */
  similar(original: number, modified: number): boolean;
}

/**
 * changeRows returns the rows of the diff of the top-level blocks of two versions. A run of changed blocks with the
 * same number of blocks of the same kinds on both sides becomes pairs, each a row of its own. In another run, the
 * similar blocks at its start and at its end become pairs; the blocks between them are one row.
 * @param original - The keys of the blocks of the older version: equal blocks have equal keys.
 * @param modified - The keys of the blocks of the newer version.
 * @param compare - Compares the blocks; without it, a run becomes pairs only when both sides have the same number of
 *   blocks in it.
 */
export function changeRows(original: readonly string[], modified: readonly string[], compare?: BlockCompare): ChangeRow[] {
  const rows: ChangeRow[] = [];
  const parts = diffArrays([...original], [...modified]);
  let at = 0;
  let to = 0;
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (!part.added && !part.removed) {
      for (let count = 0; count < part.count; count++) {
        rows.push({ original: [at, at + 1], modified: [to, to + 1], kind: 'same' });
        at++;
        to++;
      }
      continue;
    }
    // A run of changes: the removed blocks, the new blocks, or both, in either order.
    const next = parts[index + 1];
    const pair = next && (part.removed ? next.added : next.removed);
    const removed = part.removed ? part.count : pair ? next.count : 0;
    const added = part.added ? part.count : pair ? next.count : 0;
    if (pair) {
      index++;
    }
    rows.push(...runRows(at, removed, to, added, compare));
    at += removed;
    to += added;
  }
  return rows;
}

/** runRows returns the rows of a run of changed blocks. */
function runRows(at: number, removed: number, to: number, added: number, compare?: BlockCompare): ChangeRow[] {
  const changed = (offset: number, other: number): ChangeRow => ({ original: [at + offset, at + offset + 1], modified: [to + other, to + other + 1], kind: 'changed' });
  const pairs = (count: number) => Array.from({ length: count }, (_, offset) => changed(offset, offset));
  if (removed === added && Array.from({ length: removed }, (_, offset) => compare?.sameKind(at + offset, to + offset) ?? true).every(Boolean)) {
    return pairs(removed);
  }
  if (!compare) {
    return [{ original: [at, at + removed], modified: [to, to + added], kind: 'other' }];
  }
  let first = 0;
  while (first < removed && first < added && compare.similar(at + first, to + first)) {
    first++;
  }
  let last = 0;
  while (last < removed - first && last < added - first && compare.similar(at + removed - 1 - last, to + added - 1 - last)) {
    last++;
  }
  const rows = pairs(first);
  if (removed - first - last > 0 || added - first - last > 0) {
    rows.push({ original: [at + first, at + removed - last], modified: [to + first, to + added - last], kind: 'other' });
  }
  for (let offset = last - 1; offset >= 0; offset--) {
    rows.push(changed(removed - 1 - offset, added - 1 - offset));
  }
  return rows;
}

/** tokens counts the words and the signs of a text, as the word diff compares them. */
const tokens = (text: string): number => text.match(/[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu)?.length ?? 0;

/**
 * similarBlocks is true for two blocks of the same kind that share at least half of their words and signs, by the word
 * diff: then they are one changed block.
 * @param a - A block.
 * @param b - Another block.
 */
export function similarBlocks(a: Node, b: Node): boolean {
  if (a.type !== b.type) {
    return false;
  }
  const first = blockText(a, 0).text;
  const second = blockText(b, 0).text;
  const most = Math.max(tokens(first), tokens(second));
  if (most === 0) {
    return true;
  }
  const same = diffWordsWithSpace(first, second).reduce((count, part) => (part.added || part.removed ? count : count + tokens(part.value)), 0);
  return same / most >= 0.5;
}

/**
 * rowsKey returns the key of the rows of a diff: the number of the blocks of each side of each row and the kind of the
 * row. Both sides of the same two texts have the same key.
 * @param rows - The rows.
 */
export function rowsKey(rows: readonly ChangeRow[]): string {
  return rows.map((row) => `${row.original[1] - row.original[0]}.${row.modified[1] - row.modified[0]}${row.kind[0]}`).join(' ');
}

/**
 * spacerHeights returns the height of the spacer of each row of one side: what the row lacks against the higher side.
 * @param own - The natural heights of the rows of this side.
 * @param other - The natural heights of the rows of the other side.
 */
export function spacerHeights(own: readonly number[], other: readonly number[]): number[] {
  return own.map((height, index) => Math.max(0, (other[index] ?? 0) - height));
}

/**
 * changeStarts returns the index of the first row of each change: of each run of rows that are not the same.
 * @param rows - The rows.
 */
export function changeStarts(rows: readonly ChangeRow[]): number[] {
  return rows.flatMap((row, index) => (row.kind !== 'same' && (index === 0 || rows[index - 1].kind === 'same') ? [index] : []));
}

/** BlockText is the text of a block, with the position in the document of each of its characters, -1 between blocks. */
interface BlockText {
  readonly text: string;
  readonly positions: readonly number[];
}

/**
 * blockText returns the text of a block for the word diff: the text of its textblocks, with a line break between them.
 * @param node - The block.
 * @param start - The position of the block in the document.
 */
function blockText(node: Node, start: number): BlockText {
  let text = '';
  const positions: number[] = [];
  const visit = (child: Node, pos: number) => {
    if (child.isTextblock && text !== '') {
      text += '\n';
      positions.push(-1);
    }
    if (child.isText && child.text) {
      text += child.text;
      for (let offset = 0; offset < child.text.length; offset++) {
        positions.push(start + 1 + pos + offset);
      }
    }
  };
  if (node.isTextblock) {
    node.forEach((child, offset) => visit(child, offset));
  } else {
    node.descendants((child, pos) => visit(child, pos));
  }
  return { text, positions };
}

/**
 * wordRanges returns the ranges of the document of the words that this side changed in a pair of blocks: the removed
 * words on the side `original`, the new words on the side `modified`.
 * @param own - The text of the block of this side.
 * @param other - The text of the block of the other side.
 * @param side - The side.
 */
function wordRanges(own: BlockText, other: BlockText, side: ChangeSide): { from: number; to: number }[] {
  const parts = side === 'original' ? diffWordsWithSpace(own.text, other.text) : diffWordsWithSpace(other.text, own.text);
  const ranges: { from: number; to: number }[] = [];
  let offset = 0;
  for (const part of parts) {
    const theirs = side === 'original' ? part.added : part.removed;
    if (theirs) {
      continue;
    }
    const ours = side === 'original' ? part.removed : part.added;
    if (ours) {
      // A run of characters with positions that follow each other is one range.
      for (let index = offset; index < offset + part.value.length; index++) {
        const pos = own.positions[index];
        if (pos < 0 || /\s/.test(own.text[index])) {
          continue;
        }
        const last = ranges[ranges.length - 1];
        if (last && last.to === pos) {
          last.to = pos + 1;
        } else {
          ranges.push({ from: pos, to: pos + 1 });
        }
      }
    }
    offset += part.value.length;
  }
  return ranges;
}

/** ChangesState is the state of the plugin: the blocks of the other side and the rows. */
interface ChangesState {
  readonly side: ChangeSide;
  readonly other: readonly Node[];
  readonly otherKeys: readonly string[];
  readonly rows: readonly ChangeRow[];
  readonly decorations: DecorationSet;
}

/** changesKey is the key of the plugin of the rendered changes. */
export const changesKey = new PluginKey<ChangesState>('nsmdChanges');

/** keys holds the key of each top-level block, the JSON of the block: equal blocks have equal JSON. */
const keys = new WeakMap<Node, string>();

/** keyOf returns the key of a top-level block. */
function keyOf(node: Node): string {
  let key = keys.get(node);
  if (key === undefined) {
    key = JSON.stringify(node.toJSON());
    keys.set(node, key);
  }
  return key;
}

/** children returns the top-level blocks of a document. */
function children(doc: Node): Node[] {
  const blocks: Node[] = [];
  doc.forEach((node) => blocks.push(node));
  return blocks;
}

/** EditorChanges shows the rendered changes in an editor: the marks, the rows that line up, and the scroll together. */
export class EditorChanges {
  private readonly plugin: Plugin<ChangesState>;
  /** other holds the top-level blocks of the last text of the other side. */
  private other: Node[];
  /** spacers holds the element of the spacer of each row, by the index of the row. */
  private readonly spacers: HTMLElement[] = [];
  /** heights holds the height of the spacer of each row. */
  private heights: number[] = [];
  private natural: number[] = [];
  /** lead is the spacer before the first row, with its height, and start the natural distance of the first row. */
  private lead: HTMLElement | undefined;
  private leadHeight = 0;
  private start = 0;
  private sent: ChangeLayout | undefined;
  private otherLayout: ChangeLayout | undefined;
  private frame = 0;
  private readonly root: HTMLElement;
  private readonly observer: ResizeObserver | undefined;
  /** expected is the scroll position that this side scrolled to itself, which it does not give the other side. */
  private expected: number | undefined;
  private scrollFrame = 0;
  private destroyed = false;
  private readonly onScrollEvent = () => this.scrolled();

  /**
   * @param editor - The Tiptap editor.
   * @param options - The side, the text of the other side and the listeners.
   * @param parse - The function that reads a Markdown text into a document of the editor.
   */
  constructor(
    private readonly editor: Editor,
    private readonly options: ChangesOptions,
    private readonly parse: (text: string) => Node,
  ) {
    this.other = children(parse(options.other));
    const build = (state: EditorState, otherBlocks: readonly Node[], otherKeys: readonly string[]): ChangesState => {
      const own = children(state.doc);
      const ownKeys = own.map(keyOf);
      const [older, newer] = options.side === 'original' ? [own, otherBlocks] : [otherBlocks, own];
      const compare: BlockCompare = {
        sameKind: (a, b) => older[a].type === newer[b].type,
        similar: (a, b) => similarBlocks(older[a], newer[b]),
      };
      const rows = options.side === 'original' ? changeRows(ownKeys, otherKeys, compare) : changeRows(otherKeys, ownKeys, compare);
      return { side: options.side, other: otherBlocks, otherKeys, rows, decorations: this.decorations(state.doc, own, otherBlocks, rows) };
    };
    this.plugin = new Plugin<ChangesState>({
      key: changesKey,
      state: {
        // A new text of this side, for example after the page started again, keeps the last text of the other side.
        init: (_config, state) => build(state, this.other, this.other.map(keyOf)),
        apply: (tr, value, _oldState, newState) => {
          const meta = tr.getMeta(changesKey) as { other: Node[] } | undefined;
          if (meta) {
            return build(newState, meta.other, meta.other.map(keyOf));
          }
          return tr.docChanged ? build(newState, value.other, value.otherKeys) : value;
        },
      },
      props: { decorations: (state) => changesKey.getState(state)?.decorations },
      view: () => ({ update: () => this.schedule() }),
    });
    this.root = (editor.view.dom.closest('.nsmd-editor') as HTMLElement | null) ?? editor.view.dom;
    this.root.classList.add('nsmd-diff', `nsmd-diff-${options.side}`);
    editor.registerPlugin(this.plugin);
    this.scroller().addEventListener('scroll', this.onScrollEvent, { passive: true });
    if (typeof ResizeObserver === 'function') {
      this.observer = new ResizeObserver(() => this.schedule());
      this.observer.observe(editor.view.dom);
    }
    this.schedule();
  }

  /** rows returns the rows of the diff. */
  get rows(): readonly ChangeRow[] {
    return changesKey.getState(this.editor.state)?.rows ?? [];
  }

  /**
   * setOther takes a new text of the other side.
   * @param text - The Markdown text of the other side.
   */
  setOther(text: string): void {
    if (this.destroyed) {
      return;
    }
    this.other = children(this.parse(text));
    this.editor.view.dispatch(this.editor.state.tr.setMeta(changesKey, { other: this.other }).setMeta('addToHistory', false));
  }

  /**
   * setOtherLayout takes the natural heights of the rows of the other side, and lines up the rows.
   * @param layout - The heights, with the key of their rows.
   */
  setOtherLayout(layout: ChangeLayout): void {
    this.otherLayout = layout;
    this.align();
  }

  /**
   * scrollTo scrolls this side to a place in the rows, for example the place that the other side shows.
   * @param position - The row and the offset from its top.
   */
  scrollTo(position: ChangePosition): void {
    const tops = this.tops();
    const top = tops[Math.max(0, Math.min(position.row, tops.length - 1))];
    if (top === undefined) {
      return;
    }
    const scroller = this.scroller();
    const target = Math.max(0, scroller.scrollTop + top + position.offset - this.viewTop());
    this.expected = Math.round(target);
    scroller.scrollTop = target;
  }

  /** next scrolls to the next change below the top of the view, and returns false when there is none. */
  next(): boolean {
    return this.goTo(1);
  }

  /** previous scrolls to the previous change above the top of the view, and returns false when there is none. */
  previous(): boolean {
    return this.goTo(-1);
  }

  /** destroy removes the marks and the spacers. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.scrollFrame);
    this.observer?.disconnect();
    this.scroller().removeEventListener('scroll', this.onScrollEvent);
    this.root.classList.remove('nsmd-diff', `nsmd-diff-${this.options.side}`);
    if (!this.editor.isDestroyed) {
      this.editor.unregisterPlugin(changesKey);
    }
  }

  /** goTo scrolls to the change after or before the top of the view. */
  private goTo(direction: 1 | -1): boolean {
    const starts = changeStarts(this.rows);
    const tops = this.tops();
    const view = this.viewTop();
    // A change counts as reached when its top is near the top of the view, below the bar of the editor that stays at the
    // top while the text scrolls.
    const margin = 24 + this.headerHeight();
    const candidates = direction === 1 ? starts.filter((row) => tops[row] > view + margin + 1) : starts.filter((row) => tops[row] < view + margin - 1).reverse();
    const row = candidates[0];
    if (row === undefined) {
      return false;
    }
    this.scrollTo({ row, offset: -margin });
    this.options.onScroll?.(this.position());
    return true;
  }

  /**
   * decorations returns the marks of the changes of this side and the spacers at the end of each row.
   * @param doc - The document of this side.
   * @param own - Its top-level blocks.
   * @param other - The top-level blocks of the other side.
   * @param rows - The rows.
   */
  private decorations(doc: Node, own: readonly Node[], other: readonly Node[], rows: readonly ChangeRow[]): DecorationSet {
    const side = this.options.side;
    const starts: number[] = [];
    doc.forEach((_node, offset) => starts.push(offset));
    const startOf = (index: number) => (index < starts.length ? starts[index] : doc.content.size);
    // The spacer before the first row stands before the spacers of the empty rows at the start.
    const decorations: Decoration[] = [Decoration.widget(0, () => this.leadSpacer(), { side: -rows.length - 2, key: 'nsmd-diff-lead', ignoreSelection: true })];
    rows.forEach((row, index) => {
      const [from, to] = side === 'original' ? row.original : row.modified;
      if (row.kind !== 'same') {
        for (let block = from; block < to; block++) {
          const start = startOf(block);
          decorations.push(Decoration.node(start, start + own[block].nodeSize, { class: row.kind === 'changed' ? 'nsmd-diff-changed' : 'nsmd-diff-block' }));
        }
      }
      if (row.kind === 'changed') {
        const otherIndex = side === 'original' ? row.modified[0] : row.original[0];
        const otherBlock = other[otherIndex];
        if (otherBlock) {
          for (const range of wordRanges(blockText(own[from], startOf(from)), blockText(otherBlock, 0), side)) {
            decorations.push(Decoration.inline(range.from, range.to, { class: 'nsmd-diff-word' }));
          }
        }
      }
      // The spacers of the rows stand in the order of the rows, also where an empty row stands at the same place.
      decorations.push(Decoration.widget(startOf(to), () => this.spacer(index), { side: index - rows.length - 1, key: `nsmd-diff-spacer-${index}`, ignoreSelection: true }));
    });
    return DecorationSet.create(doc, decorations);
  }

  /** spacer returns the element of the spacer of a row, the same element for each drawing. */
  private spacer(index: number): HTMLElement {
    let element = index >= 0 ? this.spacers[index] : undefined;
    if (!element) {
      element = this.root.ownerDocument.createElement('div');
      element.className = 'nsmd-diff-spacer';
      element.contentEditable = 'false';
      element.setAttribute('aria-hidden', 'true');
      if (index >= 0) {
        this.spacers[index] = element;
      }
    }
    element.style.height = `${this.heights[index] ?? 0}px`;
    return element;
  }

  /** leadSpacer returns the element of the spacer before the first row. */
  private leadSpacer(): HTMLElement {
    if (!this.lead) {
      this.lead = this.spacer(-1);
      this.lead.classList.add('nsmd-diff-lead');
    }
    this.lead.style.height = `${this.leadHeight}px`;
    return this.lead;
  }

  /** schedule measures the rows in the next frame. */
  private schedule(): void {
    if (this.destroyed) {
      return;
    }
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.measure());
  }

  /** measure measures the natural heights of the rows, gives them to the other side when they changed, and lines up. */
  private measure(): void {
    const rows = this.rows;
    // A hidden editor, for example while the page shows the pages, has no heights; it measures when it shows again.
    if (this.destroyed || !this.editor.view.dom.isConnected || this.editor.view.dom.closest('[hidden]') || rows.length === 0) {
      return;
    }
    const spacers = [...this.spacers.slice(0, rows.length), ...(this.lead ? [this.lead] : [])];
    const kept = spacers.map((spacer) => spacer.style.height);
    spacers.forEach((spacer) => (spacer.style.height = '0px'));
    const tops = this.tops();
    const scroller = this.scroller();
    const contentTop = this.viewTop() - scroller.scrollTop;
    spacers.forEach((spacer, index) => (spacer.style.height = kept[index]));
    this.natural = tops.slice(0, -1).map((top, index) => Math.max(0, tops[index + 1] - top));
    this.start = tops[0] - contentTop;
    const round = (value: number) => Math.round(value * 10) / 10;
    const layout: ChangeLayout = { rows: rowsKey(rows), heights: this.natural.map(round), start: round(this.start) };
    const sent = this.sent;
    if (!sent || sent.rows !== layout.rows || Math.abs(sent.start - layout.start) > 0.5 || sent.heights.some((height, index) => Math.abs(height - layout.heights[index]) > 0.5)) {
      this.sent = layout;
      this.options.onLayout?.(layout);
    }
    this.align();
  }

  /**
   * align sets the spacers so that each row has the height of the same row of the other side, when the other side has
   * the same rows; else every spacer has the height 0.
   */
  private align(): void {
    const rows = this.rows;
    const other = this.otherLayout;
    if (this.destroyed || this.natural.length !== rows.length) {
      return;
    }
    const same = other !== undefined && other.rows === rowsKey(rows);
    this.heights = same ? spacerHeights(this.natural, other.heights) : rows.map(() => 0);
    this.leadHeight = same ? Math.max(0, other.start - this.start) : 0;
    if (this.lead) {
      this.lead.style.height = `${this.leadHeight}px`;
    }
    this.apply(rows.length);
  }

  /** apply sets the heights of the spacers of the rows. */
  private apply(count: number): void {
    for (let index = 0; index < count; index++) {
      const spacer = this.spacers[index];
      if (spacer) {
        spacer.style.height = `${this.heights[index] ?? 0}px`;
      }
    }
  }

  /**
   * tops returns the top of each row in the coordinates of the window, and at the end the bottom of the last row: the
   * top of the first block of a row, or the top of its spacer for a row without blocks on this side.
   */
  private tops(): number[] {
    const view = this.editor.view;
    const rows = this.rows;
    const side = this.options.side;
    const starts: number[] = [];
    view.state.doc.forEach((_node, offset) => starts.push(offset));
    const tops = rows.map((row, index) => {
      const [from, to] = side === 'original' ? row.original : row.modified;
      const element = from < to ? (view.nodeDOM(starts[from]) as HTMLElement | null) : this.spacers[index];
      return element?.getBoundingClientRect?.().top ?? 0;
    });
    tops.push(contentBottom(view));
    return tops;
  }

  /** headerHeight returns the height of the bar at the top of the editor that stays in place while the text scrolls. */
  private headerHeight(): number {
    const header = this.root.querySelector<HTMLElement>('.nsmd-header');
    return header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().height : 0;
  }

  /** scroller returns the element that scrolls the editor. */
  private scroller(): HTMLElement {
    if (this.options.scroller) {
      return this.options.scroller;
    }
    const page = this.root.ownerDocument;
    for (let element = this.root.parentElement; element && element !== page.body && element !== page.documentElement; element = element.parentElement) {
      const overflow = getComputedStyle(element).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') {
        return element;
      }
    }
    return (page.scrollingElement as HTMLElement | null) ?? page.documentElement;
  }

  /** viewTop returns the top of the view of the scroller, in the coordinates of the window. */
  private viewTop(): number {
    const scroller = this.scroller();
    const page = this.root.ownerDocument;
    return scroller === page.scrollingElement || scroller === page.documentElement ? 0 : scroller.getBoundingClientRect().top;
  }

  /** position returns the row at the top of the view and the offset from its top. */
  private position(): ChangePosition {
    const tops = this.tops();
    const view = this.viewTop();
    let row = 0;
    while (row + 1 < tops.length - 1 && tops[row + 1] <= view) {
      row++;
    }
    return { row, offset: view - (tops[row] ?? view) };
  }

  /** scrolled gives the other side the place at the top of the view, after a scroll of the user. */
  private scrolled(): void {
    const scroller = this.scroller();
    if (this.expected !== undefined && Math.abs(scroller.scrollTop - this.expected) <= 1) {
      this.expected = undefined;
      return;
    }
    this.expected = undefined;
    cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => this.options.onScroll?.(this.position()));
  }
}

/** contentBottom returns the bottom of the content of the view, without its padding, in the coordinates of the window. */
function contentBottom(view: EditorView): number {
  const dom = view.dom as HTMLElement;
  const rect = dom.getBoundingClientRect?.();
  if (!rect) {
    return 0;
  }
  const padding = Number.parseFloat(getComputedStyle(dom).paddingBottom) || 0;
  return rect.bottom - padding;
}
