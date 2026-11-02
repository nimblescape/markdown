// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The footnotes of the pages (docs/rendering.md, R-LAYOUT-001): each footnote becomes an element
// `<span class="footnote">` at the place of its first reference, which Paged.js puts at the foot of the page of that
// reference (`float: footnote`). A later reference shows the number of the footnote as a link to it. A link to the
// outside whose text is not its address gets a footnote with the address, so that a printed page shows it; a second
// link to the same address gets the number of that footnote, and a link inside a footnote gets the address after its
// text. A bare address and an autolink `<https://…>` show their address and get no footnote.

import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { escapeHtml } from './template';
import { footnoteType, layoutHtml } from './tokens';

/** scheme matches the start of an address with a scheme, such as `https:` or `mailto:`: a link to the outside. */
const scheme = /^[a-z][a-z0-9+.-]*:/i;

/**
 * outsideLink returns the address of a link to the outside whose text is not its address, and the place of the end of
 * the link, or undefined for another token.
 * @param state - The state of the core rule.
 * @param tokens - The inline tokens.
 * @param index - The place of the token in the tokens.
 */
function outsideLink(state: StateCore, tokens: readonly Token[], index: number): { href: string; address: string; close: number } | undefined {
  const open = tokens[index];
  const href = open.type === 'link_open' ? (open.attrGet('href') ?? '') : '';
  if (!scheme.test(href) || open.markup === 'linkify' || open.markup === 'autolink') {
    return undefined;
  }
  const close = tokens.findIndex((token, at) => at > index && token.type === 'link_close');
  const text = tokens
    .slice(index + 1, close < 0 ? undefined : close)
    .map((token) => token.content)
    .join('');
  const address = state.md.normalizeLinkText(href).replace(/^mailto:/i, '');
  const bare = (value: string): string =>
    value
      .trim()
      .replace(/^[a-z][a-z0-9+.-]*:(?:\/\/)?/i, '')
      .replace(/\/$/, '')
      .toLowerCase();
  return bare(text) === bare(address) ? undefined : { href, address, close: close < 0 ? tokens.length - 1 : close };
}

/** FootnoteMeta is the meta of a token of a footnote: its number and the tokens of its text. */
export interface FootnoteMeta {
  number: number;
  tokens: Token[];
  /** link is true for the footnote of the address of a link. */
  link?: boolean;
}

/**
 * footnoteHtml returns the HTML of a footnote from the HTML of its text: each paragraph becomes an element
 * `<span class="footnote-paragraph">`, and the first one gets the ID that a later reference links to, because
 * Paged.js gives the footnote itself an ID of its own.
 * @param number - The number of the footnote.
 * @param text - The HTML of the text of the footnote.
 * @param link - True for the footnote of the address of a link.
 */
export function footnoteHtml(number: number, text: string, link = false): string {
  const paragraphs = text.trim().replace(/<p\b[^>]*>/g, '<span class="footnote-paragraph">').replace(/<\/p>/g, '</span>');
  const target = paragraphs.startsWith('<span class="footnote-paragraph">')
    ? paragraphs.replace('<span class="footnote-paragraph">', `<span class="footnote-paragraph" id="paper-footnote-${number}">`)
    : `<span id="paper-footnote-${number}"></span>${paragraphs}`;
  return `<span class="footnote${link ? ' link-footnote' : ''}">${target}</span>`;
}

/**
 * placeFootnotes moves the text of each footnote to its first reference, as a token of a footnote, and removes the
 * block of the footnotes at the end of the tokens.
 * @param state - The state of the core rule.
 * @returns The number of the footnotes.
 */
export function placeFootnotes(state: StateCore): number {
  const tokens = state.tokens;
  const start = tokens.findIndex((token) => token.type === 'footnote_block_open');
  const texts = new Map<number, Token[]>();
  if (start >= 0) {
    const end = tokens.findIndex((token, index) => index > start && token.type === 'footnote_block_close');
    for (let index = start; index < end; index++) {
      if (tokens[index].type !== 'footnote_open') {
        continue;
      }
      const close = tokens.findIndex((token, at) => at > index && token.type === 'footnote_close');
      const body = tokens.slice(index + 1, close).filter((token) => token.type !== 'footnote_anchor');
      for (const token of body) {
        if (token.children) {
          const children = token.children.filter((child) => child.type !== 'footnote_anchor');
          const output: Token[] = [];
          let link: ReturnType<typeof outsideLink>;
          for (let at = 0; at < children.length; at++) {
            output.push(children[at]);
            link = link ?? outsideLink(state, children, at);
            if (link && at === link.close) {
              output.push(layoutHtml(state, ` (<span class="link-address">${escapeHtml(link.address)}</span>)`));
              link = undefined;
            }
          }
          token.children = output;
        }
      }
      texts.set(tokens[index].meta.id, body);
      index = close;
    }
    tokens.splice(start, end - start + 1);
  }
  const again = (number: number): Token => layoutHtml(state, `<sup class="footnote-again"><a href="#paper-footnote-${number}">${number}</a></sup>`);
  const footnote = (meta: FootnoteMeta): Token => {
    const token = new state.Token(footnoteType, 'span', 0);
    token.meta = meta;
    return token;
  };
  const numbers = new Map<number, number>();
  const addresses = new Map<string, number>();
  let count = 0;
  for (const token of tokens) {
    if (token.type !== 'inline' || !token.children) {
      continue;
    }
    const children = token.children;
    const output: Token[] = [];
    let link: ReturnType<typeof outsideLink>;
    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      if (child.type === 'footnote_ref') {
        const id: number = child.meta.id;
        const number = numbers.get(id);
        if (number === undefined) {
          numbers.set(id, ++count);
          output.push(footnote({ number: count, tokens: texts.get(id) ?? [] }));
        } else {
          output.push(again(number));
        }
        continue;
      }
      output.push(child);
      link = link ?? outsideLink(state, children, index);
      if (link && index === link.close) {
        const number = addresses.get(link.address);
        if (number === undefined) {
          addresses.set(link.address, ++count);
          const address = layoutHtml(state, `<p><a class="link-address" href="${escapeHtml(link.href)}">${escapeHtml(link.address)}</a></p>`, true);
          output.push(footnote({ number: count, tokens: [address], link: true }));
        } else {
          output.push(again(number));
        }
        link = undefined;
      }
    }
    token.children = output;
  }
  return count;
}
