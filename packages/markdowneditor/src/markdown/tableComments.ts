// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The comments of the tables (docs/editor.md, R-EDIT-010) for what GFM cannot store: the color of a cell is a comment
// at the start of the cell, `<!--cell red-->`; the widths of the columns are a comment on the line before the table,
// `<!-- table: widths=30,70 -->`.

// The patterns come from the renderer, which shows the comments in the same way (docs/specification.md, R-GEN-010).
export { cellColorPattern, widthsPattern } from '@nimblescape/markdownrender';
