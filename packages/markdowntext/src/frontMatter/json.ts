// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The edits of a front matter in JSON (docs/editor.md, R-FM-005), which may hold the comments of JSONC. The library
// `jsonc-parser` gives the place of each value in the text and replaces a value; this file inserts and removes keys and
// items itself, line by line, because the library also changes the format of the values around the edit. A key or an
// item on a line of its own takes its lines with it; in a collection on one line, `[1, 2]`, the edit stays on that
// line.

import { applyEdits, findNodeAtLocation, modify, parseTree, type Node as JsonNode } from 'jsonc-parser';
import { FrontMatterError, type FrontMatterEdit, type FrontMatterPath } from './types';

/** lineStart returns the position of the start of the line of a position. */
const lineStart = (text: string, offset: number): number => text.lastIndexOf('\n', offset - 1) + 1;

/** lineEnd returns the position of the line break that ends the line of a position, or the end of the text. */
function lineEnd(text: string, offset: number): number {
  const end = text.indexOf('\n', offset);
  return end < 0 ? text.length : end;
}

/** indentOf returns the spaces before a position on its line. */
const indentOf = (text: string, offset: number): string => text.slice(lineStart(text, offset), offset).match(/^[ \t]*/)?.[0] ?? '';

/** endOf returns the position after the text of a node. */
const endOf = (node: JsonNode): number => node.offset + node.length;

/** splice returns the text with the part between two positions replaced. */
const splice = (text: string, from: number, to: number, insert: string): string => text.slice(0, from) + insert + text.slice(to);

/** onLines returns true when a collection writes its entries on lines of their own. */
const onLines = (text: string, node: JsonNode): boolean => text.slice(node.offset, endOf(node)).includes('\n');

/** FormattingOptions are the indentation and the line break of a JSON text. */
interface FormattingOptions {
  insertSpaces: boolean;
  tabSize: number;
  eol: string;
}

/** formattingOf returns the indentation of a JSON text: tabs, or the number of spaces of its first indented line. */
export function formattingOf(text: string): FormattingOptions {
  const indent = text.match(/\n([ \t]+)\S/)?.[1] ?? '  ';
  return indent.startsWith('\t') ? { insertSpaces: false, tabSize: 1, eol: '\n' } : { insertSpaces: true, tabSize: indent.length, eol: '\n' };
}

/** valueText returns the text of a value: on lines in the indentation of its place, or on one line. */
function valueText(value: unknown, options: FormattingOptions, indent: string | undefined): string {
  if (value === undefined) {
    throw new FrontMatterError('JSON has no value undefined.');
  }
  if (indent === undefined) {
    return JSON.stringify(value);
  }
  const unit = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
  return JSON.stringify(value, null, unit).replace(/\n/g, `\n${indent}`);
}

/** nodeAt returns the node of the value at a path. */
function nodeAt(tree: JsonNode, path: FrontMatterPath): JsonNode | undefined {
  return path.length === 0 ? tree : findNodeAtLocation(tree, [...path]);
}

/** entriesOf returns the entries of a collection: the properties of an object or the items of an array. */
const entriesOf = (node: JsonNode): JsonNode[] => node.children ?? [];

/** commaAfter returns the position of the comma after a node, or -1 when the next text is no comma. */
function commaAfter(text: string, node: JsonNode): number {
  const rest = text.slice(endOf(node)).match(/^\s*,/);
  return rest ? endOf(node) + rest[0].length - 1 : -1;
}

/** insertEntry inserts the text of an entry into a collection, at an index of its entries. */
function insertEntry(text: string, options: FormattingOptions, collection: JsonNode, index: number, entry: (indent: string | undefined) => string): string {
  const entries = entriesOf(collection);
  const lines = onLines(text, collection);
  if (entries.length === 0) {
    if (!lines && collection.offset > 0) {
      return splice(text, collection.offset + 1, collection.offset + 1, entry(undefined));
    }
    const indent = indentOf(text, collection.offset) + (options.insertSpaces ? ' '.repeat(options.tabSize) : '\t');
    const close = endOf(collection) - 1;
    const before = text.slice(collection.offset + 1, close).trim() === '' ? collection.offset + 1 : close;
    return splice(text, before, close, `\n${indent}${entry(indent)}\n${indentOf(text, close)}`);
  }
  if (index < entries.length) {
    const next = entries[index];
    if (lines) {
      const indent = indentOf(text, next.offset);
      return splice(text, lineStart(text, next.offset), lineStart(text, next.offset), `${indent}${entry(indent)},\n`);
    }
    return splice(text, next.offset, next.offset, `${entry(undefined)}, `);
  }
  const last = entries[entries.length - 1];
  if (!lines) {
    return splice(text, endOf(last), endOf(last), `, ${entry(undefined)}`);
  }
  const indent = indentOf(text, last.offset);
  const comma = commaAfter(text, last);
  const end = lineEnd(text, comma >= 0 ? comma : endOf(last));
  const added = splice(text, end, end, `\n${indent}${entry(indent)}`);
  return comma >= 0 ? added : splice(added, endOf(last), endOf(last), ',');
}

