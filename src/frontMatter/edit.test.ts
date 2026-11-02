// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the edits of a front matter (docs/editor.md, R-FM-005): each edit changes only the text of the edited
// value, in YAML, TOML and JSON, and the comments, the order and the quotes of the other keys stay.

import { describe, expect, it } from 'vitest';
import { editFrontMatter, readFrontMatter } from './edit';
import { FrontMatterError, type FrontMatterEdit } from './types';

/** yaml returns the text of a YAML front matter with its fences. */
const yaml = (body: string): string => `---\n${body}---`;

/** edited returns the text of a YAML front matter after edits, without its fences. */
function edited(body: string, ...edits: FrontMatterEdit[]): string {
  let text = yaml(body);
  for (const edit of edits) {
    text = editFrontMatter(text, 'yaml', edit);
  }
  return text.slice(4, -3);
}

describe('the edits of a YAML front matter', () => {
  const text = "# Paper\ntitle: 'Old'   # the title\nauthors:\n- Ana\n- Ben\nlayout: {name: pht, version: 2}\nabstract: |\n  Line one.\n  Line two.\ncount: 5\n";

  it('reads the data', () => {
    expect(readFrontMatter(yaml(text), 'yaml')).toEqual({
      title: 'Old',
      authors: ['Ana', 'Ben'],
      layout: { name: 'pht', version: 2 },
      abstract: 'Line one.\nLine two.\n',
      count: 5,
    });
    expect(readFrontMatter('---\n---', 'yaml')).toEqual({});
  });

  it('change a value and keep its quotes and the comment after it', () => {
    expect(edited(text, { kind: 'set', path: ['title'], value: "It's new" })).toBe(text.replace("'Old'", "'It''s new'"));
    expect(edited(text, { kind: 'set', path: ['count'], value: 7 })).toBe(text.replace('count: 5', 'count: 7'));
    expect(edited(text, { kind: 'set', path: ['authors', 1], value: 'Cleo' })).toBe(text.replace('- Ben', '- Cleo'));
  });

  it('write a text in quotes when it would read as another value', () => {
    expect(edited('a: x\n', { kind: 'set', path: ['a'], value: '42' })).toBe('a: "42"\n');
    expect(edited('a: x\n', { kind: 'set', path: ['a'], value: 'b: c' })).toBe('a: "b: c"\n');
    expect(edited('a: x\n', { kind: 'set', path: ['a'], value: true })).toBe('a: true\n');
    expect(edited('a: ""\n', { kind: 'set', path: ['a'], value: 'x' })).toBe('a: x\n');
  });

  it('change a text over more lines in the indentation of its key', () => {
    expect(edited(text, { kind: 'set', path: ['abstract'], value: 'One.\nTwo.\n' })).toBe(text.replace('  Line one.\n  Line two.\n', '  One.\n  Two.\n'));
    expect(edited('group:\n  note: x\n', { kind: 'set', path: ['group', 'note'], value: 'a\nb' })).toBe('group:\n  note: |-\n    a\n    b\n');
  });

  it('add a key after a key or at the end, in the indentation of its map', () => {
    expect(edited(text, { kind: 'set', path: ['date'], value: '2026-11-02', after: 'title' })).toBe(
      text.replace('# the title\n', '# the title\ndate: 2026-11-02\n'),
    );
    expect(edited(text, { kind: 'set', path: ['tags'], value: ['a', 'b'] })).toBe(`${text}tags:\n- a\n- b\n`);
    expect(edited('group:\n    a: 1\n', { kind: 'set', path: ['group', 'b'], value: { c: 1 } })).toBe('group:\n    a: 1\n    b:\n        c: 1\n');
    expect(edited('', { kind: 'set', path: ['title'], value: 'New' })).toBe('title: New\n');
    expect(edited('# only a comment\n', { kind: 'set', path: ['title'], value: 'New' })).toBe('# only a comment\ntitle: New\n');
    expect(edited('empty:\nnext: 1\n', { kind: 'set', path: ['empty', 'a'], value: 1 })).toBe('empty:\n  a: 1\nnext: 1\n');
  });

  it('add and insert the items of a block list in the style of the file', () => {
    expect(edited(text, { kind: 'set', path: ['authors', 2], value: 'Cleo' })).toBe(text.replace('- Ben\n', '- Ben\n- Cleo\n'));
    expect(edited(text, { kind: 'insert', path: ['authors', 0], value: 'Zoe' })).toBe(text.replace('- Ana\n', '- Zoe\n- Ana\n'));
    expect(edited('list:\n  - a\n', { kind: 'insert', path: ['list', 1], value: { k: 1, j: 2 } })).toBe('list:\n  - a\n  - k: 1\n    j: 2\n');
    expect(edited('list: []\n', { kind: 'insert', path: ['list', 0], value: 'a' })).toBe('list: [a]\n');
  });

  it('change a flow collection as a whole and keep its style', () => {
    expect(edited(text, { kind: 'set', path: ['layout', 'version'], value: 3 })).toBe(text.replace('version: 2', 'version: 3'));
    expect(edited(text, { kind: 'set', path: ['layout', 'paper'], value: 'a4' })).toBe(text.replace('version: 2}', 'version: 2, paper: a4}'));
    expect(edited(text, { kind: 'remove', path: ['layout', 'name'] })).toBe(text.replace('name: pht, ', ''));
  });

  it('remove a key or an item with its lines and keep the other lines', () => {
    expect(edited(text, { kind: 'remove', path: ['title'] })).toBe(text.replace("title: 'Old'   # the title\n", ''));
    expect(edited(text, { kind: 'remove', path: ['abstract'] })).toBe(text.replace('abstract: |\n  Line one.\n  Line two.\n', ''));
    expect(edited(text, { kind: 'remove', path: ['authors', 0] })).toBe(text.replace('- Ana\n', ''));
    expect(edited('list:\n- a\nnext: 1\n', { kind: 'remove', path: ['list', 0] })).toBe('list: []\nnext: 1\n');
    expect(edited('list:\n- a: 1\n  b: 2\n', { kind: 'remove', path: ['list', 0, 'a'] })).toBe('list:\n- b: 2\n');
    expect(edited('group:\n  a: 1\nnext: 1\n', { kind: 'remove', path: ['group', 'a'] })).toBe('group: {}\nnext: 1\n');
  });

  it('rename a key in place', () => {
    expect(edited(text, { kind: 'rename', path: ['count'], key: 'pages' })).toBe(text.replace('count: 5', 'pages: 5'));
    expect(edited('"a": 1\n', { kind: 'rename', path: ['a'], key: 'b' })).toBe('"b": 1\n');
    expect(() => edited(text, { kind: 'rename', path: ['count'], key: 'title' })).toThrow(FrontMatterError);
  });

  it('replace a value with a list or a map', () => {
    expect(edited('a: x\nb: 1\n', { kind: 'set', path: ['a'], value: ['p', 'q'] })).toBe('a:\n  - p\n  - q\nb: 1\n');
    expect(edited('a:\n- x\nb: 1\n', { kind: 'set', path: ['a'], value: { k: 'v' } })).toBe('a:\n  k: v\nb: 1\n');
  });

  it('report a text that does not parse', () => {
    expect(() => readFrontMatter(yaml('a: [\n'), 'yaml')).toThrow(FrontMatterError);
    expect(() => readFrontMatter(yaml('a: 1\na: 2\n'), 'yaml')).toThrow(FrontMatterError);
  });
});

