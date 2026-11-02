// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The npm package @nimblescape/markdown (docs/specification.md, R-GEN-001, R-GEN-011): an editor of rendered Markdown
// for the web and for the webviews of VS Code.

export { coreExtensions, type Alignment } from './extensions/core';
export { MarkdownCodec, type CodecOptions } from './markdown/codec';
export { createMarkdownIt, type MarkdownItExtension } from './markdown/markdownIt';
export { frontMatterOf, type FrontMatter, type FrontMatterFormat } from './markdown/frontMatter';
export type { BlockSource, MarkdownSource, ParsedMarkdown } from './markdown/parse';
export type { Writers } from './markdown/serialize';
export { MarkdownEditor, type MarkdownEditorOptions } from './editor';
export type { SerializeOptions } from './markdown/serialize';
export type { InteractionOptions } from './ui/interaction';
export type { FormatButton } from './ui/formatBar';
export type { MenuItem } from './ui/menu';
export type { LearnMarks, MarkText, NodeText } from './ui/learnMode';
export { editFrontMatter, readFrontMatter } from './frontMatter/edit';
export { FrontMatterError, type FrontMatterEdit, type FrontMatterPath } from './frontMatter/types';
export { checkFrontMatter, schemaAt, type FrontMatterProblem, type JsonSchema, type JsonSchemaObject, type JsonType } from './frontMatter/schema';
export type { FrontMatterInput, FrontMatterInputContext, FrontMatterMode } from './ui/frontMatterForm';
