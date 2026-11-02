// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The edits of a front matter in YAML (docs/editor.md, R-FM-005): an edit changes only the text of the edited value,
// so that the comments, the order and the quotes of the other keys stay as the file writes them. The library `yaml`
// gives the place of each node in the text; the edit replaces, inserts or deletes the lines of that node and writes
// the new value with the library, in the indentation of its place. A value inside a flow collection, for example
// `[a, b]`, changes the text of that collection, which the library writes in its own style.

import { Document, Pair, Scalar, YAMLMap, YAMLSeq, isCollection, isMap, isNode, isScalar, isSeq, parseDocument, visit, type Node as YamlNode } from 'yaml';
import { FrontMatterError, type FrontMatterEdit, type FrontMatterPath } from './types';

/** Style is the way in which a file writes its collections, which new text follows. */
interface Style {
  /** indent is the number of spaces of each level of a block collection. */
  indent: number;
  /** indentSeq is true when a list under a key is indented, `key:\n  - a`, and false for `key:\n- a`. */
  indentSeq: boolean;
  /** flowPadding is true when a flow collection has spaces inside its brackets, `[ a ]`. */
  flowPadding: boolean;
}

/** Located is a node of a document at a path, with the collection and the pair that hold it. */
interface Located {
  node: YamlNode | null;
  parent?: YAMLMap | YAMLSeq;
  pair?: Pair;
  index: number;
}

/** Range is the place of a node in the text: start, end of the value, end of the node with its comment. */
type Range = [number, number, number];

/** rangeOf returns the place of a node in the text. */
const rangeOf = (node: unknown): Range | undefined => (isNode(node) ? (node.range as Range | null | undefined) ?? undefined : undefined);

/** keyName returns the name of the key of a pair as the data of the front matter gives it. */
const keyName = (pair: Pair): string => (isScalar(pair.key) ? String(pair.key.value) : String(pair.key));

/** parse returns the document of a YAML text, or throws an error with the message of the first problem. */
function parse(source: string): Document.Parsed {
  const doc = parseDocument(source, { prettyErrors: true });
  if (doc.errors.length > 0) {
    throw new FrontMatterError(doc.errors[0].message.split('\n')[0]);
  }
  return doc;
}

/** readYaml returns the data of a YAML text. */
export function readYaml(source: string): unknown {
  return parse(source).toJS({ maxAliasCount: 100 }) ?? {};
}

/** column returns the column of a position: the number of characters before it on its line. */
const column = (source: string, offset: number): number => offset - (source.lastIndexOf('\n', offset - 1) + 1);

/** lineStart returns the position of the start of the line of a position. */
const lineStart = (source: string, offset: number): number => source.lastIndexOf('\n', offset - 1) + 1;

/** atLineStart returns true when only spaces stand before a position on its line. */
const atLineStart = (source: string, offset: number): boolean => source.slice(lineStart(source, offset), offset).trim() === '';

/** lineEndAfter returns the position after the line break that ends the line of a position, or the end of the text. */
function lineEndAfter(source: string, offset: number): number {
  if (offset > 0 && source[offset - 1] === '\n') {
    return offset;
  }
  const end = source.indexOf('\n', offset);
  return end < 0 ? source.length : end + 1;
}

/** splice returns the text with the part between two positions replaced. */
const splice = (source: string, from: number, to: number, text: string): string => source.slice(0, from) + text + source.slice(to);

/** styleOf returns the style of the collections of a document; a document without an example has the defaults. */
function styleOf(doc: Document.Parsed, source: string): Style {
  const style: Style = { indent: 2, indentSeq: true, flowPadding: false };
  const found = { indent: false, indentSeq: false, flowPadding: false };
  visit(doc, {
    Pair(_key, pair) {
      const key = rangeOf(pair.key);
      const value = pair.value;
      const at = rangeOf(value);
      if (!key || !at || !isCollection(value) || value.flow) {
        return;
      }
      const first = isMap(value) ? rangeOf(value.items[0]?.key) : at;
      if (!first) {
        return;
      }
      const step = column(source, first[0]) - column(source, key[0]);
      if (isSeq(value) && !found.indentSeq) {
        style.indentSeq = step > 0;
        found.indentSeq = true;
      } else if (isMap(value) && !found.indent && step > 0) {
        style.indent = step;
        found.indent = true;
      }
    },
    Node(_key, node) {
      const at = rangeOf(node);
      if (!found.flowPadding && at && isCollection(node) && node.flow && node.items.length > 0) {
        style.flowPadding = source[at[0] + 1] === ' ';
        found.flowPadding = true;
      }
    },
  });
  return style;
}