describe('the edits of a TOML front matter', () => {
  const text = "+++\n# Paper\ntitle = 'Old'  # the title\ndate = 2026-11-02\nauthors = [\"Ana\", \"Ben\"]\n\n[layout]\nname = \"pht\"\n+++";

  it('reads the data with the dates of TOML', () => {
    const data = readFrontMatter(text, 'toml') as Record<string, unknown>;
    expect(data.title).toBe('Old');
    expect(data.date).toBeInstanceOf(Date);
    expect(data.layout).toEqual({ name: 'pht' });
  });

  it('change a value, add a key and an item, and keep the comments', () => {
    let next = editFrontMatter(text, 'toml', { kind: 'set', path: ['title'], value: 'New' });
    expect(next).toBe(text.replace("'Old'", "'New'"));
    next = editFrontMatter(next, 'toml', { kind: 'set', path: ['authors', 2], value: 'Cleo' });
    expect(next).toContain('authors = ["Ana", "Ben", "Cleo"]');
    next = editFrontMatter(next, 'toml', { kind: 'set', path: ['layout', 'paper'], value: 'a4' });
    expect(next).toContain('[layout]\nname = "pht"\npaper = "a4"\n+++');
    expect(next).toContain('# Paper\n');
    expect(next).toContain('# the title\n');
  });

  it('remove and rename a key', () => {
    expect(editFrontMatter(text, 'toml', { kind: 'remove', path: ['date'] })).not.toContain('date');
    expect(editFrontMatter(text, 'toml', { kind: 'rename', path: ['title'], key: 'name' })).toContain("name = 'Old'  # the title");
  });

  it('has no empty value', () => {
    expect(() => editFrontMatter(text, 'toml', { kind: 'set', path: ['title'], value: null })).toThrow(FrontMatterError);
  });
});

