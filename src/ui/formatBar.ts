// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The format bar (docs/editor.md, R-EDIT-007): a bar over selected text with the text style, bold, italic, underline,
// strikethrough, code, the lists and the link, and the buttons that extensions add, for example Comment of Notes or
// Cite of Paper. A button shows as active when the whole selection has its format. In read-only mode, the bar shows
// only the buttons that do not change the text (R-GEN-008).

import type { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { button, element, icon, type IconName, place } from './dom';
import { listItems, textStyleItems, textStyleName } from './items';
import type { Menu } from './menu';

/** FormatButton is a button that an extension adds to the format bar, for example Comment of Notes. */
export interface FormatButton {
  /** id names the button. */
  id: string;
  /** label is the name of the button, for the tooltip and for screen readers. */
  label: string;
  /** icon is the icon of the button, or `text` its text. */
  icon?: IconName;
  text?: string;
  /** readOnly true shows the button also in read-only mode, because it does not change the text. */
  readOnly?: boolean;
  /** isActive returns true when the whole selection has the format of the button. */
  isActive?: (editor: Editor) => boolean;
  /** run does what the button does. */
  run: (editor: Editor) => void;
}

/** FormatBarHost is what the format bar needs from the editor. */
export interface FormatBarHost {
  editor: Editor;
  box: HTMLElement;
  menu: Menu;
  buttons: FormatButton[];
  editLink: () => void;
}

/** markButton returns the button of a mark of the library, with its key in the tooltip. */
function markButton(host: FormatBarHost, name: string, label: string, text: string, toggle: () => void): { dom: HTMLButtonElement; isActive: () => boolean } {
  const dom = button(label, element('span', { class: `nsmd-glyph nsmd-glyph-${name}` }, text), toggle);
  return { dom, isActive: () => host.editor.isActive(name) };
}

/** FormatBar is the bar over selected text. */
export class FormatBar {
  readonly dom: HTMLElement;
  private readonly style: HTMLButtonElement;
  private readonly states: { dom: HTMLElement; isActive: () => boolean; readOnly: boolean }[] = [];
  private pointerDown = false;

  /**
   * @param host - The editor and the parts of its interaction.
   */
  constructor(private readonly host: FormatBarHost) {
    const { editor } = host;
    const chain = () => editor.chain().focus();
    this.style = button('Text style', '', () => this.openMenu(this.style, textStyleItems(editor)));
    this.style.classList.add('nsmd-button-text');
    const list = button('List', icon('bulletList'), () => this.openMenu(list, listItems(editor)));
    const marks = [
      markButton(host, 'bold', 'Bold (Ctrl+B)', 'B', () => chain().toggleBold().run()),
      markButton(host, 'italic', 'Italic (Ctrl+I)', 'I', () => chain().toggleItalic().run()),
      ...(editor.schema.marks.underline ? [markButton(host, 'underline', 'Underline (Ctrl+U)', 'U', () => chain().toggleUnderline().run())] : []),
      markButton(host, 'strike', 'Strikethrough (Ctrl+Shift+S)', 'S', () => chain().toggleStrike().run()),
      markButton(host, 'code', 'Code (Ctrl+E)', '</>', () => chain().toggleCode().run()),
    ];
    const link = button('Link (Ctrl+K)', icon('link'), () => host.editLink());
    const library: HTMLElement[] = [this.style, ...marks.map((mark) => mark.dom), list, link];
    for (const mark of marks) {
      this.states.push({ ...mark, readOnly: false });
    }
    this.states.push({ dom: list, isActive: () => editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList'), readOnly: false });
    this.states.push({ dom: link, isActive: () => editor.isActive('link'), readOnly: false });
    this.states.push({ dom: this.style, isActive: () => false, readOnly: false });
    const extra = host.buttons.map((each) => {
      const dom = button(each.label, each.icon ? icon(each.icon) : (each.text ?? each.label), () => each.run(editor));
      dom.dataset.button = each.id;
      this.states.push({ dom, isActive: () => each.isActive?.(editor) ?? false, readOnly: each.readOnly ?? false });
      return dom;
    });
    this.dom = element('div', { class: 'nsmd-format-bar', role: 'toolbar', 'aria-label': 'Format', hidden: true }, ...extra, ...library);
    this.dom.addEventListener('mousedown', (event) => event.preventDefault());
  }

  /**
   * pointer tells the bar that the user presses or releases the mouse in the text, so that it hides while the user
   * selects.
   * @param down - true while the mouse button is down.
   * @param view - The view of the editor.
   */
  pointer(down: boolean, view: EditorView): void {
    this.pointerDown = down;
    this.update(view);
  }

  /**
   * update shows the bar over a selection of text, or hides it.
   * @param view - The view of the editor.
   */
  update(view: EditorView): void {
    const { selection } = view.state;
    const editable = view.editable;
    const hasText = !selection.empty && !(selection instanceof NodeSelection) && view.state.doc.textBetween(selection.from, selection.to, ' ').trim() !== '';
    const visible = this.states.filter((state) => editable || state.readOnly);
    const focused = view.hasFocus() || this.dom.contains(document.activeElement);
    if (!hasText || this.pointerDown || !focused || visible.length === 0 || this.host.menu.isOpen) {
      if (!this.host.menu.isOpen) {
        this.dom.hidden = true;
      }
      return;
    }
    for (const state of this.states) {
      state.dom.hidden = !(editable || state.readOnly);
      const active = state.isActive();
      state.dom.classList.toggle('nsmd-button-active', active);
      state.dom.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    this.style.replaceChildren(element('span', {}, textStyleName(this.host.editor)), icon('chevron'));
    this.dom.hidden = false;
    let start: { left: number; top: number; bottom: number };
    let end: { left: number; top: number; bottom: number };
    try {
      start = view.coordsAtPos(selection.from);
      end = view.coordsAtPos(selection.to);
    } catch {
      return;
    }
    const middle = (start.left + end.left) / 2 - this.dom.offsetWidth / 2;
    const above = Math.min(start.top, end.top) - this.dom.offsetHeight - 8;
    const top = above - this.host.box.getBoundingClientRect().top + this.host.box.scrollTop < 0 ? Math.max(start.bottom, end.bottom) + 8 : above;
    place(this.dom, this.host.box, middle, top);
  }

  /** hide hides the bar. */
  hide(): void {
    this.dom.hidden = true;
  }

  private openMenu(anchor: HTMLElement, items: Parameters<Menu['open']>[0]): void {
    const rect = anchor.getBoundingClientRect();
    this.host.menu.open(items, rect.left, rect.bottom + 4, () => this.hide());
  }
}
