// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The markdown-it of nimblescape Markdown (docs/rendering.md, R-REN-001): markdown-it 14, the version of the Markdown
// preview of VS Code, with CommonMark and the parts of GFM (tables, strikethrough, links of bare addresses, task lists),
// raw HTML, and footnotes. The inline footnotes `^[text]` of markdown-it-footnote are no part of GFM and stay text. The
// renderer writes the definitions of the footnotes at the end of the text, as GitHub does; the editor keeps each where
// the file has it, because it shows each block in its place, so the core rule `footnote_tail` is off for it. The editor
// reads the text with the same markdown-it as its renderer (docs/specification.md, R-GEN-010).
//
// A plugin adds no syntax a second time (R-REN-002): a rule that it adds with the name of a rule that the markdown-it
// has already does not stay, so the rule of nimblescape Markdown, or of a plugin before it, works alone. For example,
// the VS Code extension "Markdown Footnotes" adds markdown-it-footnote again; its second rule `footnote_tail` would write
// the list of the footnotes a second time, and its rule `footnote_inline` would read the inline footnotes.

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
    md = extendOnce(md, extend);
  }
  return md;
}

/** Ruler is the part of a ruler of markdown-it that extendOnce reads and changes: its rules and the cache of its chains. */
interface Ruler {
  __rules__: { name: string }[];
  __cache__: unknown;
}

/**
 * rulersOf returns the rulers of a markdown-it: the core rules, the block rules and the two kinds of inline rules.
 * @param md - The markdown-it.
 */
const rulersOf = (md: MarkdownIt): Ruler[] => [md.core.ruler, md.block.ruler, md.inline.ruler, md.inline.ruler2] as unknown as Ruler[];

/**
 * extendOnce applies the function of a plugin to a markdown-it and removes each rule that the function adds with the
 * name of a rule that the ruler has already. A rule that the function changes in its place, for example with
 * `ruler.at`, stays, and so does a rule with a new name.
 * @param md - The markdown-it.
 * @param extend - The function of the plugin.
 * @returns The markdown-it that the function returns, or the same.
 */
function extendOnce(md: MarkdownIt, extend: MarkdownItExtension): MarkdownIt {
  const before = rulersOf(md).map((ruler) => ({ rules: new Set(ruler.__rules__), names: new Set(ruler.__rules__.map((rule) => rule.name)) }));
  const extended = extend(md) ?? md;
  if (extended !== md) {
    return extended;
  }
  rulersOf(md).forEach((ruler, index) => {
    const { rules, names } = before[index];
    const kept = ruler.__rules__.filter((rule) => rules.has(rule) || !names.has(rule.name));
    if (kept.length < ruler.__rules__.length) {
      ruler.__rules__ = kept;
      // markdown-it builds the chains of the rules again.
      ruler.__cache__ = null;
    }
  });
  return md;
}
