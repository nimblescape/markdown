// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The generated lists of the special sections (docs/rendering.md, R-LAYOUT-001): the table of contents (TOC), the list
// of figures (LOF), the list of tables (LOT) and the list of listings (LOL), each with the page of each entry, which
// the style sheet adds with `target-counter()`. The list is the one of the file when the file holds one between the
// markers of the section, such as `<!-- toc -->` and `<!-- /toc -->`, which a formatter writes; else the layout makes
// it from the headings and the captions of the text.

import type { Layout } from './format';
import { escapeHtml } from './template';
import type { Heading, TextFound } from './text';

/** generatedLists are the special sections that show a list with the page of each entry. */
export const generatedLists = ['TOC', 'LOF', 'LOT', 'LOL'] as const;

/** GeneratedList is the code of a special section with a generated list. */
export type GeneratedList = (typeof generatedLists)[number];

/** Entry is an entry of the list of a special section in the file: the target of its link and the text of the link. */
export interface Entry {
  href: string;
  text: string;
}

/** listClasses are the classes of the element of each list. */
const listClasses: Record<GeneratedList, string> = { TOC: 'contents', LOF: 'list-of-figures', LOT: 'list-of-tables', LOL: 'list-of-listings' };

/**
 * partClass returns the class of an entry of the table of contents for the part of its heading: ` contents-front` or
 * ` contents-appendix`, so that a layout can show the page of an entry of these parts in its own numbers, else nothing.
 * @param heading - The heading of the entry, if the document has it.
 */
const partClass = (heading: Heading | undefined): string => (heading?.part === 'front' || heading?.part === 'appendix' ? ` contents-${heading.part}` : '');

/**
 * inContents is true for a heading that the table of contents lists: each heading to the depth of the layout, but not
 * its own heading, and not the headings of the front part when the layout says `contents.front: false`.
 * @param heading - The heading.
 * @param layout - The layout of the document.
 */
export function inContents(heading: Heading, layout: Pick<Layout, 'contentsDepth' | 'contentsFront'>): boolean {
  return heading.level <= layout.contentsDepth && heading.section !== 'TOC' && (layout.contentsFront || heading.part !== 'front');
}

/**
 * headingsById returns the headings of the text by their IDs and by the IDs of their anchors.
 * @param found - What the layout found in the text.
 */
const headingsById = (found: TextFound): Map<string, Heading> =>
  new Map(found.headings.flatMap((heading) => [[heading.id, heading] as const, ...(heading.anchor ? [[heading.anchor, heading] as const] : [])]));

/**
 * listOfFile returns the HTML of the list of a special section from its entries in the file, with the elements and
 * classes of the list of the layout: a heading gets the level of its heading, and the number of the text of an entry
 * its own element; the text of an entry of figures, tables or listings is a label and a caption, such as
 * "Figure 1: Participants".
 * @param code - The code of the list.
 * @param entries - The entries of the file.
 * @param found - What the layout found in the text.
 */
function listOfFile(code: GeneratedList, entries: readonly Entry[], found: TextFound): string {
  const headings = headingsById(found);
  const items = entries.map((entry) => {
    const href = `#${escapeHtml(entry.href)}`;
    if (code === 'TOC') {
      const heading = headings.get(entry.href);
      const classes = `contents-level-${heading?.level ?? 1}${heading?.appendix ? ' appendix' : /^\d/.test(entry.text) ? '' : ' unnumbered'}${partClass(heading)}`;
      const appendix = heading?.appendix ? /^(.+?):\s+(.+)$/.exec(entry.text) : null;
      const numbered = /^(\d+(?:\.\d+)*\.?)\s+(.+)$/.exec(entry.text);
      const text = appendix
        ? `<span class="contents-text"><span class="appendix-label">${escapeHtml(appendix[1])}</span><span class="appendix-separator">: </span>${escapeHtml(appendix[2])}</span>`
        : numbered
          ? `<span class="contents-number">${escapeHtml(numbered[1])}</span><span class="contents-text">${escapeHtml(numbered[2])}</span>`
          : `<span class="contents-text">${escapeHtml(entry.text)}</span>`;
      return `<li class="${classes}"><a href="${href}">${text}</a></li>`;
    }
    const caption = /^(.+?):\s+(.+)$/.exec(entry.text);
    const text = caption
      ? `<span class="caption-label">${escapeHtml(caption[1])}</span><span class="caption-separator">: </span><span class="caption-text">${escapeHtml(caption[2])}</span>`
      : `<span class="caption-text">${escapeHtml(entry.text)}</span>`;
    return `<li><a href="${href}"><span class="caption-entry">${text}</span></a></li>`;
  });
  return `<nav class="${listClasses[code]} no-hyphens"><ol>\n${items.join('\n')}\n</ol></nav>\n`;
}

/**
 * listHtml returns the HTML of the list of a special section: the table of contents, the list of figures, of tables
 * or of listings.
 * @param code - The code of the list.
 * @param found - What the layout found in the text.
 * @param layout - The layout of the document.
 */
export function listHtml(code: GeneratedList, found: TextFound, layout: Pick<Layout, 'contentsDepth' | 'contentsFront'>): string {
  const entries = found.lists[code];
  if (entries) {
    return listOfFile(code, entries, found);
  }
  if (code === 'TOC') {
    const items = found.headings
      .filter((heading) => inContents(heading, layout))
      .map((heading) => {
        const classes = `contents-level-${heading.level}${heading.appendix ? ' appendix' : heading.number ? '' : ' unnumbered'}${partClass(heading)}`;
        const entry = heading.appendix
          ? `<span class="contents-text"><span class="appendix-label">${escapeHtml(heading.number)}</span><span class="appendix-separator">: </span>${escapeHtml(heading.text)}</span>`
          : (heading.number ? `<span class="contents-number">${escapeHtml(heading.number)}</span>` : '') + `<span class="contents-text">${escapeHtml(heading.text)}</span>`;
        return `<li class="${classes}"><a href="#${escapeHtml(heading.id)}">${entry}</a></li>`;
      });
    return `<nav class="contents no-hyphens"><ol>\n${items.join('\n')}\n</ol></nav>\n`;
  }
  const captions = code === 'LOF' ? found.figures : code === 'LOT' ? found.tables : found.listings;
  const items = captions.map(
    (caption) =>
      `<li><a href="#${escapeHtml(caption.id)}"><span class="caption-entry"><span class="caption-label">${escapeHtml(caption.label)}</span><span class="caption-separator">: </span>` +
      `<span class="caption-text">${escapeHtml(caption.text)}</span></span></a></li>`,
  );
  return `<nav class="${listClasses[code]} no-hyphens"><ol>\n${items.join('\n')}\n</ol></nav>\n`;
}
