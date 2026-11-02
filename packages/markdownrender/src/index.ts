// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The npm package @nimblescape/markdownrender (docs/specification.md, R-ARCH-002; docs/rendering.md, R-REN-001 to
// R-REN-003): the renderer of nimblescape Markdown, which turns the text of a file into HTML without edit functions,
// with the plugins of the renderer. It runs without the editor and without a page; content.css gives the rendering the
// look of the editor.

export { createMarkdownIt, type FootnotePlace, type MarkdownItExtension, type MarkdownItOptions } from './markdownIt';
export { alertTitles, cellColorPattern, headingText, slug, widthsPattern, type AlertKind, type OutputOptions } from './output';
export {
  addStyles,
  checkPlugins,
  fenceRender,
  pluginApiVersion,
  renderOf,
  renderParts,
  type RenderFunction,
  type RenderParts,
  type RenderPlugin,
} from './plugins';
export { isSafeTag, plainElements, safeHtml, type RawHtml } from './rawHtml';
export { MarkdownRenderer, type Rendering, type RendererOptions, type RenderSlot } from './renderer';
