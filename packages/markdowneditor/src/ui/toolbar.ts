// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The toolbar (docs/editor.md, R-GEN-003, R-GEN-008, R-GEN-013): a bar at the top of the editor with undo and redo,
// the text style and the list of the block of the cursor, the insert menu "+", find and replace, the switch of the
// mode to learn Markdown and the switch between editing and reading. The code that integrates the editor decides
// whether the two switches show. In read-only mode, the toolbar shows only the buttons that do not change the text.

import type { Editor } from '@tiptap/core';
import { button, element, icon } from './dom';
import { listItems, textStyleItems, textStyleName } from './items';
import type { Menu, MenuItem } from './menu';

/** Switch is a switch of the toolbar: whether it is on, and how to change it. */
export interface Switch {
  isOn: () => boolean;
  toggle: () => void;
  /** isShown is false while the toolbar hides the switch; the default is true. */
  isShown?: () => boolean;
}

/** ToolbarHost is what the toolbar needs from the editor. */
export interface ToolbarHost {
  editor: Editor;
  menu: Menu;
  insertItems: () => MenuItem[];
  openFind: () => void;
  /** learn is the switch of the mode to learn Markdown, or undefined when the toolbar does not show it. */
  learn?: Switch;
  /** editing is the switch between editing and reading, or undefined when the toolbar does not show it. */
  editing?: Switch;
}

/** Toolbar is the bar at the top of the editor. */
export class Toolbar {
  readonly dom: HTMLElement;
  private readonly undo: HTMLButtonElement;
  private readonly redo: HTMLButtonElement;
  private readonly style: HTMLButtonElement;
  private readonly list: HTMLButtonElement;
  private readonly editingOnly: HTMLElement[];
  private readonly learn: HTMLButtonElement | undefined;
  private readonly editing: HTMLButtonElement | undefined;

  /**
   * @param host - The editor and the parts of its interaction.
   */
  constructor(private readonly host: ToolbarHost) {
    const { editor } = host;
    this.undo = button('Undo (Ctrl+Z)', icon('undo'), () => editor.chain().focus().undo().run());
    this.redo = button('Redo (Ctrl+Shift+Z)', icon('redo'), () => editor.chain().focus().redo().run());
    this.style = button('Text style', '', () => this.openMenu(this.style, textStyleItems(editor)));
    this.style.classList.add('nsmd-button-text');
    this.list = button('List', icon('bulletList'), () => this.openMenu(this.list, listItems(editor)));
    const insert = button('Insert', icon('plus'), () => this.openMenu(insert, host.insertItems()));
    const find = button('Find and replace (Ctrl+F)', icon('find'), () => host.openFind());
    const separator = () => element('span', { class: 'nsmd-separator', role: 'separator' });
    const first = separator();
    const second = separator();
    this.editingOnly = [this.undo, this.redo, first, this.style, this.list, insert, second];
    if (host.learn) {
      const learn = host.learn;
      this.learn = button('Show the Markdown marks', icon('learn'), () => learn.toggle());
    }
    if (host.editing) {
      const editing = host.editing;
      this.editing = button('Read', icon('read'), () => editing.toggle());
      this.editing.classList.add('nsmd-button-text');
    }
    this.dom = element(
      'div',
      { class: 'nsmd-toolbar', role: 'toolbar', 'aria-label': 'Editor' },
      this.undo,
      this.redo,
      first,
      this.style,
      this.list,
      insert,
      second,
      find,
      this.learn,
      element('span', { class: 'nsmd-toolbar-space' }),
      this.editing,
    );
    this.dom.addEventListener('mousedown', (event) => event.preventDefault());
    this.update();
  }

  /** update shows the state of the editor in the buttons: undo, the text style, the switches. */
  update(): void {
    const { editor } = this.host;
    const editable = editor.isEditable;
    for (const each of this.editingOnly) {
      each.hidden = !editable;
    }
    this.undo.disabled = !editor.can().undo();
    this.redo.disabled = !editor.can().redo();
    this.style.replaceChildren(element('span', {}, textStyleName(editor)), icon('chevron'));
    const inList = editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList');
    this.list.classList.toggle('nsmd-button-active', inList);
    if (this.learn && this.host.learn) {
      const on = this.host.learn.isOn();
      this.learn.classList.toggle('nsmd-button-active', on);
      this.learn.setAttribute('aria-pressed', on ? 'true' : 'false');
      this.learn.title = on ? 'Hide the Markdown marks' : 'Show the Markdown marks';
    }
    if (this.editing) {
      this.editing.hidden = this.host.editing?.isShown?.() === false;
      // The button names the mode that it switches to.
      const label = editable ? 'Read' : 'Edit';
      this.editing.replaceChildren(icon(editable ? 'read' : 'edit'), element('span', {}, label));
      this.editing.title = editable ? 'Switch to read-only mode' : 'Switch to editing';
      this.editing.setAttribute('aria-label', this.editing.title);
    }
  }

  private openMenu(anchor: HTMLElement, items: MenuItem[]): void {
    const rect = anchor.getBoundingClientRect();
    this.host.menu.open(items, rect.left, rect.bottom + 4, undefined, 'toolbar');
  }
}
