// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The bar of find and replace (docs/editor.md, R-GEN-003), under the toolbar: a field for the searched text with the
// number of matches, the buttons for the match before and after, the switch for capital and small letters, and a
// field for the new text with Replace and Replace all. Enter goes to the next match and Shift+Enter to the match
// before; Escape closes the bar. In read-only mode, the bar has no replace.

import type { EditorView } from '@tiptap/pm/view';
import { button, element, icon } from './dom';
import { findKey, findNext, replaceAll, replaceMatch, setFind } from './find';

/** FindBar is the bar of find and replace. */
export class FindBar {
  readonly dom: HTMLElement;
  private readonly query: HTMLInputElement;
  private readonly replacement: HTMLInputElement;
  private readonly count: HTMLElement;
  private readonly caseSensitive: HTMLButtonElement;
  private readonly replaceRow: HTMLElement;

  /**
   * @param view - The view of the editor.
   */
  constructor(private readonly view: EditorView) {
    this.query = element('input', { class: 'nsmd-find-input', type: 'text', placeholder: 'Find', 'aria-label': 'Find', spellcheck: 'false' });
    this.replacement = element('input', { class: 'nsmd-find-input', type: 'text', placeholder: 'Replace', 'aria-label': 'Replace', spellcheck: 'false' });
    this.count = element('span', { class: 'nsmd-find-count', 'aria-live': 'polite' });
    this.caseSensitive = button('Match case', element('span', { class: 'nsmd-glyph' }, 'Aa'), () => {
      this.caseSensitive.classList.toggle('nsmd-button-active');
      this.caseSensitive.setAttribute('aria-pressed', this.isCaseSensitive() ? 'true' : 'false');
      this.search();
    });
    this.caseSensitive.setAttribute('aria-pressed', 'false');
    const replace = element('button', { type: 'button', class: 'nsmd-button nsmd-button-text' }, 'Replace');
    replace.addEventListener('click', () => replaceMatch(this.view, this.replacement.value));
    const all = element('button', { type: 'button', class: 'nsmd-button nsmd-button-text' }, 'Replace all');
    all.addEventListener('click', () => replaceAll(this.view, this.replacement.value));
    this.replaceRow = element('div', { class: 'nsmd-find-row' }, this.replacement, replace, all);
    const findRow = element(
      'div',
      { class: 'nsmd-find-row' },
      this.query,
      this.count,
      this.caseSensitive,
      button('Match before (Shift+Enter)', icon('up'), () => findNext(this.view, -1)),
      button('Next match (Enter)', icon('down'), () => findNext(this.view, 1)),
      button('Close (Escape)', icon('close'), () => this.close()),
    );
    this.dom = element('div', { class: 'nsmd-find', role: 'search', hidden: true }, findRow, this.replaceRow);
    this.query.addEventListener('input', () => this.search());
    this.query.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        findNext(this.view, event.shiftKey ? -1 : 1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    this.replacement.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          replaceAll(this.view, this.replacement.value);
        } else {
          replaceMatch(this.view, this.replacement.value);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
  }

  /** isOpen is true while the bar shows. */
  get isOpen(): boolean {
    return !this.dom.hidden;
  }

  /** open shows the bar with the selected text as the searched text, and puts the focus into the field. */
  open(): void {
    const { selection, doc } = this.view.state;
    const selected = selection.empty ? '' : doc.textBetween(selection.from, selection.to, ' ');
    if (selected && !selected.includes('\n') && selected.length <= 200) {
      this.query.value = selected;
    }
    this.dom.hidden = false;
    this.update();
    this.query.focus();
    this.query.select();
    this.search();
  }

  /** close hides the bar, removes the marks of the matches and gives the focus back to the editor. */
  close(): void {
    if (!this.isOpen) {
      return;
    }
    this.dom.hidden = true;
    setFind(this.view, '', false);
    this.view.focus();
  }

  /** search searches the text of the field again, for example after a new text of the editor. */
  search(): void {
    if (this.isOpen) {
      setFind(this.view, this.query.value, this.isCaseSensitive());
    }
  }

  /** update shows the number of matches and hides replace in read-only mode. */
  update(): void {
    if (!this.isOpen) {
      return;
    }
    this.replaceRow.hidden = !this.view.editable;
    const state = findKey.getState(this.view.state);
    if (!state || state.query === '') {
      this.count.textContent = '';
    } else if (state.matches.length === 0) {
      this.count.textContent = 'No results';
    } else {
      this.count.textContent = `${state.current + 1} of ${state.matches.length}`;
    }
  }

  private isCaseSensitive(): boolean {
    return this.caseSensitive.classList.contains('nsmd-button-active');
  }
}
