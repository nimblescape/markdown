// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The handles of the blocks (docs/editor.md, R-GEN-003): left of the block under the mouse, a "+" inserts a block
// after it, and a handle moves it by drag and drop or opens the menu of the block: move up, move down, duplicate and
// delete. A block is a top-level block, or the item of a list under the mouse. Alt+Up and Alt+Down move the block of
// the cursor. Each move is one step of undo (R-EDIT-001).

import { closeHistory } from '@tiptap/pm/history';
import type { Node } from '@tiptap/pm/model';
import { NodeSelection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { button, element, icon } from './dom';
import type { Menu, MenuItem } from './menu';

/** Block is a block that a handle moves: its position and its node. */
export interface Block {
  pos: number;
  node: Node;
}

/** itemTypes are the nodes that count as blocks of their own inside a list. */
const itemTypes = new Set(['listItem', 'taskItem']);

/**
 * blockAt returns the block at a position: the innermost item of a list around it, else the top-level block.
 * @param doc - The document.
 * @param pos - A position in the document.
 */
export function blockAt(doc: Node, pos: number): Block | undefined {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (itemTypes.has($pos.node(depth).type.name)) {
      return { pos: $pos.before(depth), node: $pos.node(depth) };
    }
  }
  if ($pos.depth >= 1) {
    return { pos: $pos.before(1), node: $pos.node(1) };
  }
  // A position between top-level blocks: the block after it, else the block before it.
  const after = $pos.nodeAfter;
  if (after) {
    return { pos: $pos.pos, node: after };
  }
  const before = $pos.nodeBefore;
  return before ? { pos: $pos.pos - before.nodeSize, node: before } : undefined;
}

/**
 * moveBlock moves a block before the block before it or after the block after it, in the same parent, and keeps it
 * selected in the same way. It returns false at the first or the last place.
 * @param state - The state of the editor.
 * @param block - The block.
 * @param step - -1 to move it up, 1 to move it down.
 * @param dispatch - Applies the transaction.
 */
export function moveBlock(state: EditorState, block: Block, step: -1 | 1, dispatch?: (tr: Transaction) => void): boolean {
  const $pos = state.doc.resolve(block.pos);
  const index = $pos.index();
  const parent = $pos.parent;
  const target = index + step;
  if (target < 0 || target >= parent.childCount) {
    return false;
  }
  const neighbour = parent.child(target);
  // The front matter stays the first block of the file (R-SRC-003).
  if (block.node.type.name === 'frontMatter' || neighbour.type.name === 'frontMatter') {
    return false;
  }
  if (!dispatch) {
    return true;
  }
  const { selection } = state;
  const offset = selection.from - block.pos;
  const tr = state.tr.delete(block.pos, block.pos + block.node.nodeSize);
  const insertAt = step < 0 ? block.pos - neighbour.nodeSize : block.pos + neighbour.nodeSize;
  tr.insert(insertAt, block.node);
  if (selection instanceof NodeSelection && selection.from === block.pos) {
    tr.setSelection(NodeSelection.create(tr.doc, insertAt));
  } else if (offset >= 0 && offset <= block.node.nodeSize) {
    const length = selection.to - selection.from;
    tr.setSelection(TextSelection.create(tr.doc, insertAt + offset, insertAt + offset + length));
  }
  // Each move is one step of undo, also right after another move (R-EDIT-001).
  dispatch(closeHistory(tr).scrollIntoView());
  return true;
}

/**
 * moveCurrentBlock moves the block of the cursor up or down, for Alt+Up and Alt+Down.
 * @param state - The state of the editor.
 * @param step - -1 to move it up, 1 to move it down.
 * @param dispatch - Applies the transaction.
 */
export function moveCurrentBlock(state: EditorState, step: -1 | 1, dispatch?: (tr: Transaction) => void): boolean {
  const { selection } = state;
  const block = selection instanceof NodeSelection ? { pos: selection.from, node: selection.node } : blockAt(state.doc, selection.from);
  return block ? moveBlock(state, block, step, dispatch) : false;
}

/** BlockHandleHost is what the handles need from the editor. */
export interface BlockHandleHost {
  box: HTMLElement;
  menu: Menu;
  /** insertItems returns the items of the insert menu. */
  insertItems: () => MenuItem[];
}

/** BlockHandles are the "+" and the handle beside the block under the mouse. */
export class BlockHandles {
  readonly dom: HTMLElement;
  private readonly grip: HTMLButtonElement;
  private block: Block | undefined;

  /**
   * @param view - The view of the editor.
   * @param host - The box, the menu and the items of the insert menu.
   */
  constructor(
    private readonly view: EditorView,
    private readonly host: BlockHandleHost,
  ) {
    const add = button('Insert a block', icon('plus'), () => this.insertAfter());
    this.grip = button('Drag to move, click for the menu of the block', icon('handle'), () => this.openMenu());
    this.grip.classList.add('nsmd-grip');
    this.grip.draggable = true;
    this.grip.addEventListener('dragstart', (event) => this.dragStart(event));
    this.grip.addEventListener('dragend', () => this.hide());
    this.dom = element('div', { class: 'nsmd-block-handle', hidden: true }, add, this.grip);
    host.box.append(this.dom);
    host.box.addEventListener('mousemove', this.onMove);
    host.box.addEventListener('mouseleave', this.onLeave);
  }

