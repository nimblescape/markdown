// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The npm package @nimblescape/markdowneditor (docs/specification.md, R-ARCH-002; docs/editor.md): the editor of
// rendered Markdown for the web and for the webviews of VS Code, with its plugin API (docs/plugins.md). The front
// matter, its edits and its schema are in the package @nimblescape/markdowntext, and the renderer, its markdown-it and
// the plugins of the renderer in the package @nimblescape/markdownrender; the types of these packages that the options
// of the editor use come from there.

export { coreExtensions, type Alignment } from './extensions/core';
export { MarkdownCodec, type CodecOptions } from './markdown/codec';
export { createMarkdownIt, type MarkdownItExtension } from '@nimblescape/markdownrender';
export type { BlockSource, MarkdownSource, ParsedMarkdown } from './markdown/parse';
export type { Writers } from './markdown/serialize';
export { MarkdownEditor, type MarkdownEditorOptions } from './editor';
export type { SerializeOptions } from './markdown/serialize';
export type { InteractionOptions } from './ui/interaction';
export type { FormatButton } from './ui/formatBar';
export type { MenuItem } from './ui/menu';
export type { LearnMarks, MarkText, NodeText } from './ui/learnMode';
export type { FrontMatterInput, FrontMatterInputContext, FrontMatterMode } from './ui/frontMatterForm';
export {
  pluginApiVersion,
  type BlockAt,
  type Disposable,
  type GeneratedPart,
  type MarkdownPlugin,
  type PluginChannel,
  type PluginCommand,
  type PluginEditor,
  type PluginHost,
  type PluginMenus,
  type PluginThreads,
  type RenderFunction,
  type ThreadMarker,
} from './plugins/api';
export { generatedWrite } from './plugins/generated';
