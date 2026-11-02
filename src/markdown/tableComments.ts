// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The comments of the tables (docs/editor.md, R-EDIT-010) for what GFM cannot store: the color of a cell is a comment
// at the start of the cell, `<!--cell red-->`; the widths of the columns are a comment on the line before the table,
// `<!-- table: widths=30,70 -->`.

/** cellColorPattern matches the comment of the color of a cell; the group is the name of the color. */
export const cellColorPattern = /^<!--\s*cell\s+([a-z]+)\s*-->$/;

/** widthsPattern matches the comment of the widths of the columns; the group is the list of the widths in percent. */
export const widthsPattern = /^<!--\s*table:\s*widths=(\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)*)\s*-->$/;
