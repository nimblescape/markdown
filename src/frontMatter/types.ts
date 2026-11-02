// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The types of the edits of a front matter (docs/editor.md, R-FM-005): the path of a value and the four edits that
// the form of the front matter makes.

/** FrontMatterPath is the path of a value in a front matter: the keys of maps and the indexes of lists. */
export type FrontMatterPath = readonly (string | number)[];

/**
 * FrontMatterEdit is an edit of a front matter. Each edit changes only the text of its value (R-FM-005):
 * - `set` gives the value at the path a new value, or adds the key at the end of the path, after the key `after` or
 *   after the last key of its map;
 * - `insert` inserts a value into a list, before the item at the index at the end of the path;
 * - `remove` removes the key or the item at the path;
 * - `rename` gives the key at the end of the path a new name.
 */
export type FrontMatterEdit =
  | { kind: 'set'; path: FrontMatterPath; value: unknown; after?: string }
  | { kind: 'insert'; path: FrontMatterPath; value: unknown }
  | { kind: 'remove'; path: FrontMatterPath }
  | { kind: 'rename'; path: FrontMatterPath; key: string };

/** FrontMatterError is the error of a front matter that does not parse, or of an edit that does not fit it. */
export class FrontMatterError extends Error {
  override name = 'FrontMatterError';
}
