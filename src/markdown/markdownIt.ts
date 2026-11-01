// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The markdown-it of the editor (docs/specification.md, R-GEN-006, R-GEN-011): CommonMark with the parts of GFM
// (tables, strikethrough, links of bare addresses, task lists), raw HTML, and footnotes. The definitions of the
// footnotes stay where the file has them, because the editor shows each block in its place: the core rule
// `footnote_tail`, which moves them to the end for the HTML of a preview, is off. The inline footnotes `^[text]` of
// markdown-it-footnote are no part of GFM and stay text.

import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';

/** MarkdownItExtension is a function that adds syntax to a markdown-it, as `extendMarkdownIt` of the VS Code preview. */
export type MarkdownItExtension = (md: MarkdownIt) => MarkdownIt | void;

/**
 * createMarkdownIt returns a markdown-it with the syntax of the editor and of its extensions.
 * @param extensions - Functions that add the syntax of the extensions of the editor (R-GEN-012).
 */
export function createMarkdownIt(extensions: readonly MarkdownItExtension[] = []): MarkdownIt {
  let md = new MarkdownIt({ html: true, linkify: true }).use(footnote).use(taskLists);
  md.disable(['footnote_tail', 'footnote_inline']);
  for (const extend of extensions) {
    md = extend(md) ?? md;
  }
  return md;
}
