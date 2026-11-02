// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tokens that the layout adds to the tokens of markdown-it (docs/rendering.md, R-LAYOUT-001), and the helpers that
// read the inline tokens. The HTML that the layout writes, for example the number of a heading or the element of a
// part, is a token of its own type, which the rendering writes as it is: the raw HTML of the file shows safely in the
// renderer (R-REN-001), and the HTML of the layout is no raw HTML of the file. A plugin that runs before the layout,
// for example the plugin of the listings of Markdown Notes, writes its HTML with the same type.

import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type Token from 'markdown-it/lib/token.mjs';

/** layoutHtmlType is the type of a token of HTML that the layout or a plugin writes, not the file. */
export const layoutHtmlType = 'nsmd_layout_html';

/** footnoteType is the type of the token of a footnote at the place of its first reference, with its text as tokens. */
export const footnoteType = 'nsmd_layout_footnote';

/** listType is the type of the token of a generated list, whose rendering writes the list from what the layout found. */
export const listType = 'nsmd_layout_list';

/**
 * layoutHtml returns a new token of HTML of the layout.
 * @param state - The state of the core rule.
 * @param content - The HTML.
 * @param block - True for a block, false for a part of a line.
 */
export function layoutHtml(state: StateCore, content: string, block = false): Token {
  const token = new state.Token(layoutHtmlType, '', 0);
  token.content = content;
  token.block = block;
  return token;
}

/**
 * plainText returns the text of inline tokens without their markup.
 * @param tokens - The inline tokens.
 */
export function plainText(tokens: readonly Token[]): string {
  return tokens
    .map((token) => {
      if (token.type === 'text' || token.type === 'code_inline') {
        return token.content;
      }
      if (token.type === 'softbreak' || token.type === 'hardbreak') {
        return ' ';
      }
      if (token.type === 'image') {
        return plainText(token.children ?? []);
      }
      return '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** anchorTag matches the anchor of a figure or a table, `<a id="tab-grades"></a>`, as one token or as its start tag. */
const anchorTag = /^<a\s+(?:id|name)\s*=\s*"([^"<>]+)"\s*>\s*(<\/a\s*>)?$/i;

/**
 * trailingAnchor returns the ID of the anchor at the end of an inline text, as the slash commands `/figure` and
 * `/table` of nimblescape Markdown Notes write it after an image or a caption, and the index of its first token.
 * @param tokens - The inline tokens.
 */
export function trailingAnchor(tokens: readonly Token[]): { id: string; start: number } | undefined {
  let end = tokens.length;
  while (end > 0 && (tokens[end - 1].type === 'softbreak' || (tokens[end - 1].type === 'text' && tokens[end - 1].content.trim() === ''))) {
    end--;
  }
  const last = tokens[end - 1];
  if (last?.type !== 'html_inline') {
    return undefined;
  }
  const whole = anchorTag.exec(last.content);
  if (whole?.[2]) {
    return { id: whole[1], start: end - 1 };
  }
  const open = end > 1 && tokens[end - 2].type === 'html_inline' && /^<\/a\s*>$/i.test(last.content) ? anchorTag.exec(tokens[end - 2].content) : null;
  return open && !open[2] ? { id: open[1], start: end - 2 } : undefined;
}

/**
 * withoutTrailingSpace returns the inline tokens without the spaces and line breaks at their end.
 * @param tokens - The inline tokens.
 */
export function withoutTrailingSpace(tokens: Token[]): Token[] {
  const result = [...tokens];
  while (result.length > 0) {
    const last = result[result.length - 1];
    if (last.type === 'softbreak' || (last.type === 'text' && last.content.trim() === '')) {
      result.pop();
    } else {
      if (last.type === 'text') {
        last.content = last.content.trimEnd();
      }
      break;
    }
  }
  return result;
}

/**
 * decodedTarget returns the target of a link without the escapes that markdown-it writes for the letters outside
 * ASCII, such as `erkl%C3%A4rung` for `erklärung`; a target with a wrong escape stays as it is.
 * @param href - The target, without "#".
 */
export function decodedTarget(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

/** InternalLink is a link to a place in the file (`#id`), with the tokens of its text. */
export interface InternalLink {
  open: Token;
  text: Token[];
  line: number;
}

/**
 * internalLinks returns the links of inline tokens whose target is a place in the file, with the tokens of their text.
 * @param tokens - The inline tokens.
 * @param line - The line of the tokens in the file.
 */
export function internalLinks(tokens: readonly Token[], line: number): InternalLink[] {
  const result: InternalLink[] = [];
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type !== 'link_open' || !tokens[index].attrGet('href')?.startsWith('#')) {
      continue;
    }
    const text: Token[] = [];
    let end = index + 1;
    while (end < tokens.length && tokens[end].type !== 'link_close') {
      text.push(tokens[end]);
      end++;
    }
    result.push({ open: tokens[index], text, line });
    index = end;
  }
  return result;
}
