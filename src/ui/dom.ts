// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// Small helpers for the elements of the interaction of the editor (docs/editor.md, R-GEN-003): the toolbar, the
// format bar, the menus, the block handles and the find bar. They use the DOM of the page directly, so the editor needs
// no framework. The icons are drawn for nimblescape Markdown: simple lines on a grid of 16 by 16.

/** Attributes are the attributes of an element; `false` and `undefined` leave an attribute out. */
type Attributes = Record<string, string | number | boolean | undefined>;

/**
 * element creates an element with attributes and children.
 * @param tag - The name of the element.
 * @param attributes - The attributes; `class` sets the class name.
 * @param children - Elements and texts.
 */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: (Node | string | undefined)[]
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) {
      continue;
    }
    created.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child !== undefined) {
      created.append(child);
    }
  }
  return created;
}

/** paths holds the drawing of each icon, as the `d` of the paths of an SVG of 16 by 16. */
const paths = {
  plus: ['M8 3v10', 'M3 8h10'],
  handle: ['M6 4h.01', 'M10 4h.01', 'M6 8h.01', 'M10 8h.01', 'M6 12h.01', 'M10 12h.01'],
  link: ['M7 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-.75.75', 'M9 6.5a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l.75-.75'],
  bulletList: ['M6 4h7', 'M6 8h7', 'M6 12h7', 'M3 4h.01', 'M3 8h.01', 'M3 12h.01'],
  orderedList: ['M7 4h6', 'M7 8h6', 'M7 12h6', 'M3 3v3', 'M2.5 9.5h1.5l-1.5 2h1.5'],
  taskList: ['M7 5h6', 'M7 11h6', 'M2.5 3.5h3v3h-3z', 'M2.5 9.5l1 1 2-2'],
  quote: ['M3 4v8', 'M6 5h7', 'M6 8h7', 'M6 11h5'],
  codeBlock: ['M5.5 5L3 8l2.5 3', 'M10.5 5L13 8l-2.5 3'],
  rule: ['M2 8h12'],
  table: ['M2.5 3.5h11v9h-11z', 'M2.5 6.5h11', 'M7 6.5v6'],
  image: ['M2.5 3.5h11v9h-11z', 'M2.5 11l3-3 2.5 2.5 2-2 3.5 3.5', 'M10.5 6h.01'],
  alert: ['M8 2.5l5.5 10h-11z', 'M8 6.5v3', 'M8 11h.01'],
  footnote: ['M3 12h6', 'M3 9h8', 'M12 3v4', 'M11 4l1-1'],
  heading: ['M3 3v10', 'M10 3v10', 'M3 8h7', 'M12.5 8.5v4.5'],
  paragraph: ['M9 3v10', 'M12 3v10', 'M13 3H7a3 3 0 0 0 0 6h2'],
  undo: ['M5 6H10a3 3 0 0 1 0 6H7', 'M7 3.5L4.5 6 7 8.5'],
  redo: ['M11 6H6a3 3 0 0 0 0 6h3', 'M9 3.5L11.5 6 9 8.5'],
  find: ['M7 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', 'M10 10l3.5 3.5'],
  edit: ['M10.5 3l2.5 2.5-7 7H3.5V10z', 'M9 4.5l2.5 2.5'],
  read: ['M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z', 'M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
  learn: ['M2 4.5h4.5v7H2z', 'M9.5 4.5H14v7H9.5z', 'M6.5 8h3'],
  close: ['M4 4l8 8', 'M12 4l-8 8'],
  up: ['M4 10l4-4 4 4'],
  down: ['M4 6l4 4 4-4'],
  chevron: ['M5 6.5l3 3 3-3'],
} as const;

/** IconName is the name of an icon of the editor. */
export type IconName = keyof typeof paths;

/**
 * icon returns the SVG of an icon. It takes the color of the text, so it follows the theme.
 * @param name - The name of the icon.
 */
export function icon(name: IconName): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'nsmd-icon');
  for (const d of paths[name]) {
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/**
 * button creates a button of the toolbar or of the format bar. It keeps the focus in the editor, so that the
 * selection stays when the user clicks it.
 * @param label - The name of the button, for the tooltip and for screen readers.
 * @param content - An icon or a text.
 * @param run - What the button does.
 */
export function button(label: string, content: Node | string, run: (event: MouseEvent) => void): HTMLButtonElement {
  const created = element('button', { type: 'button', class: 'nsmd-button', title: label, 'aria-label': label }, content);
  created.addEventListener('mousedown', (event) => event.preventDefault());
  created.addEventListener('click', (event) => {
    event.preventDefault();
    run(event);
  });
  return created;
}

/**
 * place puts an element of the editor at a point of the page, relative to the box of the editor, inside the visible
 * width of the editor.
 * @param floating - The element, with `position: absolute` in the box of the editor.
 * @param box - The box of the editor.
 * @param left - The left edge on the page.
 * @param top - The top edge on the page.
 */
export function place(floating: HTMLElement, box: HTMLElement, left: number, top: number): void {
  const frame = box.getBoundingClientRect();
  const width = floating.offsetWidth;
  const x = Math.max(0, Math.min(left - frame.left, box.clientWidth - width));
  floating.style.left = `${Math.round(x)}px`;
  floating.style.top = `${Math.round(top - frame.top + box.scrollTop)}px`;
}