/** reindent puts a number of spaces before each line of a text after its first line, except before empty lines. */
const reindent = (text: string, spaces: number): string => text.replace(/\n(?=[^\n])/g, `\n${' '.repeat(spaces)}`);

/** written returns the text of a document with the options of the style. */
function written(doc: Document, style: Style): string {
  return doc.toString({ lineWidth: 0, indent: style.indent, indentSeq: style.indentSeq, flowCollectionPadding: style.flowPadding });
}

/** nodeOf returns a node of a value: the node itself, or a new node that keeps the kind of quotes of a node it replaces. */
function nodeOf(doc: Document, value: unknown, like?: YamlNode | null): YamlNode {
  if (isNode(value)) {
    return value;
  }
  const node = doc.createNode(value) as YamlNode;
  if (isScalar(node) && typeof node.value === 'string') {
    const block = isScalar(like) && (like.type === 'BLOCK_LITERAL' || like.type === 'BLOCK_FOLDED');
    if (node.value.includes('\n')) {
      // A text over more lines is a block of lines, which reads as the text: `|` keeps each line break.
      node.type = block && isScalar(like) ? like.type : 'BLOCK_LITERAL';
    } else if (isScalar(like) && typeof like.value === 'string' && like.value !== '' && like.type && !block) {
      // An empty text needs quotes, `""`, so its quotes are no choice of the file.
      node.type = like.type;
    }
  }
  return node;
}

/**
 * valueText returns the text of a value at its place: after its key, `: value`, or after the dash of an item, `value`,
 * with the lines after the first one indented for the column of the key or of the dash.
 */
function valueText(value: unknown, style: Style, place: 'pair' | 'item', at: number, like?: YamlNode | null): string {
  const doc = new Document();
  const node = nodeOf(doc, value, like);
  if (place === 'pair') {
    const map = new YAMLMap();
    map.items.push(new Pair(new Scalar('k'), node));
    doc.contents = map;
  } else {
    const seq = new YAMLSeq();
    seq.items.push(node);
    doc.contents = seq;
  }
  return reindent(written(doc, style).slice(place === 'pair' ? 1 : 2), at);
}

/** keyText returns the text of a key, in quotes when the key needs them or when the key that it replaces has them. */
function keyText(key: string, like?: unknown): string {
  const doc = new Document();
  const scalar = new Scalar(key);
  if (isScalar(like) && (like.type === 'QUOTE_DOUBLE' || like.type === 'QUOTE_SINGLE')) {
    scalar.type = like.type;
  }
  doc.contents = scalar;
  const text = doc.toString({ lineWidth: 0 }).replace(/\n$/, '');
  if (text.includes('\n')) {
    throw new FrontMatterError('A key must be on one line.');
  }
  return text;
}

/** locate returns the node at a path of a document, or undefined when the document has no node there. */
function locate(doc: Document.Parsed, path: FrontMatterPath): Located | undefined {
  let found: Located = { node: doc.contents as YamlNode | null, index: -1 };
  for (const segment of path) {
    const node = found.node;
    if (isMap(node)) {
      const index = node.items.findIndex((pair) => keyName(pair) === String(segment));
      if (index < 0) {
        return undefined;
      }
      const pair = node.items[index];
      found = { node: (pair.value as YamlNode | null) ?? null, parent: node, pair, index };
    } else if (isSeq(node) && typeof segment === 'number' && segment < node.items.length) {
      found = { node: (node.items[segment] as YamlNode | null) ?? null, parent: node, index: segment };
    } else {
      return undefined;
    }
  }
  return found;
}

/** flowTop returns the length of the shortest part of a path that ends at a flow collection, or -1 when none does. */
function flowTop(doc: Document.Parsed, path: FrontMatterPath): number {
  for (let length = 0; length <= path.length; length++) {
    const node = locate(doc, path.slice(0, length))?.node;
    if (isCollection(node) && node.flow) {
      return length;
    }
  }
  return -1;
}

/** isEmpty returns true when a node holds no value: no node, or a scalar `null` without text. */
const isEmpty = (node: YamlNode | null): boolean => node === null || (isScalar(node) && node.value === null);

/** pairEnd returns the position after the text of a pair: its value with a comment on its line. */
function pairEnd(source: string, pair: Pair): number {
  const ends = [rangeOf(pair.key)?.[2] ?? 0, rangeOf(pair.value)?.[2] ?? 0];
  return lineEndAfter(source, Math.max(...ends));
}

/** dashOf returns the position of the dash of an item of a block list. */
function dashOf(source: string, item: unknown): number {
  const at = rangeOf(item);
  if (!at) {
    throw new FrontMatterError('The item has no place in the text.');
  }
  const dash = source.lastIndexOf('-', at[0]);
  return dash < 0 ? at[0] : dash;
}

