// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// A field that asks the user for one text, for example the address of a link or of an image (docs/editor.md,
// R-EDIT-007). The editor does not use window.prompt, because the webviews of VS Code do not show it.

import { button, element, icon, place } from './dom';

/** Asker shows a field with a text at a point of the box of the editor. */
export class Asker {
  readonly dom: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly label: HTMLElement;
  private finish: ((value: string | undefined) => void) | undefined;

  /**
   * @param box - The box of the editor, which holds the field.
   */
  constructor(private readonly box: HTMLElement) {
    this.label = element('span', { class: 'nsmd-ask-label' });
    this.input = element('input', { class: 'nsmd-ask-input', type: 'text', spellcheck: 'false' });
    const ok = element('button', { type: 'button', class: 'nsmd-button nsmd-ask-ok' }, 'OK');
    ok.addEventListener('click', () => this.done(this.input.value));
    this.dom = element('div', { class: 'nsmd-ask', role: 'dialog', hidden: true }, this.label, this.input, ok, button('Cancel', icon('close'), () => this.done(undefined)));
    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.done(this.input.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.done(undefined);
      }
    });
    box.append(this.dom);
  }

  /** isOpen is true while the field shows. */
  get isOpen(): boolean {
    return !this.dom.hidden;
  }

  /**
   * ask shows the field and returns the text that the user confirms, or undefined when the user cancels.
   * @param label - What the field asks for.
   * @param value - The text that the field starts with.
   * @param left - The left edge on the page.
   * @param top - The top edge on the page.
   */
  ask(label: string, value: string, left: number, top: number): Promise<string | undefined> {
    this.done(undefined);
    this.label.textContent = label;
    this.input.value = value;
    this.input.setAttribute('aria-label', label);
    this.dom.hidden = false;
    place(this.dom, this.box, left, top);
    this.input.focus();
    this.input.select();
    return new Promise((resolve) => {
      this.finish = resolve;
    });
  }

  /** destroy removes the field from the page. */
  destroy(): void {
    this.done(undefined);
    this.dom.remove();
  }

  private done(value: string | undefined): void {
    const finish = this.finish;
    this.finish = undefined;
    this.dom.hidden = true;
    finish?.(value === undefined ? undefined : value.trim());
  }
}
