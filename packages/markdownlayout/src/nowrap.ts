// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The places in the text of the pages where a line must not break (docs/rendering.md, R-LAYOUT-001): a reference to a
// place in a source, such as "S. 18 – 19", "p. 3", "Kap. 2" or "§ 8", and a range of numbers with a dash, such as
// "2015 – 2023". The browser breaks a line after "S." when the space after it is an ordinary space, as an author or an
// agent types it, and after the dash of a range also when no-break spaces stand around the dash, as the citations of
// the style of citation have them: the dash allows a break after it. The layout puts each such reference into an element
// whose text does not wrap (`nowrapClass`, with its rule in the base style sheet), so its text stays the same for search
// and copy in the PDF, which a character that joins words would change.

/** nowrapClass is the class of the elements whose text does not wrap. */
export const nowrapClass = 'nsmd-nowrap';

/**
 * locator matches the abbreviations of the places in a source that a number follows, in German and in English: page,
 * pages, chapter, section, paragraph, figure, table, number, volume, article, appendix and §.
 */
const locator = String.raw`(?:(?:S|Kap|Abschn|Abs|Abb|Tab|Nr|Bd|Art|Anh|p|pp|ch|chap|sec|sect|para|fig|no|vol|art)\.|§§?)`;

/** number matches a number of a place in a source, such as 18, 4.1, 1,5 or 12a. */
const number = String.raw`\d+(?:[.,]\d+)*[a-z]?`;

/** dash matches the dash of a range, an en dash or an em dash, with the spaces around it. */
const dash = String.raw`[ \u00a0]*[\u2013\u2014][ \u00a0]*`;

/** reference matches a reference to a place in a source, or a number or a range of numbers, not inside a word. */
const reference = new RegExp(String.raw`(?<![\p{L}\p{N}])(${locator}[ \u00a0]+)?${number}(?:${dash}${number})?(?![\p{L}\p{N}])`, 'giu');

/** skipTag matches the elements whose text stays as it is: code, scripts, formulas, drawings and the like. */
const skipTag = /^(?:code|pre|kbd|samp|script|style|math|svg|template|textarea|title)$/i;

/** skipClass matches the classes of the elements whose text stays as it is: the tokens of plugins, diagrams and formulas, and the elements of this function. */
const skipClass = new RegExp(String.raw`\bclass="[^"]*\b(?:mermaid|katex|katex-display|math|plantuml|nsmd-render|${nowrapClass})\b`);

/** voidTag matches the elements that have no end tag. */
const voidTag = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;

/**
 * keepReferences puts each reference to a place in a source, such as "S. 18 – 19", and each range of numbers with a
 * dash, such as "2015 – 2023", of the text of an HTML fragment into an element whose text does not wrap, so that no
 * line breaks inside it. The text of code, scripts, formulas and drawings stays as it is.
 * @param html - The HTML fragment.
 */
export function keepReferences(html: string): string {
  const stack: boolean[] = [];
  let skip = 0;
  return html
    .split(/(<!--[\s\S]*?-->|<[^>]+>)/)
    .map((piece) => {
      if (piece.startsWith('<!--')) {
        return piece;
      }
      const tag = /^<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>$/.exec(piece);
      if (tag) {
        const [, closing, name, attributes, selfClosing] = tag;
        if (selfClosing || voidTag.test(name)) {
          return piece;
        }
        if (closing) {
          skip -= stack.pop() ? 1 : 0;
        } else {
          const skips = skipTag.test(name) || skipClass.test(attributes);
          stack.push(skips);
          skip += skips ? 1 : 0;
        }
        return piece;
      }
      if (skip > 0 || piece.startsWith('<')) {
        return piece;
      }
      return piece.replace(reference, (match: string, place: string | undefined) =>
        place || /[\u2013\u2014]/.test(match) ? `<span class="${nowrapClass}">${match}</span>` : match,
      );
    })
    .join('');
}