/**
 * replaceValue replaces the text of the value at a path with the text of a new value. The text before the value, the
 * key or the dash, and the comment after it stay.
 */
function replaceValue(source: string, doc: Document.Parsed, style: Style, path: FrontMatterPath, value: unknown): string {
  if (path.length === 0) {
    const root = new Document();
    root.contents = nodeOf(root, value);
    return written(root, style);
  }
  const found = locate(doc, path);
  if (!found) {
    throw new FrontMatterError(`The front matter has no value at ${path.join('.')}.`);
  }
  let from: number;
  let text: string;
  if (found.pair) {
    const key = rangeOf(found.pair.key);
    if (!key) {
      throw new FrontMatterError('The key has no place in the text.');
    }
    from = key[1];
    text = valueText(value, style, 'pair', column(source, key[0]), found.node);
  } else {
    const dash = dashOf(source, found.node);
    from = rangeOf(found.node)?.[0] ?? dash + 1;
    text = valueText(value, style, 'item', column(source, dash), found.node);
  }
  const at = rangeOf(found.node);
  let to = at ? at[1] : from;
  if (found.pair && isEmpty(found.node)) {
    // An empty value, `key:`, ends after its colon.
    const colon = source.slice(from).match(/^\s*:/);
    to = Math.max(to, from + (colon ? colon[0].length : 0));
  }
  if (!source.slice(from, to).endsWith('\n')) {
    text = text.replace(/\n$/, '');
  }
  return splice(source, from, to, text);
}

/** mutate changes a collection of the document in place, for an edit inside a flow collection. */
function mutate(doc: Document.Parsed, edit: FrontMatterEdit): void {
  const containerPath = edit.path.slice(0, -1);
  const last = edit.path[edit.path.length - 1];
  const container = locate(doc, containerPath)?.node;
  const index = (collection: YAMLMap | YAMLSeq): number =>
    isMap(collection) ? collection.items.findIndex((pair) => keyName(pair) === String(last)) : Number(last);
  if (!isCollection(container)) {
    throw new FrontMatterError(`The front matter has no collection at ${containerPath.join('.')}.`);
  }
  const at = index(container);
  switch (edit.kind) {
    case 'set': {
      if (isMap(container)) {
        const pair = container.items[at];
        if (pair) {
          pair.value = nodeOf(doc, edit.value, pair.value as YamlNode | null);
        } else {
          const after = edit.after === undefined ? -1 : container.items.findIndex((item) => keyName(item) === edit.after);
          container.items.splice(after < 0 ? container.items.length : after + 1, 0, new Pair(new Scalar(String(last)), nodeOf(doc, edit.value)));
        }
      } else {
        container.items[at] = nodeOf(doc, edit.value, container.items[at] as YamlNode | null);
      }
      break;
    }
    case 'insert':
      if (!isSeq(container)) {
        throw new FrontMatterError('Only a list takes a new item.');
      }
      container.items.splice(at, 0, nodeOf(doc, edit.value));
      break;
    case 'remove':
      if (at >= 0) {
        container.items.splice(at, 1);
      }
      break;
    case 'rename': {
      const pair = isMap(container) ? container.items[at] : undefined;
      if (!pair) {
        throw new FrontMatterError(`The front matter has no key ${String(last)}.`);
      }
      const key = new Scalar(edit.key);
      if (isScalar(pair.key) && pair.key.type !== 'PLAIN') {
        key.type = pair.key.type;
      }
      pair.key = key;
      break;
    }
  }
}

/** addPair adds a key with its value to a block map, after a key or after its last key. */
function addPair(source: string, style: Style, map: YAMLMap | null, key: string, value: unknown, after?: string): string {
  const ref = map ? (map.items.find((pair) => after !== undefined && keyName(pair) === after) ?? map.items[map.items.length - 1]) : undefined;
  const at = ref ? rangeOf(ref.key) : undefined;
  const indent = at ? column(source, at[0]) : 0;
  const offset = ref ? pairEnd(source, ref) : source.length;
  const text = keyText(key) + valueText(value, style, 'pair', indent);
  const lead = offset > 0 && source[offset - 1] !== '\n' ? '\n' : '';
  return splice(source, offset, offset, `${lead}${' '.repeat(indent)}${text}`);
}

/** addItem inserts an item into a block list, before the item at an index or after its last item. */
function addItem(source: string, style: Style, seq: YAMLSeq, index: number, value: unknown): string {
  const dash = dashOf(source, seq.items[Math.min(index, seq.items.length - 1)]);
  const indent = column(source, dash);
  let offset: number;
  if (index < seq.items.length) {
    offset = lineStart(source, dash);
  } else {
    const last = rangeOf(seq.items[seq.items.length - 1]);
    offset = lineEndAfter(source, last ? last[2] : dash);
  }
  const lead = offset > 0 && source[offset - 1] !== '\n' ? '\n' : '';
  return splice(source, offset, offset, `${lead}${' '.repeat(indent)}- ${valueText(value, style, 'item', indent)}`);
}

