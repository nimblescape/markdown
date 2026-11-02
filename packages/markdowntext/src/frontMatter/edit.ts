// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The reading and the edits of a front matter (docs/source.md, R-SRC-003; docs/editor.md, R-FM-005) in its three
// formats. Each edit changes only the text of the edited value: for YAML, the edit of yaml.ts; for
// TOML, `patch` of the library `@decimalturn/toml-patch`; for JSON, the edit of json.ts, which also
// keeps the comments of JSONC. The text of a front matter has its fences, as the document of the editor holds it.

import { parse as parseToml, patch as patchToml, stringify as stringifyToml } from '@decimalturn/toml-patch';
import { parse as parseJson, printParseErrorCode, type ParseError } from 'jsonc-parser';
import type { FrontMatterFormat } from './detect';
import { FrontMatterError, type FrontMatterEdit, type FrontMatterPath } from './types';
import { editJson } from './json';
import { editYaml, readYaml } from './yaml';

/** Parts are the fences and the text between them of a front matter in YAML or TOML. */
interface Parts {
  open: string;
  body: string;
  close: string;
}

/** partsOf returns the fences and the body of a front matter in YAML or TOML; the body ends with a line break. */
function partsOf(text: string): Parts {
  const lines = text.split('\n');
  const inner = lines.slice(1, -1);
  return { open: lines[0], body: inner.length > 0 ? `${inner.join('\n')}\n` : '', close: lines[lines.length - 1] };
}

/** joined returns the text of a front matter from its fences and a new body. */
function joined(parts: Parts, body: string): string {
  const inner = body === '' || body.endsWith('\n') ? body : `${body}\n`;
  return `${parts.open}\n${inner}${parts.close}`;
}

/** isDate returns true for a date or a time of TOML, which the library gives as a Date. */
const isDate = (value: unknown): value is Date => value instanceof Date;

/** plain returns a copy of data with plain objects, which keeps the dates of TOML. */
function plain(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(plain);
  }
  if (value !== null && typeof value === 'object' && !isDate(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  }
  return value;
}

/** tomlText returns the text of a date or a time of TOML, for example `2026-11-02`. */
export function tomlText(value: Date): string {
  return stringifyToml({ v: value }).replace(/^v = /, '').trim();
}

/** tomlValue returns the value of a text of TOML, for example the date of `2026-11-02`, or undefined when it is none. */
export function tomlValue(text: string): unknown {
  try {
    return (parseToml(`v = ${text}`) as { v: unknown }).v;
  } catch {
    return undefined;
  }
}

/** containerOf returns the map or the list at a path of plain data. */
function containerOf(data: unknown, path: FrontMatterPath): Record<string, unknown> | unknown[] {
  let node = data;
  for (const segment of path) {
    node = (node as Record<string | number, unknown> | undefined)?.[segment];
  }
  if (node === null || typeof node !== 'object' || isDate(node)) {
    throw new FrontMatterError(`The front matter has no collection at ${path.join('.')}.`);
  }
  return node as Record<string, unknown> | unknown[];
}

/** withKey returns the entries of a map with a key at a place: in place of a key, after a key, or at the end. */
function withKey(map: Record<string, unknown>, key: string, value: unknown, place: { replace?: string; after?: string }): Record<string, unknown> {
  const entries = Object.entries(map).filter(([name]) => name !== key || place.replace === key);
  const at = place.replace ?? place.after;
  const index = at === undefined ? -1 : entries.findIndex(([name]) => name === at);
  if (place.replace !== undefined && index >= 0) {
    entries[index] = [key, value];
  } else {
    entries.splice(index < 0 ? entries.length : index + 1, 0, [key, value]);
  }
  return Object.fromEntries(entries);
}

/** changed returns plain data after an edit. */
function changed(data: unknown, edit: FrontMatterEdit): unknown {
  const root = plain(data) as Record<string, unknown>;
  const containerPath = edit.path.slice(0, -1);
  const last = edit.path[edit.path.length - 1];
  const container = containerOf(root, containerPath);
  const replace = (next: Record<string, unknown>): unknown => {
    if (containerPath.length === 0) {
      return next;
    }
    const holder = containerOf(root, containerPath.slice(0, -1)) as Record<string | number, unknown>;
    holder[containerPath[containerPath.length - 1]] = next;
    return root;
  };
  if (Array.isArray(container)) {
    const index = Number(last);
    if (edit.kind === 'set') {
      container[index] = edit.value;
    } else if (edit.kind === 'insert') {
      container.splice(index, 0, edit.value);
    } else if (edit.kind === 'remove') {
      container.splice(index, 1);
    } else {
      throw new FrontMatterError('An item of a list has no key.');
    }
    return root;
  }
  const key = String(last);
  switch (edit.kind) {
    case 'set':
      if (key in container) {
        container[key] = edit.value;
        return root;
      }
      return replace(withKey(container, key, edit.value, { after: edit.after }));
    case 'remove':
      delete container[key];
      return root;
    case 'rename':
      if (edit.key in container) {
        throw new FrontMatterError(`The key ${edit.key} is already there.`);
      }
      return replace(withKey(container, edit.key, container[key], { replace: key }));
    case 'insert':
      throw new FrontMatterError('Only a list takes a new item.');
  }
}

/** jsonError returns the message of the first error of a JSON text, with its line. */
function jsonError(text: string, errors: readonly ParseError[]): string {
  const first = errors[0];
  const line = text.slice(0, first.offset).split('\n').length;
  return `${printParseErrorCode(first.error)} on line ${line}.`;
}

/**
 * readFrontMatter returns the data of a front matter, or throws a FrontMatterError with the message of its first
 * problem. A front matter without keys gives an empty map.
 * @param text - The text of the front matter with its fences.
 * @param format - The format of the front matter.
 */
export function readFrontMatter(text: string, format: FrontMatterFormat): unknown {
  switch (format) {
    case 'yaml':
      return readYaml(partsOf(text).body);
    case 'toml':
      try {
        return plain(parseToml(partsOf(text).body));
      } catch (error) {
        throw new FrontMatterError(String((error as Error).message).split('\n')[0]);
      }
    case 'json': {
      const errors: ParseError[] = [];
      const data: unknown = parseJson(text, errors, { allowTrailingComma: true, disallowComments: false });
      if (errors.length > 0) {
        throw new FrontMatterError(jsonError(text, errors));
      }
      return data;
    }
  }
}

/**
 * editFrontMatter returns the text of a front matter after an edit that changes only the text of the edited value
 * (R-FM-005), or throws a FrontMatterError when the edit does not fit the front matter.
 * @param text - The text of the front matter with its fences.
 * @param format - The format of the front matter.
 * @param edit - The edit.
 */
export function editFrontMatter(text: string, format: FrontMatterFormat, edit: FrontMatterEdit): string {
  switch (format) {
    case 'yaml': {
      const parts = partsOf(text);
      return joined(parts, editYaml(parts.body, edit));
    }
    case 'toml': {
      const parts = partsOf(text);
      const next = changed(readFrontMatter(text, 'toml'), edit);
      try {
        return joined(parts, patchToml(parts.body, next));
      } catch (error) {
        throw new FrontMatterError(String((error as Error).message).split('\n')[0]);
      }
    }
    case 'json':
      readFrontMatter(text, 'json');
      return editJson(text, edit);
  }
}
