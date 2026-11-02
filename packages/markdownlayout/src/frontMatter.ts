// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The fields of the front matter of a document (docs/rendering.md, R-LAYOUT-001): the front matter of the file in
// YAML, TOML or JSON (docs/source.md, R-SRC-003) names the layout (`layout`) and holds the values of the fields of the
// layout, for example the title and the author, which the templates of the layout show. A template shows a text, so
// each value is a text: a number or a boolean as text, and a list as its items joined by ", ". A map is no field.

import { frontMatterOf, readFrontMatter } from '@nimblescape/markdowntext';

/** FieldValues are the values of the fields of the front matter of a document. */
export interface FieldValues {
  /** values maps each field to its value as text. */
  values: Record<string, string>;
  /** data is the data of the front matter, undefined for a file without one. */
  data?: unknown;
  /** error is the message of the problem of a front matter that cannot be read. */
  error?: string;
}

/**
 * textOf returns a value of the front matter as text, or undefined for a map.
 * @param value - The value.
 */
function textOf(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => textOf(item) ?? '').join(', ');
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return typeof value === 'object' ? undefined : String(value);
}

/**
 * fieldValues returns the values of the fields of the front matter of a text.
 * @param text - The text of the file.
 */
export function fieldValues(text: string): FieldValues {
  const body = text.startsWith('\ufeff') ? text.slice(1) : text;
  const lines = body.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
  const front = frontMatterOf(lines);
  if (!front) {
    return { values: {} };
  }
  let data: unknown;
  try {
    data = readFrontMatter(lines.slice(0, front.lines).join('\n'), front.format);
  } catch (error) {
    return { values: {}, error: (error as Error).message };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { values: {}, data, error: 'The front matter is no map of fields.' };
  }
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    const text = textOf(value);
    if (text !== undefined) {
      values[key] = text;
    }
  }
  return { values, data };
}