/** removeEntry removes an entry of a collection: its lines, or its part of a line with the comma that separates it. */
function removeEntry(text: string, collection: JsonNode, index: number, root: boolean): string {
  const entries = entriesOf(collection);
  const entry = entries[index];
  if (entries.length === 1) {
    const empty = collection.type === 'object' ? '{}' : '[]';
    return root ? '{\n}' : splice(text, collection.offset, endOf(collection), empty);
  }
  if (!onLines(text, collection)) {
    return index > 0 ? splice(text, endOf(entries[index - 1]), endOf(entry), '') : splice(text, entry.offset, entries[1].offset, '');
  }
  const comma = commaAfter(text, entry);
  const end = lineEnd(text, comma >= 0 ? comma : endOf(entry));
  let result = splice(text, lineStart(text, entry.offset), Math.min(end + 1, text.length), '');
  if (index === entries.length - 1) {
    // The entry before the last one loses its comma.
    const before = commaAfter(result, entries[index - 1]);
    if (before >= 0) {
      result = splice(result, before, before + 1, '');
    }
  }
  return result;
}

/** editJson returns the text of a JSON front matter after an edit. */
export function editJson(text: string, edit: FrontMatterEdit): string {
  const tree = parseTree(text, [], { allowTrailingComma: true, disallowComments: false });
  if (!tree || tree.type !== 'object') {
    throw new FrontMatterError('The front matter is no object.');
  }
  const options = formattingOf(text);
  const containerPath = edit.path.slice(0, -1);
  const last = edit.path[edit.path.length - 1];
  const container = nodeAt(tree, containerPath);
  if (!container || (container.type !== 'object' && container.type !== 'array')) {
    throw new FrontMatterError(`The front matter has no collection at ${containerPath.join('.')}.`);
  }
  const index =
    container.type === 'object' ? entriesOf(container).findIndex((property) => property.children?.[0]?.value === String(last)) : Number(last);
  const exists = container.type === 'object' ? index >= 0 : index < entriesOf(container).length;
  switch (edit.kind) {
    case 'set': {
      if (exists) {
        return applyEdits(text, modify(text, [...edit.path], edit.value, { formattingOptions: options }));
      }
      if (container.type === 'array') {
        return insertEntry(text, options, container, entriesOf(container).length, (indent) => valueText(edit.value, options, indent));
      }
      const after = edit.after === undefined ? -1 : entriesOf(container).findIndex((property) => property.children?.[0]?.value === edit.after);
      const at = after < 0 ? entriesOf(container).length : after + 1;
      return insertEntry(text, options, container, at, (indent) => `${JSON.stringify(String(last))}: ${valueText(edit.value, options, indent)}`);
    }
    case 'insert':
      if (container.type !== 'array') {
        throw new FrontMatterError('Only a list takes a new item.');
      }
      return insertEntry(text, options, container, Number(last), (indent) => valueText(edit.value, options, indent));
    case 'remove':
      return exists ? removeEntry(text, container, index, containerPath.length === 0 && entriesOf(container).length === 1) : text;
    case 'rename': {
      const key = container.type === 'object' && exists ? entriesOf(container)[index].children?.[0] : undefined;
      if (!key) {
        throw new FrontMatterError(`The front matter has no key ${String(last)}.`);
      }
      if (entriesOf(container).some((property) => property.children?.[0]?.value === edit.key)) {
        throw new FrontMatterError(`The key ${edit.key} is already there.`);
      }
      return splice(text, key.offset, endOf(key), JSON.stringify(edit.key));
    }
  }
}
