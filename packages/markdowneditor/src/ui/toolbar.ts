// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The toolbar (docs/editor.md, R-GEN-003, R-GEN-008): a bar at the top of the editor with undo and redo, the text
// style and the list of the block of the cursor, the insert menu "+", find and replace, and the switch between editing
// and reading. The code that integrates the editor decides whether the switch shows. In read-only mode, the toolbar
// shows only the buttons that do not change the text. Once the editor has jumped to a place of the document, the
// buttons "Go Back" and "Go Forward" show before the switch (R-EDIT-013); a button without a place is disabled.

import type { Editor } from '@tiptap/core';
import { type JumpKeys, keyLabel, platformOf } from '@nimblescape/markdownrender/jumps';
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

/** JumpButtons are the buttons "Go Back" and "Go Forward" of the jumps of the editor (R-EDIT-013). */
export interface JumpButtons {
  /** shown tells whether the editor has a place in one of the directions. */
  shown: () => boolean;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  back: () => boolean;
  forward: () => boolean;
  /** keys are the keys of Go Back and Go Forward, which the tooltips name. */
  keys?: JumpKeys;
}

/** ToolbarHost is what the toolbar needs from the editor. */
export interface ToolbarHost {
  editor: Editor;
  menu: Menu;
  insertItems: () => MenuItem[];
  openFind: () => void;
  /** editing is the switch between editing and reading, or undefined when the toolbar does not show it. */
  editing?: Switch;
  /** jumps are the buttons of the jumps, or undefined when the toolbar does not show them. */
  jumps?: JumpButtons;
}

/** Toolbar is the bar at the top of the editor. */
export class Toolbar {
  readonly dom: HTMLElement;
  private readonly undo: HTMLButtonElement;
  private readonly redo: HTMLButtonElement;
  private readonly style: HTMLButtonElement;
  private readonly list: HTMLButtonElement;
  private readonly editingOnly: HTMLElement[];
  private readonly editing: HTMLButtonElement | undefined;
  private readonly back: HTMLButtonElement | undefined;
  private readonly forward: HTMLButtonElement | undefined;

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
    if (host.jumps) {
      const jumps = host.jumps;
      const platform = platformOf(navigator);
      const label = (name: string, keys: readonly string[] | undefined) => (keys?.[0] ? `${name} (${keyLabel(keys[0], platform)})` : name);
      this.back = button(label('Go Back', jumps.keys?.back), icon('back'), () => jumps.back());
      this.forward = button(label('Go Forward', jumps.keys?.forward), icon('forward'), () => jumps.forward());
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
      element('span', { class: 'nsmd-toolbar-space' }),
      this.back,
      this.forward,
      this.editing,
    );
    this.dom.addEventListener('mousedown', (event) => event.preventDefault());
    this.update();
  }

  /** update shows the state of the editor in the buttons: undo, the text style, the switch. */
  update(): void {
    const { editor } = this.host;
    const editable = editor.isEditable;
    for (const each of this.editingOnly) {
      each.hidden = !editable;
    }
    this.undo.disabled = !editor.can().undo();
    this.redo.disabled = !editor.can().redo();
    this.style.replaceChildren(element('span', {}, textStyleName(editor)), icon('chevron'));
    if (this.back && this.forward && this.host.jumps) {
      const { jumps } = this.host;
      const shown = jumps.shown();
      this.back.hidden = !shown;
      this.forward.hidden = !shown;
      this.back.disabled = !jumps.canGoBack();
      this.forward.disabled = !jumps.canGoForward();
    }
    const inList = editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList');
    this.list.classList.toggle('nsmd-button-active', inList);
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
