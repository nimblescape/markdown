// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The npm package @nimblescape/markdownlayout (docs/specification.md, R-ARCH-002; docs/rendering.md, R-LAYOUT-001 to
// R-LAYOUT-004): the layout part of nimblescape Markdown. It turns the text of a file into the page of the file in its
// layout: the style sheets of the layout, the templates of its fixed pages filled with the fields of the front matter,
// the text with the numbers of its headings, figures, tables and listings, its footnotes and its generated lists, and
// the script that starts Paged.js, which makes the pages. The view of the pages and the PDF use the same page. The
// modules use no API of a platform; the integrating code reads the files. The entry point ./pdf (src/pdf/index.ts)
// prints the page to a PDF in Node.js.

export { builtinFile, builtinFolder, builtinLayouts } from './builtin';
export {
  fieldsOfSchema,
  formatName,
  formatText,
  formatVersion,
  languageTag,
  layoutFile,
  layoutName,
  parseLayout,
  parseVersion,
  relativeFile,
  schemaOfFields,
  sectionCodes,
  termsFor,
  withLanguage,
  type FieldSpec,
  type Layout,
  type Problem,
  type SectionCode,
  type Terms,
} from './format';
export { fieldValues, type FieldValues } from './frontMatter';
export { hyphenateHtml, hyphenatorOf, softHyphen } from './hyphenate';
export { generatedLists, inContents, listHtml, type Entry, type GeneratedList } from './lists';
export {
  baseCss,
  compose,
  defaultLayout,
  documentLayout,
  findLayout,
  folderOf,
  loadLayout,
  renderPage,
  rewriteCss,
  rewriteHtml,
  screenCss,
  valuesOf,
  type Composed,
  type Host,
  type LayoutPlaces,
  type LoadedLayout,
  type Page,
  type PageOptions,
  type Reader,
  type Script,
} from './page';
export { registerRenders, slotsHtml, slotsId, tokenData, type TokenData } from './pageRenders';
export { showPages, type PagesView } from './pages';
export { escapeHtml, fileName, fill, pdfNameOf } from './template';
export {
  createLayoutRenderer,
  emptyFound,
  layoutEnvKey,
  layoutPlugin,
  listingCode,
  numberLines,
  referenceText,
  renderText,
  type Caption,
  type Heading,
  type LayoutEnv,
  type LayoutText,
  type Part,
  type TextFound,
} from './text';
export { footnoteType, layoutHtmlType, listType } from './tokens';
