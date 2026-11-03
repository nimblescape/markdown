// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The entry point `@nimblescape/markdownlayout/pdf` (docs/rendering.md, R-LAYOUT-002): the PDF of the page of a
// document, printed by an installed browser without a window. The entry point runs in Node.js only, for example on the
// command line and in the extension host of VS Code on the desktop; the main entry point runs everywhere.

export { browserVariable, candidates, findBrowser, NoBrowserError } from './browser';
export { fileHost, fileReader, folderUrl, metadataOf, pagedJsFile, printPage, type FileHostOptions, type PrintOptions } from './export';
export { finishPdf, printPdf, type Metadata, type PrintResult } from './pdf';