/** removeEntry removes a key of a block map or an item of a block list with its lines. */
function removeEntry(source: string, doc: Document.Parsed, style: Style, path: FrontMatterPath): string {
  const found = locate(doc, path);
  if (!found?.parent) {
    return source;
  }
  const parentPath = path.slice(0, -1);
  const collection = found.parent;
  if (collection.items.length === 1 && parentPath.length > 0) {
    return replaceValue(source, doc, style, parentPath, isMap(collection) ? {} : []);
  }
  if (found.pair) {
    const key = rangeOf(found.pair.key);
    if (!key) {
      return source;
    }
    if (atLineStart(source, key[0])) {
      return splice(source, lineStart(source, key[0]), pairEnd(source, found.pair), '');
    }
    // The first key of a map in an item of a list, `- a: 1`: the next key takes its place.
    const next = rangeOf((collection as YAMLMap).items[found.index + 1]?.key);
    if (next) {
      return splice(source, key[0], next[0], '');
    }
  } else {
    const dash = dashOf(source, found.node);
    const at = rangeOf(found.node);
    if (atLineStart(source, dash) && at) {
      return splice(source, lineStart(source, dash), lineEndAfter(source, at[2]), '');
    }
  }
  mutate(doc, { kind: 'remove', path });
  return replaceValue(source, doc, style, parentPath, collection);
}

/**
 * editYaml returns the text of a YAML front matter after an edit, or throws a FrontMatterError when the edit does not
 * fit the text.
 * @param source - The text between the fences of the front matter.
 * @param edit - The edit.
 */
export function editYaml(source: string, edit: FrontMatterEdit): string {
  const doc = parse(source);
  const style = styleOf(doc, source);
  const path = edit.path;
  if (path.length === 0) {
    if (edit.kind !== 'set') {
      throw new FrontMatterError('The front matter itself has no key.');
    }
    return replaceValue(source, doc, style, path, edit.value);
  }
  const containerPath = path.slice(0, -1);
  const last = path[path.length - 1];
  const flow = flowTop(doc, containerPath);
  if (flow >= 0) {
    mutate(doc, edit);
    const top = locate(doc, containerPath.slice(0, flow))?.node;
    if (flow === 0) {
      return written(doc, style);
    }
    return replaceValue(source, doc, style, containerPath.slice(0, flow), top);
  }
  const container = locate(doc, containerPath);
  if (!container) {
    throw new FrontMatterError(`The front matter has no value at ${containerPath.join('.')}.`);
  }
  const existing = locate(doc, path);
  switch (edit.kind) {
    case 'set':
      if (existing) {
        return replaceValue(source, doc, style, path, edit.value);
      }
      if (isSeq(container.node) && typeof last === 'number') {
        return addItem(source, style, container.node, container.node.items.length, edit.value);
      }
      if (isMap(container.node)) {
        return addPair(source, style, container.node, String(last), edit.value, edit.after);
      }
      if (isEmpty(container.node)) {
        if (containerPath.length === 0) {
          return addPair(source, style, null, String(last), edit.value);
        }
        return replaceValue(source, doc, style, containerPath, typeof last === 'number' ? [edit.value] : { [last]: edit.value });
      }
      throw new FrontMatterError(`The value at ${containerPath.join('.')} has no keys.`);
    case 'insert': {
      const index = Number(last);
      if (isSeq(container.node) && container.node.items.length > 0) {
        return addItem(source, style, container.node, index, edit.value);
      }
      if (isEmpty(container.node) || isSeq(container.node)) {
        return replaceValue(source, doc, style, containerPath, [edit.value]);
      }
      throw new FrontMatterError(`The value at ${containerPath.join('.')} is no list.`);
    }
    case 'remove':
      return existing ? removeEntry(source, doc, style, path) : source;
    case 'rename': {
      const key = existing?.pair ? rangeOf(existing.pair.key) : undefined;
      if (!existing?.pair || !key) {
        throw new FrontMatterError(`The front matter has no key ${String(last)}.`);
      }
      if (isMap(container.node) && container.node.items.some((pair) => keyName(pair) === edit.key && pair !== existing.pair)) {
        throw new FrontMatterError(`The key ${edit.key} is already there.`);
      }
      return splice(source, key[0], key[1], keyText(edit.key, existing.pair.key));
    }
  }
}
