// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The schema of a front matter (docs/editor.md, R-FM-002, R-FM-004): a standard JSON Schema, draft 2020-12, which
// defines what the front matter must hold, which keys the user can edit and which values each key allows. The library
// `@cfworker/json-schema` checks the data without eval, which the page policy of a webview of VS Code forbids. This
// file gives each problem the path of its value and a message in plain words, and gives the form the schema of a
// value.

import { Validator, type OutputUnit, type Schema } from '@cfworker/json-schema';
import { tomlText } from './edit';
import type { FrontMatterPath } from './types';

/** JsonType is a type of a value of JSON Schema. */
export type JsonType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

/** JsonSchemaObject is a schema of JSON Schema with the keywords that the form reads (R-FM-004). */
export interface JsonSchemaObject {
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  type?: JsonType | JsonType[];
  title?: string;
  description?: string;
  readOnly?: boolean;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: JsonSchema;
  items?: JsonSchema;
  prefixItems?: JsonSchema[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  [keyword: string]: unknown;
}

/** JsonSchema is a schema of JSON Schema: an object, or `true` for every value and `false` for none. */
export type JsonSchema = boolean | JsonSchemaObject;

/** FrontMatterProblem is a value of a front matter that its schema does not allow. */
export interface FrontMatterProblem {
  /** path is the path of the value; for a missing key, the path of that key. */
  path: FrontMatterPath;
  /** message says what the schema needs, in plain words. */
  message: string;
}

/** isObject returns true for a schema that is an object. */
const isObject = (schema: unknown): schema is JsonSchemaObject => schema !== null && typeof schema === 'object' && !Array.isArray(schema);

/** pointer returns the value at a JSON pointer of a schema, `#/properties/a`, and follows each `$ref` on the way. */
function pointer(root: JsonSchema, location: string, follow = true): unknown {
  const segments = location.replace(/^#\/?/, '').split('/').filter((segment) => segment !== '');
  let node: unknown = root;
  for (const raw of segments) {
    const segment = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    if (follow && segment === '$ref' && isObject(node) && typeof node.$ref === 'string') {
      node = resolved(root, node);
      continue;
    }
    node = node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined;
  }
  return node;
}

/** resolved returns a schema after its local references `$ref: '#/$defs/name'`; a reference to another file stays. */
function resolved(root: JsonSchema, schema: unknown): unknown {
  let node = schema;
  for (let step = 0; step < 32 && isObject(node) && typeof node.$ref === 'string' && node.$ref.startsWith('#'); step++) {
    const target = pointer(root, node.$ref, false);
    const { $ref: _ref, ...rest } = node;
    node = isObject(target) ? { ...target, ...rest } : target;
  }
  return node;
}

/**
 * schemaAt returns the schema of the value at a path, from `properties`, `additionalProperties`, `prefixItems` and
 * `items`, or undefined when the schema says nothing about the value.
 * @param root - The schema of the front matter.
 * @param path - The path of the value.
 */
export function schemaAt(root: JsonSchema | undefined, path: FrontMatterPath): JsonSchemaObject | undefined {
  if (root === undefined) {
    return undefined;
  }
  let node = resolved(root, root);
  for (const segment of path) {
    if (!isObject(node)) {
      return undefined;
    }
    const next: unknown =
      typeof segment === 'number'
        ? (node.prefixItems?.[segment] ?? node.items)
        : (node.properties?.[segment] ?? (isObject(node.additionalProperties) ? node.additionalProperties : undefined));
    node = resolved(root, next);
  }
  return isObject(node) ? node : undefined;
}

/** typeOf returns the first type of a schema that is not `null`. */
export function typeOf(schema: JsonSchemaObject | undefined): JsonType | undefined {
  const types = schema?.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  return types.find((type) => type !== 'null') ?? types[0];
}

/** forJson returns data as JSON gives it: the dates of TOML become their text, which the formats of JSON Schema check. */
function forJson(value: unknown): unknown {
  if (value instanceof Date) {
    return tomlText(value);
  }
  if (Array.isArray(value)) {
    return value.map(forJson);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, forJson(item)]));
  }
  return value;
}

/** names of the types in the messages. */
const typeNames: Record<JsonType, string> = {
  string: 'a text',
  number: 'a number',
  integer: 'a whole number',
  boolean: 'yes or no',
  array: 'a list',
  object: 'a group of keys',
  null: 'empty',
};

/** names of the formats in the messages. */
const formatNames: Record<string, string> = {
  date: 'a date such as 2026-11-02',
  'date-time': 'a date and a time such as 2026-11-02T14:30:00Z',
  time: 'a time such as 14:30:00',
  email: 'an email address',
  uri: 'an address such as https://example.com',
  'uri-reference': 'an address',
};

