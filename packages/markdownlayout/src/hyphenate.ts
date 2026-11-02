// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The hyphenation of the text of the pages (docs/rendering.md, R-LAYOUT-001). Justified lines need hyphenation, else
// long words leave wide gaps. The CSS `hyphens: auto` depends on a dictionary of the browser, which Chromium on Linux
// does not have for German, so the layout inserts soft hyphens (U+00AD) itself with the patterns of TeX of the npm
// package `hyphen`, and the browser breaks a line only there: the same text gives the same lines in the view of the
// pages and in the PDF, on every computer.

import * as de from 'hyphen/de-1996';
import * as enGb from 'hyphen/en-gb';
import * as enUs from 'hyphen/en-us';
import * as es from 'hyphen/es';
import * as fr from 'hyphen/fr';
import * as it from 'hyphen/it';

/** softHyphen is the character of a soft hyphen. */
export const softHyphen = '\u00ad';

type Hyphenate = (word: string, options?: { hyphenChar?: string; minWordLength?: number }) => string;

/** patterns maps a language tag, or its first part, to the hyphenation of its words. */
const patterns: Record<string, Hyphenate> = {
  de: de.hyphenateSync,
  en: enUs.hyphenateSync,
  'en-us': enUs.hyphenateSync,
  'en-gb': enGb.hyphenateSync,
  es: es.hyphenateSync,
  fr: fr.hyphenateSync,
  it: it.hyphenateSync,
};

/** address matches a token that is an address, an e-mail address or a path. */
const address = /:\/\/|www\.|@|^[.~]{0,2}\/|\/[^/]*\.\w{1,5}\b/;

/**
 * hyphenatorOf returns the hyphenation of the words of a language, or undefined for a language without patterns.
 * @param language - The language tag, for example de-AT.
 */
export function hyphenatorOf(language: string): ((text: string) => string) | undefined {
  const tag = language.toLowerCase();
  const hyphenate = patterns[tag] ?? patterns[tag.split('-')[0]];
  if (!hyphenate) {
    return undefined;
  }
  const word = (text: string): string => hyphenate(text, { hyphenChar: softHyphen, minWordLength: 5 });
  return (text) =>
    text
      .split(/(\s+)/)
      .map((token) =>
        // Addresses, e-mail addresses and paths stay as they are. A path starts with a slash or has a file name with an
        // extension; words joined by a slash, such as "Forschungsfrage/n" or "und/oder", are words of the text.
        address.test(token)
          ? token
          : token
              .replace(/&#?\w+;|\p{L}+/gu, (part) => (part.startsWith('&') ? part : word(part)))
              // No break inside the "innen" of a gender form such as "Schüler:innen".
              .replace(new RegExp(`:in${softHyphen}nen`, 'g'), ':innen'),
      )
      .join('');
}

/** noHyphenTag matches the elements whose text gets no soft hyphens: headings, links, code, and the like. */
const noHyphenTag = /^(?:h[1-6]|a|code|pre|kbd|samp|script|style|figcaption|math|svg|template|textarea)$/i;

/** noHyphenClass matches the classes of elements whose text gets no soft hyphens: captions, the tokens that plugins show, and the diagrams and formulas of plugins. */
const noHyphenClass = /\bclass="[^"]*\b(?:no-hyphens|caption|mermaid|katex|katex-display|math|plantuml|nsmd-render)\b/;

/**
 * textTag matches the elements of running text, whose text gets soft hyphens. The text of other elements, such as the
 * `div` of a plugin of the Markdown preview, stays as it is, because a plugin may read it later, for example Mermaid.
 */
const textTag = /^(?:p|li|td|th|dd|dt|blockquote)$/i;

/** voidTag matches the elements that have no end tag. */
const voidTag = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;

/**
 * hyphenateHtml inserts soft hyphens into the text of the elements of running text (`textTag`) of an HTML fragment,
 * not in the elements of `noHyphenTag` and not in an element with a class of `noHyphenClass`, such as `no-hyphens`.
 * @param html - The HTML fragment.
 * @param hyphenate - The hyphenation of a text.
 */
export function hyphenateHtml(html: string, hyphenate: (text: string) => string): string {
  const stack: { skips: boolean; text: boolean }[] = [];
  let skip = 0;
  let text = 0;
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
          const element = stack.pop();
          skip -= element?.skips ? 1 : 0;
          text -= element?.text ? 1 : 0;
        } else {
          const element = { skips: noHyphenTag.test(name) || noHyphenClass.test(attributes), text: textTag.test(name) };
          stack.push(element);
          skip += element.skips ? 1 : 0;
          text += element.text ? 1 : 0;
        }
        return piece;
      }
      return skip > 0 || text === 0 || piece.startsWith('<') ? piece : hyphenate(piece);
    })
    .join('');
}
