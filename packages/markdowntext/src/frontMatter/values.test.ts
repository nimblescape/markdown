// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the values of the front matter in the text (docs/editor.md, R-FM-007): the values by their paths in
// YAML, TOML and JSON, and the markers of a value.

import { describe, expect, it } from 'vitest';
import { frontMatterValues, valueKeyPattern, valueMarkers } from './values';

describe('the values of a front matter in the text', () => {
  it('gives the values of YAML by their paths, a list as its items joined by commas, and a text of several lines in one line', () => {
    const text = [
      '---',
      'title: "A paper: the plan" # the title',
      'author:',
      '  name: Hannes Stauss',
      '  orcid: null',
      'keywords: [agents, teams]',
      'tags:',
      '  - one',
      '  - two',
      'pages: 42',
      'draft: false',
      'abstract: |',
      '  The first line.',
      '  The second line.',
      'authors:',
      '  - name: Anna',
      'Name with space: x',
      '---',
    ].join('\n');
    expect(Object.fromEntries(frontMatterValues(text, 'yaml'))).toEqual({
      title: 'A paper: the plan',
      'author.name': 'Hannes Stauss',
      keywords: 'agents, teams',
      tags: 'one, two',
      pages: '42',
      draft: 'false',
      abstract: 'The first line. The second line.',
      'authors.0.name': 'Anna',
    });
  });

  it('gives the values of TOML, with a date as TOML writes it, and of JSON', () => {
    const toml = ['+++', 'title = "A paper"', 'date = 2026-11-02', '[author]', 'name = "Hannes Stauss"', '+++'].join('\n');
    expect(Object.fromEntries(frontMatterValues(toml, 'toml'))).toEqual({ title: 'A paper', date: '2026-11-02', 'author.name': 'Hannes Stauss' });
    const json = ['{', '  "title": "A paper",', '  "author": { "name": "Hannes Stauss" }', '}'].join('\n');
    expect(Object.fromEntries(frontMatterValues(json, 'json'))).toEqual({ title: 'A paper', 'author.name': 'Hannes Stauss' });
  });

  it('gives no values for a front matter that does not parse or is no map', () => {
    expect(frontMatterValues('---\ntitle: [a\n---', 'yaml').size).toBe(0);
    expect(frontMatterValues('---\n- a\n---', 'yaml').size).toBe(0);
    expect(frontMatterValues('---\n---', 'yaml').size).toBe(0);
  });

  it('writes the markers of a key, and the pattern of a key takes a path', () => {
    expect(valueMarkers('author.name')).toEqual(['<wbr><!--{author.name}-->', '<!--{/author.name}-->']);
    const key = new RegExp(`^${valueKeyPattern}$`);
    expect(['title', 'author.name', 'authors.0.name', 'a_b-c'].every((name) => key.test(name))).toBe(true);
    expect(['', 'a..b', '.a', 'a b', 'a.'].some((name) => key.test(name))).toBe(false);
  });
});