/** messageOf returns the message of a problem, from the keyword and the schema that holds it. */
function messageOf(unit: OutputUnit, holder: JsonSchemaObject | undefined): string {
  const value = holder?.[unit.keyword];
  const list = (items: unknown): string => (Array.isArray(items) ? items.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(', ') : '');
  switch (unit.keyword) {
    case 'required':
      return 'A value is required.';
    case 'type': {
      const types = (Array.isArray(value) ? value : [value]).filter((type): type is JsonType => typeof type === 'string' && type in typeNames);
      return types.length > 0 ? `The value must be ${types.map((type) => typeNames[type]).join(' or ')}.` : unit.error;
    }
    case 'enum':
      return `The value must be one of: ${list(value)}.`;
    case 'const':
      return `The value must be ${JSON.stringify(value)}.`;
    case 'format':
      return `The value must be ${formatNames[String(value)] ?? `in the format ${String(value)}`}.`;
    case 'pattern':
      return `The text must match the pattern ${String(value)}.`;
    case 'minimum':
      return `The value must be at least ${String(value)}.`;
    case 'maximum':
      return `The value must be at most ${String(value)}.`;
    case 'exclusiveMinimum':
      return `The value must be more than ${String(value)}.`;
    case 'exclusiveMaximum':
      return `The value must be less than ${String(value)}.`;
    case 'multipleOf':
      return `The value must be a multiple of ${String(value)}.`;
    case 'minLength':
      return `The text must have at least ${String(value)} characters.`;
    case 'maxLength':
      return `The text must have at most ${String(value)} characters.`;
    case 'minItems':
      return `The list must have at least ${String(value)} items.`;
    case 'maxItems':
      return `The list must have at most ${String(value)} items.`;
    case 'uniqueItems':
      return 'The items of the list must differ.';
    case 'false':
      return 'The schema does not allow this key.';
    default:
      return unit.error;
  }
}

/** wrappers are the keywords whose problems only collect the problems of their parts, which show themselves. */
const wrappers = new Set(['properties', 'patternProperties', 'additionalProperties', 'items', 'prefixItems', 'allOf', '$ref', 'if', 'then', 'else', 'dependentSchemas', 'unevaluatedProperties', 'unevaluatedItems']);

/** choices are the keywords whose parts are choices: their own problem shows, not the problems of each choice. */
const choices = new Set(['anyOf', 'oneOf', 'not']);

/** pathOf returns the path of a JSON pointer of an instance, `#/authors/0`, with the indexes of lists as numbers. */
function pathOf(location: string, data: unknown): (string | number)[] {
  const path: (string | number)[] = [];
  let node = data;
  for (const raw of location.replace(/^#\/?/, '').split('/').filter((segment) => segment !== '')) {
    const segment = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    const key = Array.isArray(node) ? Number(segment) : segment;
    path.push(key);
    node = node !== null && typeof node === 'object' ? (node as Record<string | number, unknown>)[key] : undefined;
  }
  return path;
}

/** validators keep the validator of each schema, which reads its schema once. */
const validators = new WeakMap<object, Validator>();

/**
 * checkFrontMatter returns the problems of the data of a front matter with its schema, one for each value, in the
 * order of the data.
 * @param data - The data of the front matter.
 * @param schema - The schema of the front matter.
 */
export function checkFrontMatter(data: unknown, schema: JsonSchema): FrontMatterProblem[] {
  if (schema === true) {
    return [];
  }
  if (schema === false) {
    return [{ path: [], message: 'The schema allows no front matter.' }];
  }
  let validator = validators.get(schema);
  if (!validator) {
    validator = new Validator(schema as Schema, '2020-12', false);
    validators.set(schema, validator);
  }
  const json = forJson(data);
  const units = validator.validate(json).errors;
  const problems: FrontMatterProblem[] = [];
  const seen = new Set<string>();
  const inChoice: string[] = [];
  for (const unit of units) {
    if (inChoice.some((location) => unit.keywordLocation.startsWith(`${location}/`))) {
      continue;
    }
    if (choices.has(unit.keyword)) {
      inChoice.push(unit.keywordLocation);
    }
    if (wrappers.has(unit.keyword)) {
      continue;
    }
    const holder = pointer(schema, unit.keywordLocation.replace(/\/[^/]*$/, ''));
    let path = pathOf(unit.instanceLocation, json);
    if (unit.keyword === 'required') {
      const name = unit.error.match(/"([^"]*)"/)?.[1];
      if (name !== undefined) {
        path = [...path, name];
      }
    }
    if (unit.keyword === 'false') {
      // Version 4.1.1 of the library also reports a known key with a wrong value as an additional key.
      const parent = schemaAt(schema, path.slice(0, -1));
      if (parent?.properties && String(path[path.length - 1]) in parent.properties) {
        continue;
      }
    }
    const message = messageOf(unit, isObject(holder) ? holder : undefined);
    const id = `${JSON.stringify(path)} ${message}`;
    if (!seen.has(id)) {
      seen.add(id);
      problems.push({ path, message });
    }
  }
  return problems;
}
