// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The values of the front matter in the text (docs/editor.md, R-FM-007): the text can hold the value of a key of the
// front matter between two hidden markers, for example `<wbr><!--{title}-->A paper<!--{/title}-->`. The key of a value
// under another key is the path of the keys with `.`, for example `author.name`. The start marker has `<wbr>` before it:
// a line that starts with a comment of HTML is a block of HTML, which shows without the Markdown of its paragraph. The
// editor, the formatters and the commands that insert such values take the values of a front matter from here, so that
// they all write the same text.

import type { FrontMatterFormat } from './detect';
import { readFrontMatter, tomlText } from './edit';

/** valueKeyPattern is the source of the pattern of the key of a value: letters, digits, `_` and `-`, with `.` between the keys of a path. */
export const valueKeyPattern = String.raw`[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*`;

/** valueKeyTest matches a whole key of a value. */
const valueKeyTest = new RegExp(`^${valueKeyPattern}$`);

/**
 * valueMarkers returns the start marker, with `<wbr>`, and the end marker of the value of a key in the text.
 * @param key - The key, for example `author.name`.
 */
export const valueMarkers = (key: string): [string, string] => [`<wbr><!--{${key}}-->`, `<!--{/${key}}-->`];

/** isScalar returns true for a value that the text shows as it is: a text, a number, a yes or no, or a date of TOML. */
const isScalar = (value: unknown): value is string | number | boolean | Date =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date;

/**
 * scalarText returns the text of a scalar in one line: the lines of a text joined by spaces, and a date of TOML as TOML
 * writes it, for example `2026-11-02`.
 * @param value - The scalar.
 */
function scalarText(value: string | number | boolean | Date): string {
  if (value instanceof Date) {
    return tomlText(value);
  }
  return typeof value === 'string' ? value.replace(/[ \t]*\r?\n[ \t]*/g, ' ').trim() : String(value);
}

/**
 * collect adds the values of a map or a list of the front matter to the values, by their paths.
 * @param data - The map or the list.
 * @param prefix - The path of the map or the list, with a `.` at its end, or empty at the top.
 * @param values - The values.
 */
function collect(data: unknown, prefix: string, values: Map<string, string>): void {
  const entries: [string, unknown][] = Array.isArray(data) ? data.map((item, index) => [String(index), item]) : Object.entries(data as Record<string, unknown>);
  for (const [name, value] of entries) {
    const key = `${prefix}${name}`;
    if (!valueKeyTest.test(key)) {
      continue;
    }
    if (isScalar(value)) {
      values.set(key, scalarText(value));
    } else if (Array.isArray(value) && value.length > 0 && value.every(isScalar)) {
      // A list of scalars is its items, joined by commas; the maps in another list have the index of their item in
      // their paths, for example `authors.0.name`.
      values.set(key, value.map(scalarText).join(', '));
    } else if (value !== null && typeof value === 'object') {
      collect(value, `${key}.`, values);
    }
  }
}

/**
 * frontMatterValues returns the values of the keys of a front matter as the text shows them, by their paths, for
 * example `author.name` for the key `name` under the key `author` (R-FM-007). A text is in one line; a list of texts,
 * numbers or yes and no is its items, joined by commas; a key without a value, for example `null` in YAML, has none. A
 * front matter that does not parse has no values.
 * @param text - The text of the front matter with its fences.
 * @param format - The format of the front matter.
 */
export function frontMatterValues(text: string, format: FrontMatterFormat): Map<string, string> {
  const values = new Map<string, string>();
  let data: unknown;
  try {
    data = readFrontMatter(text, format);
  } catch {
    return values;
  }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    collect(data, '', values);
  }
  return values;
}
