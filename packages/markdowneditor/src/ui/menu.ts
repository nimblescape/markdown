// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The menu of the editor (docs/editor.md, R-GEN-003): one list of items under a point of the page, for the insert menu
// "+", the slash commands, the text styles and the lists of the format bar. Typed words filter the items; the arrow
// keys move the active item, Enter chooses it and Escape closes the menu.

import { element, icon, type IconName, place } from './dom';

/** MenuItem is an item of a menu. */
export interface MenuItem {
  /** id names the item, for example `heading1`. */
  id: string;
  /** label is the text of the item. */
  label: string;
  /** keywords are more words that find the item when the user types them. */
  keywords?: string[];
  /** icon is the icon of the item. */
  icon?: IconName;
  /** hint is a short text at the right of the item, for example the Markdown that it writes. */
  hint?: string;
  /**
   * slash is the name of the item as a slash command, small letters, for example `h1` for `/h1`: the same name as the
   * command in the text editor of the platform (R-GEN-003). The slash commands show it at the right of the item, and the
   * typed name finds the item first.
   */
  slash?: string;
  /**
   * selection marks a command on selected text, for example adding a note: the slash commands offer it only after a
   * slash typed on selected text, and select the text again before it runs. The slash commands offer the other items
   * only without selected text, and the other menus offer no command on selected text.
   */
  selection?: boolean;
  /** active marks the item that applies at the selection, for example the current text style. */
  active?: boolean;
  /** run does what the item does. */
  run: () => void;
}

/**
 * matches returns the items whose label, id, name as a slash command or keywords start with each word of a query, in
 * their order; the items whose name as a slash command is the query come first.
 * @param items - The items.
 * @param query - The typed words.
 */
export function matches(items: readonly MenuItem[], query: string): MenuItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [...items];
  }
  const found = items.filter((item) => {
    const terms = [item.label, item.id, item.slash ?? '', ...(item.keywords ?? [])].join(' ').toLowerCase().split(/[\s-]+/);
    return words.every((word) => terms.some((term) => term.startsWith(word)));
  });
  const named = words.join(' ');
  return [...found.filter((item) => item.slash === named), ...found.filter((item) => item.slash !== named)];
}

/** Menu is a list of items at a point of the box of the editor. */
export class Menu {
  readonly dom: HTMLElement;
  private items: MenuItem[] = [];
  private shown: MenuItem[] = [];
  private active = 0;
  private onClose: (() => void) | undefined;

  /**
   * @param box - The box of the editor, which holds the menu.
   * @param label - The name of the menu for screen readers.
   */
  constructor(
    private readonly box: HTMLElement,
    label: string,
  ) {
    this.dom = element('div', { class: 'nsmd-menu', role: 'listbox', 'aria-label': label, hidden: true });
    this.dom.addEventListener('mousedown', (event) => event.preventDefault());
    box.append(this.dom);
  }

  /** owner is the part of the editor that opened the menu. */
  owner = '';

  /** isOpen is true while the menu shows. */
  get isOpen(): boolean {
    return !this.dom.hidden;
  }

  /**
   * open shows the menu under a point of the page.
   * @param items - The items.
   * @param left - The left edge on the page.
   * @param top - The top edge on the page.
   * @param onClose - What to do when the menu closes, for example to give the focus back to the editor.
   * @param owner - The part of the editor that opens the menu, for example `slash`.
   */
  open(items: MenuItem[], left: number, top: number, onClose?: () => void, owner = ''): void {
    this.close();
    this.items = items;
    this.onClose = onClose;
    this.owner = owner;
    this.dom.hidden = false;
    this.filter('');
    place(this.dom, this.box, left, top);
  }

  /**
   * filter shows the items that match the typed words. It returns the number of items that it shows.
   * @param query - The typed words.
   */
  filter(query: string): number {
    this.shown = matches(this.items, query);
    const current = this.shown.findIndex((item) => item.active);
    this.active = current >= 0 ? current : 0;
    this.render();
    return this.shown.length;
  }

  /**
   * move moves the active item.
   * @param step - 1 for the next item, -1 for the item before.
   */
  move(step: number): void {
    if (this.shown.length === 0) {
      return;
    }
    this.active = (this.active + step + this.shown.length) % this.shown.length;
    this.render();
  }

  /** choose runs the active item and closes the menu. It returns false when no item shows. */
  choose(): boolean {
    const item = this.shown[this.active];
    if (!item) {
      return false;
    }
    this.close();
    item.run();
    return true;
  }

  /**
   * keydown handles the keys of the menu while it is open. It returns true for a key that it used.
   * @param event - The event of the key.
   */
  keydown(event: KeyboardEvent): boolean {
    if (!this.isOpen) {
      return false;
    }
    switch (event.key) {
      case 'ArrowDown':
        this.move(1);
        return true;
      case 'ArrowUp':
        this.move(-1);
        return true;
      case 'Enter':
      case 'Tab':
        return this.choose();
      case 'Escape':
        this.close();
        return true;
      default:
        return false;
    }
  }

  /** close hides the menu. */
  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.dom.hidden = true;
    this.dom.replaceChildren();
    this.owner = '';
    const onClose = this.onClose;
    this.onClose = undefined;
    onClose?.();
  }

  /** destroy removes the menu from the page. */
  destroy(): void {
    this.dom.remove();
  }

  private render(): void {
    if (this.shown.length === 0) {
      this.dom.replaceChildren(element('div', { class: 'nsmd-menu-empty' }, 'No results'));
      return;
    }
    this.dom.replaceChildren(
      ...this.shown.map((item, index) => {
        const row = element(
          'div',
          {
            class: `nsmd-menu-item${index === this.active ? ' nsmd-menu-item-active' : ''}`,
            role: 'option',
            'aria-selected': index === this.active ? 'true' : 'false',
            'data-item': item.id,
          },
          item.icon ? icon(item.icon) : undefined,
          element('span', { class: 'nsmd-menu-label' }, item.label),
          item.hint ? element('span', { class: 'nsmd-menu-hint' }, item.hint) : undefined,
        );
        row.addEventListener('mouseenter', () => {
          this.active = index;
          for (const each of this.dom.children) {
            each.classList.toggle('nsmd-menu-item-active', each === row);
          }
        });
        row.addEventListener('click', () => {
          this.active = index;
          this.choose();
        });
        return row;
      }),
    );
    this.dom.children[this.active]?.scrollIntoView?.({ block: 'nearest' });
  }
}
