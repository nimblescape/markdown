// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The raw HTML of the file in the rendering (docs/rendering.md, R-REN-001). The renderer has no sanitizer, so it writes
// raw HTML in one of three ways:
//
// - `safe`, the default: comments do not show; the elements of a fixed list without attributes, the anchors
//   `<a id="…">` and `<a name="…">`, and the check boxes of task lists show as HTML; any other raw HTML shows as its
//   text. An end tag shows as HTML only when it closes the last element that the raw HTML opened, and the rendering
//   closes the elements that the raw HTML of a paragraph, or of the whole text, leaves open, so that the HTML of the
//   rendering stays whole inside the element of a layout. No raw HTML of the file can run a script or load a resource.
// - `text`: all raw HTML shows as its text, as in the editor, which shows each block of HTML of the file as its text.
// - `trusted`: raw HTML shows as the file writes it, only for a text that the integrating code trusts, for example the
//   file of the user in a page whose content security policy allows no scripts.

import type MarkdownIt from 'markdown-it';
import type Renderer from 'markdown-it/lib/renderer.mjs';

/** RawHtml is how the renderer writes the raw HTML of the file. */
export type RawHtml = 'safe' | 'text' | 'trusted';

/** plainElements are the elements that show as HTML in the way `safe` when their tags have no attributes. */
export const plainElements = [
  'a', 'abbr', 'b', 'br', 'cite', 'code', 'del', 'details', 'dfn', 'div', 'em', 'hr', 'i', 'ins', 'kbd', 'mark', 'p', 'q',
  's', 'samp', 'small', 'span', 'strong', 'sub', 'summary', 'sup', 'u', 'var', 'wbr',
] as const;

/** plainTag matches a start tag or an end tag of a plain element without attributes. */
const plainTag = new RegExp(`^<\\/?(?:${plainElements.join('|')})\\s*\\/?>$`, 'i');

/** anchorTag matches the start tag of an anchor with only an ID or a name, `<a id="fig-plan">`. */
const anchorTag = /^<a\s+(?:id|name)\s*=\s*"[\w.:-]+"\s*>$/i;

/** taskCheckbox matches the check box that markdown-it-task-lists puts at the start of an item of a task list. */
const taskCheckbox = /^<input class="task-list-item-checkbox"(?: checked="")? disabled="" type="checkbox">$/;

/** comment matches an HTML comment. */
const comment = /^<!--[\s\S]*?-->$/;

/** pieces matches the pieces of raw HTML: comments, tags, text, and a `<` that starts nothing. */
const pieces = /<!--[\s\S]*?-->|<\/?[A-Za-z][^<>]*>|[^<]+|</g;

/** tagName matches the start of a tag; the groups are the slash of an end tag and the name of the element. */
const tagName = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)/;

/** voidElements are the safe elements without an end tag. */
const voidElements = new Set(['br', 'hr', 'input', 'wbr']);

/**
 * isSafeTag returns true for a tag that shows as HTML in the way `safe`.
 * @param tag - The tag.
 */
export const isSafeTag = (tag: string): boolean => plainTag.test(tag) || anchorTag.test(tag) || taskCheckbox.test(tag);

/**
 * safeHtml returns raw HTML without its comments when it holds only comments, text and safe tags, and each end tag
 * closes the last element that is open, else undefined.
 * @param html - The raw HTML.
 * @param open - The names of the elements that the raw HTML before opened, the last one last; the function adds the
 *   elements that the HTML opens and removes those that it closes, when it returns the HTML.
 */
export function safeHtml(html: string, open: string[] = []): string | undefined {
  const stack = [...open];
  let safe = '';
  for (const [piece] of html.matchAll(pieces)) {
    if (piece.startsWith('<!--')) {
      continue;
    }
    if (piece.startsWith('<')) {
      const tag = tagName.exec(piece);
      if (!tag || !isSafeTag(piece)) {
        return undefined;
      }
      const name = tag[2].toLowerCase();
      if (tag[1]) {
        if (stack[stack.length - 1] !== name) {
          return undefined;
        }
        stack.pop();
      } else if (!voidElements.has(name)) {
        // HTML ignores the slash of `<span/>`: the tag opens the element.
        stack.push(name);
      }
    }
    safe += piece;
  }
  open.splice(0, open.length, ...stack);
  return safe;
}

/** openElements holds the elements that the raw HTML of a rendering opened, by the environment of the rendering. */
const openElements = new WeakMap<object, string[]>();

/** openOf returns the elements that the raw HTML of a rendering opened, the last one last. */
function openOf(env: object): string[] {
  let open = openElements.get(env);
  if (!open) {
    open = [];
    openElements.set(env, open);
  }
  return open;
}

/**
 * closeOpen returns the end tags of the elements that the raw HTML of a rendering opened after a count of open
 * elements, and forgets them.
 * @param env - The environment of the rendering.
 * @param count - The number of open elements that stay open.
 */
export function closeOpen(env: object, count = 0): string {
  return openOf(env)
    .splice(count)
    .reverse()
    .map((name) => `</${name}>`)
    .join('');
}

/**
 * openCount returns the number of elements that the raw HTML of a rendering opened and did not close.
 * @param env - The environment of the rendering.
 */
export const openCount = (env: object): number => openOf(env).length;

/** withoutTrailingNewline returns a text without the line feed at its end. */
const withoutTrailingNewline = (text: string): string => (text.endsWith('\n') ? text.slice(0, -1) : text);

/**
 * rawHtmlRules sets the rules of a renderer of markdown-it for the blocks and the inline pieces of raw HTML.
 * @param rules - The rules of the renderer.
 * @param md - The markdown-it, for its escape.
 * @param mode - How to write the raw HTML.
 */
export function rawHtmlRules(rules: Renderer['rules'], md: MarkdownIt, mode: RawHtml): void {
  if (mode === 'trusted') {
    return;
  }
  const escape = md.utils.escapeHtml;
  const blockText = (html: string) => `<pre class="nsmd-raw nsmd-raw-html">${escape(withoutTrailingNewline(html))}</pre>${mode === 'safe' ? '\n' : ''}`;
  const inlineText = (html: string) => `<span class="nsmd-raw nsmd-raw-html">${escape(html)}</span>`;
  rules.html_block = (tokens, index, _options, env: object) => {
    const html = tokens[index].content;
    if (mode === 'text') {
      return blockText(html);
    }
    const safe = safeHtml(html, openOf(env));
    return safe === undefined ? blockText(html) : safe.trim() === '' ? '' : safe;
  };
  rules.html_inline = (tokens, index, _options, env: object) => {
    const html = tokens[index].content;
    if (taskCheckbox.test(html)) {
      return html;
    }
    if (mode === 'text') {
      return inlineText(html);
    }
    return comment.test(html) ? '' : (safeHtml(html, openOf(env)) ?? inlineText(html));
  };
}
