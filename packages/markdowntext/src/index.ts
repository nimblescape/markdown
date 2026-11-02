// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The npm package @nimblescape/markdowntext, the source of nimblescape Markdown (docs/specification.md, R-ARCH-002;
// docs/source.md): the text of a file without a view. The TextSource holds the text, the selections of the editors and
// the changes, each a list of text patches with its origin (R-SRC-001, R-SRC-002). The front matter: its format at the
// start of a text (R-SRC-003), its data, the edits that change only the text of the edited value, and the check against
// a JSON schema (docs/editor.md, R-FM-004, R-FM-005). The package needs no page, so the editors, the renderer, the
// layout and the command line use the same code.

export { frontMatterOf, type FrontMatter, type FrontMatterFormat } from './frontMatter/detect';
export { editFrontMatter, readFrontMatter, tomlText, tomlValue } from './frontMatter/edit';
export { FrontMatterError, type FrontMatterEdit, type FrontMatterPath } from './frontMatter/types';
export { checkFrontMatter, schemaAt, typeOf, type FrontMatterProblem, type JsonSchema, type JsonSchemaObject, type JsonType } from './frontMatter/schema';
export { applyPatches, mapPosition, patchesBetween, type TextPatch } from './source/patch';
export { TextSource, type Origin, type OriginKind, type TextChange, type TextFile, type TextSelection } from './source/textSource';
