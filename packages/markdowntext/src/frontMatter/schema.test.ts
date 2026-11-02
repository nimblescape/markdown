// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the schema of a front matter (docs/editor.md, R-FM-004): the problems of the data with their paths and
// messages, and the schema of a value at a path.

import { describe, expect, it } from 'vitest';
import { readFrontMatter } from './edit';
import { checkFrontMatter, schemaAt, type JsonSchema } from './schema';

const schema: JsonSchema = {
  type: 'object',
  required: ['title', 'date'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', title: 'Title' },
    date: { type: 'string', format: 'date' },
    kind: { enum: ['thesis', 'concept'] },
    pages: { type: 'integer', minimum: 1 },
    authors: { type: 'array', items: { $ref: '#/$defs/author' } },
  },
  $defs: { author: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, email: { type: 'string', format: 'email' } } } },
};

describe('the schema of a front matter', () => {
  it('gives each problem the path of its value and a message in plain words', () => {
    const problems = checkFrontMatter({ date: '2026-13-01', kind: 'paper', pages: 0, authors: [{ email: 'x' }], extra: 1 }, schema);
    expect(problems).toEqual([
      { path: ['title'], message: 'A value is required.' },
      { path: ['date'], message: 'The value must be a date such as 2026-11-02.' },
      { path: ['kind'], message: 'The value must be one of: thesis, concept.' },
      { path: ['pages'], message: 'The value must be at least 1.' },
      { path: ['authors', 0, 'name'], message: 'A value is required.' },
      { path: ['authors', 0, 'email'], message: 'The value must be an email address.' },
      { path: ['extra'], message: 'The schema does not allow this key.' },
    ]);
    expect(checkFrontMatter({ title: 'A', date: '2026-11-02', authors: [{ name: 'Ana' }] }, schema)).toEqual([]);
  });

  it('checks the dates of TOML as their text', () => {
    const data = readFrontMatter('+++\ntitle = "A"\ndate = 2026-11-02\n+++', 'toml');
    expect(checkFrontMatter(data, schema)).toEqual([]);
  });

  it('gives the schema of a value through the references', () => {
    expect(schemaAt(schema, ['authors', 3, 'email'])).toEqual({ type: 'string', format: 'email' });
    expect(schemaAt(schema, ['title'])?.title).toBe('Title');
    expect(schemaAt(schema, ['extra'])).toBeUndefined();
    expect(schemaAt(undefined, ['title'])).toBeUndefined();
  });
});