describe('the edits of a JSON front matter', () => {
  const text = '{\n    "title": "Old", // the title\n    "tags": ["a"]\n}';

  it('change a value and keep the comment and the indentation', () => {
    expect(editFrontMatter(text, 'json', { kind: 'set', path: ['title'], value: 'New' })).toBe(text.replace('"Old"', '"New"'));
    expect(editFrontMatter(text, 'json', { kind: 'set', path: ['date'], value: '2026-11-02' })).toBe(
      '{\n    "title": "Old", // the title\n    "tags": ["a"],\n    "date": "2026-11-02"\n}',
    );
  });

  it('insert an item, remove and rename a key', () => {
    expect(readFrontMatter(editFrontMatter(text, 'json', { kind: 'insert', path: ['tags', 0], value: 'z' }), 'json')).toEqual({ title: 'Old', tags: ['z', 'a'] });
    expect(editFrontMatter(text, 'json', { kind: 'rename', path: ['title'], key: 'name' })).toBe(text.replace('"title"', '"name"'));
    const empty = editFrontMatter(editFrontMatter(text, 'json', { kind: 'remove', path: ['title'] }), 'json', { kind: 'remove', path: ['tags'] });
    expect(empty).toBe('{\n}');
  });

  it('remove a key with its line and its comment, and an item of a list on one line', () => {
    const more = '{\n  "a": 1, // one\n  "b": [1, 2, 3], // two\n  "c": {"x": 1}\n}';
    expect(editFrontMatter(more, 'json', { kind: 'remove', path: ['b'] })).toBe('{\n  "a": 1, // one\n  "c": {"x": 1}\n}');
    expect(editFrontMatter(more, 'json', { kind: 'remove', path: ['c'] })).toBe('{\n  "a": 1, // one\n  "b": [1, 2, 3] // two\n}');
    expect(editFrontMatter(more, 'json', { kind: 'remove', path: ['b', 1] })).toBe(more.replace('[1, 2, 3]', '[1, 3]'));
    expect(editFrontMatter(more, 'json', { kind: 'remove', path: ['b', 0] })).toBe(more.replace('[1, 2, 3]', '[2, 3]'));
    expect(editFrontMatter(more, 'json', { kind: 'remove', path: ['c', 'x'] })).toBe(more.replace('{"x": 1}', '{}'));
  });

  it('insert the items of a list in the style of the list', () => {
    const more = '{\n  "inline": [1, 3],\n  "lines": [\n    "a"\n  ]\n}';
    expect(editFrontMatter(more, 'json', { kind: 'insert', path: ['inline', 1], value: 2 })).toBe(more.replace('[1, 3]', '[1, 2, 3]'));
    expect(editFrontMatter(more, 'json', { kind: 'set', path: ['inline', 2], value: 4 })).toBe(more.replace('[1, 3]', '[1, 3, 4]'));
    expect(editFrontMatter(more, 'json', { kind: 'insert', path: ['lines', 0], value: 'z' })).toBe(more.replace('    "a"', '    "z",\n    "a"'));
    expect(editFrontMatter(more, 'json', { kind: 'set', path: ['lines', 1], value: { k: 1 } })).toBe(more.replace('    "a"', '    "a",\n    {\n      "k": 1\n    }'));
  });

  it('report a text that does not parse', () => {
    expect(() => readFrontMatter('{\n  "a": \n}', 'json')).toThrow(/line 3/);
  });
});