  /** hide hides the handles. */
  hide(): void {
    if (!this.host.menu.isOpen || this.host.menu.owner !== 'block') {
      this.dom.hidden = true;
    }
  }

  /** destroy removes the handles from the page. */
  destroy(): void {
    this.host.box.removeEventListener('mousemove', this.onMove);
    this.host.box.removeEventListener('mouseleave', this.onLeave);
    this.dom.remove();
  }

  private readonly onLeave = (event: MouseEvent) => {
    if (!(event.relatedTarget instanceof globalThis.Node && this.dom.contains(event.relatedTarget))) {
      this.hide();
    }
  };

  private readonly onMove = (event: MouseEvent) => {
    if (!this.view.editable || this.dom.contains(event.target as globalThis.Node)) {
      return;
    }
    const content = this.view.dom.getBoundingClientRect();
    // The mouse may be in the margin left of the text, where the handles are.
    const found = this.view.posAtCoords({ left: Math.max(event.clientX, content.left + 1), top: event.clientY });
    if (!found) {
      return;
    }
    const block = blockAt(this.view.state.doc, found.inside >= 0 ? found.inside : found.pos);
    const dom = block ? (this.view.nodeDOM(block.pos) as HTMLElement | null) : null;
    // The front matter has no handles: it stays the first block, and its form has its own buttons.
    if (!block || !dom?.getBoundingClientRect || block.node.type.name === 'frontMatter') {
      this.hide();
      return;
    }
    this.block = block;
    const rect = dom.getBoundingClientRect();
    const frame = this.host.box.getBoundingClientRect();
    this.dom.hidden = false;
    const left = Math.max(0, rect.left - frame.left - this.dom.offsetWidth - 4);
    this.dom.style.left = `${Math.round(left)}px`;
    this.dom.style.top = `${Math.round(rect.top - frame.top + this.host.box.scrollTop)}px`;
  };

  /** current returns the block of the handles with its position in the current document. */
  private current(): Block | undefined {
    if (!this.block) {
      return undefined;
    }
    const node = this.view.state.doc.nodeAt(this.block.pos);
    return node === this.block.node ? this.block : undefined;
  }

  private dragStart(event: DragEvent): void {
    const block = this.current();
    if (!block || !event.dataTransfer) {
      return;
    }
    const { view } = this;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, block.pos)));
    const slice = view.state.selection.content();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', slice.content.textBetween(0, slice.content.size, '\n\n'));
    const dom = view.nodeDOM(block.pos);
    if (dom instanceof HTMLElement) {
      event.dataTransfer.setDragImage(dom, 0, 0);
    }
    // ProseMirror moves the dragged slice when it is dropped into the editor.
    (view as unknown as { dragging: { slice: typeof slice; move: boolean } | null }).dragging = { slice, move: true };
  }

  private insertAfter(): void {
    const block = this.current();
    if (!block) {
      return;
    }
    const { view } = this;
    const { paragraph } = view.state.schema.nodes;
    const empty = block.node.type === paragraph && block.node.content.size === 0;
    let tr = view.state.tr;
    let cursor = block.pos + 1;
    if (!empty) {
      const at = block.pos + block.node.nodeSize;
      // In a list, the new block is a new item of the list.
      const node = itemTypes.has(block.node.type.name) ? block.node.type.createAndFill() : paragraph.create();
      if (!node) {
        return;
      }
      tr = tr.insert(at, node);
      cursor = at + (itemTypes.has(block.node.type.name) ? 2 : 1);
    }
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
    view.focus();
    const rect = this.dom.getBoundingClientRect();
    this.host.menu.open(this.host.insertItems(), rect.right + 4, rect.bottom + 4, () => this.hide(), 'insert');
  }

  private openMenu(): void {
    const block = this.current();
    if (!block) {
      return;
    }
    const { view } = this;
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, block.pos)));
    view.focus();
    const move = (step: -1 | 1) => () => {
      const current = this.current() ?? block;
      moveBlock(view.state, current, step, view.dispatch);
      view.focus();
    };
    const items: MenuItem[] = [
      { id: 'moveUp', label: 'Move up', icon: 'up', hint: 'Alt+↑', run: move(-1) },
      { id: 'moveDown', label: 'Move down', icon: 'down', hint: 'Alt+↓', run: move(1) },
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: 'plus',
        run: () => {
          view.dispatch(view.state.tr.insert(block.pos + block.node.nodeSize, block.node.copy(block.node.content)).scrollIntoView());
          view.focus();
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'close',
        hint: 'Del',
        run: () => {
          view.dispatch(view.state.tr.delete(block.pos, block.pos + block.node.nodeSize).scrollIntoView());
          view.focus();
        },
      },
    ];
    const rect = this.grip.getBoundingClientRect();
    this.host.menu.open(items, rect.left, rect.bottom + 4, () => this.hide(), 'block');
  }
}
