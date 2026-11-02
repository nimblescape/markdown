// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The markdown-it of nimblescape Markdown (docs/rendering.md, R-REN-001): markdown-it 14, the version of the Markdown
// preview of VS Code, with CommonMark and the parts of GFM (tables, strikethrough, links of bare addresses, task lists),
// raw HTML, and footnotes. The inline footnotes `^[text]` of markdown-it-footnote are no part of GFM and stay text. The
// renderer writes the definitions of the footnotes at the end of the text, as GitHub does; the editor keeps each where
// the file has it, because it shows each block in its place, so the core rule `footnote_tail` is off for it. The editor
// reads the text with the same markdown-it as its renderer (docs/specification.md, R-GEN-010).

import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';

/** MarkdownItExtension is a function that adds syntax to a markdown-it, as `extendMarkdownIt` of the VS Code preview. */
export type MarkdownItExtension = (md: MarkdownIt) => MarkdownIt | void;

/** FootnotePlace is where the definitions of the footnotes show: at the end of the text, or where the file has them. */
export type FootnotePlace = 'end' | 'inPlace';

/** MarkdownItOptions are the options of the markdown-it of nimblescape Markdown. */
export interface MarkdownItOptions {
  /** footnotes is where the definitions of the footnotes show; the default is `end`. */
  readonly footnotes?: FootnotePlace;
}

/**
 * createMarkdownIt returns a markdown-it with the syntax of nimblescape Markdown and of the plugins.
 * @param extensions - The functions of the plugins that add syntax (R-REN-002).
 * @param options - The options.
 */
export function createMarkdownIt(extensions: readonly MarkdownItExtension[] = [], options: MarkdownItOptions = {}): MarkdownIt {
  let md = new MarkdownIt({ html: true, linkify: true }).use(footnote).use(taskLists);
  md.disable(options.footnotes === 'inPlace' ? ['footnote_tail', 'footnote_inline'] : ['footnote_inline']);
  for (const extend of extensions) {
    md = extend(md) ?? md;
  }
  return md;
}
