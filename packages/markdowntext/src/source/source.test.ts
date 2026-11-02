// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the source (docs/source.md, R-SRC-001, R-SRC-002): the patches between two texts, the positions after a
// change, the changes with their origin, the selections of the editors, the order of the changes for the listeners,
// and the file.

import { describe, expect, it } from 'vitest';
import { applyPatches, mapPosition, patchesBetween, type TextPatch } from './patch';
import { TextSource, type TextChange, type TextFile } from './textSource';

const user = { kind: 'user', editor: 'a' } as const;

describe('the patches between two texts', () => {
  const cases: [string, string, string][] = [
    ['same text', 'a\nb\n', 'a\nb\n'],
    ['one character in a line', '# Title\n\nSome text.\n', '# Title\n\nSome test.\n'],
    ['a new line', 'a\nb\n', 'a\nx\nb\n'],
    ['a removed line', 'a\nx\nb\n', 'a\nb\n'],
    ['two places far apart', 'one\ntwo\nthree\nfour\nfive\n', 'One\ntwo\nthree\nfour\nFive\n'],
    ['from an empty text', '', 'new\n'],
    ['to an empty text', 'old\n', ''],
    ['a text that starts with a line break', '\nA', 'B'],
    ['line breaks of Windows', 'a\r\nb\r\n', 'a\r\nc\r\n'],
    ['no line break at the end', 'a\nb', 'a\nb\nc'],
  ];
  it.each(cases)('changes the text into the new text: %s', (_name, before, after) => {
    expect(applyPatches(before, patchesBetween(before, after))).toBe(after);
  });

  it('changes only the lines that differ, and inside them only the characters', () => {
    expect(patchesBetween('# Title\n\nSome text.\n', '# Title\n\nSome test.\n')).toEqual([{ from: 16, to: 17, insert: 's' }]);
    expect(patchesBetween('one\ntwo\nthree\nfour\nfive\n', 'One\ntwo\nthree\nfour\nFive\n')).toEqual([
      { from: 0, to: 1, insert: 'O' },
      { from: 19, to: 20, insert: 'F' },
    ]);
    expect(patchesBetween('a\nb\n', 'a\nb\n')).toEqual([]);
  });

  it('changes texts of many random edits into each other', () => {
    let seed = 7;
    const random = (limit: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % limit;
    };
    const words = ['a', 'b', 'text', '\n', '\n\n', '# ', '- ', ' '];
    for (let round = 0; round < 200; round++) {
      let before = '';
      for (let count = random(40); count > 0; count--) {
        before += words[random(words.length)];
      }
      let after = before;
      for (let count = random(5); count > 0; count--) {
        const at = random(after.length + 1);
        after = after.slice(0, at) + words[random(words.length)] + after.slice(at + random(4));
      }
      expect(applyPatches(before, patchesBetween(before, after))).toBe(after);
    }
  });
});

describe('the positions after a change', () => {
  const patches: TextPatch[] = [
    { from: 2, to: 2, insert: 'xx' },
    { from: 5, to: 8, insert: 'y' },
  ];
  it('moves the positions after each patch and keeps the positions before it', () => {
    expect(mapPosition(1, patches)).toBe(1);
    expect(mapPosition(4, patches)).toBe(6);
    expect(mapPosition(10, patches)).toBe(10);
  });

  it('puts a position at an insertion before or after the new text', () => {
    expect(mapPosition(2, patches, -1)).toBe(2);
    expect(mapPosition(2, patches, 1)).toBe(4);
  });

  it('puts a position in a replaced range at the start or at the end of the new text', () => {
    expect(mapPosition(5, patches, 1)).toBe(7);
    expect(mapPosition(6, patches, -1)).toBe(7);
    expect(mapPosition(6, patches, 1)).toBe(8);
    expect(mapPosition(8, patches, -1)).toBe(8);
  });

  it('refuses patches that do not fit the text', () => {
    expect(() => applyPatches('abc', [{ from: 2, to: 1, insert: '' }])).toThrow(RangeError);
    expect(() => applyPatches('abc', [{ from: 0, to: 4, insert: '' }])).toThrow(RangeError);
    expect(() =>
      applyPatches('abc', [
        { from: 1, to: 2, insert: '' },
        { from: 0, to: 1, insert: '' },
      ]),
    ).toThrow(RangeError);
  });
});

describe('the source of a file', () => {
  it('applies each change with its origin and sends it to every listener', () => {
    const source = new TextSource('Hello world\n');
    const changes: TextChange[] = [];
    source.onChange((change) => changes.push(change));
    const change = source.apply([{ from: 6, to: 11, insert: 'there' }], user);
    expect(source.text).toBe('Hello there\n');
    expect(source.version).toBe(1);
    expect(changes).toEqual([change]);
    expect(change).toMatchObject({ origin: user, before: 'Hello world\n', text: 'Hello there\n', version: 1 });
    // A change without an effect sends nothing.
    expect(source.apply([{ from: 0, to: 5, insert: 'Hello' }], user)).toBeUndefined();
    expect(source.setText('Hello there\n', user)).toBeUndefined();
    expect(changes).toHaveLength(1);
  });

  it('takes a whole new text as the patches of the lines that differ', () => {
    const source = new TextSource('a\nb\nc\n');
    const change = source.setText('a\nB\nc\n', { kind: 'program', name: 'git' });
    expect(change?.patches).toEqual([{ from: 2, to: 3, insert: 'B' }]);
    expect(change?.origin).toEqual({ kind: 'program', name: 'git' });
  });

  it('moves the selections of the other editors with a change, but not those of the editor that makes it', () => {
    const source = new TextSource('abcdef');
    const moved: [string, unknown][] = [];
    source.onSelections((editor, selections) => moved.push([editor, selections]));
    source.setSelections('a', [{ anchor: 4, head: 4 }]);
    source.setSelections('b', [{ anchor: 1, head: 3 }]);
    source.setSelections('c', [{ anchor: 5, head: 5 }]);
    moved.length = 0;
    source.apply([{ from: 0, to: 0, insert: 'XY' }], { kind: 'user', editor: 'a' });
    expect(source.selections('a')).toEqual([{ anchor: 4, head: 4 }]);
    expect(source.selections('b')).toEqual([{ anchor: 3, head: 5 }]);
    expect(moved).toEqual([
      ['b', [{ anchor: 3, head: 5 }]],
      ['c', [{ anchor: 7, head: 7 }]],
    ]);
    // A selection keeps the text that it selects; text at a cursor comes before it.
    source.apply(
      [
        { from: 3, to: 3, insert: '[' },
        { from: 5, to: 5, insert: ']' },
        { from: 7, to: 7, insert: '!' },
      ],
      { kind: 'ai', name: 'agent' },
    );
    expect(source.selections('b')).toEqual([{ anchor: 4, head: 6 }]);
    expect(source.selections('c')).toEqual([{ anchor: 10, head: 10 }]);
    source.removeEditor('b');
    expect(source.editors()).toEqual(['a', 'c']);
  });

  it('sends the changes in their order when a listener changes the text', () => {
    const source = new TextSource('a');
    const seen: string[] = [];
    source.onChange((change) => {
      seen.push(`first ${change.text}`);
      if (change.text === 'ab') {
        source.apply([{ from: 2, to: 2, insert: 'c' }], { kind: 'program', name: 'formatter' });
      }
    });
    source.onChange((change) => seen.push(`second ${change.text}`));
    source.apply([{ from: 1, to: 1, insert: 'b' }], user);
    expect(seen).toEqual(['first ab', 'second ab', 'first abc', 'second abc']);
    expect(source.text).toBe('abc');
  });

  it('calls every listener when one fails, and then gives the error', () => {
    const source = new TextSource('a');
    const seen: string[] = [];
    source.onChange(() => {
      throw new Error('failed');
    });
    source.onChange((change) => seen.push(change.text));
    expect(() => source.apply([{ from: 1, to: 1, insert: 'b' }], user)).toThrow('failed');
    expect(seen).toEqual(['ab']);
    expect(source.text).toBe('ab');
  });

  it('reads and saves its file and takes the changes of the file from outside', async () => {
    let onDisk = 'first\n';
    let watcher: ((text: string) => void) | undefined;
    const file: TextFile = {
      read: () => Promise.resolve(onDisk),
      write: (text) => {
        onDisk = text;
        return Promise.resolve();
      },
      watch: (listener) => {
        watcher = listener;
        return () => (watcher = undefined);
      },
    };
    const source = await TextSource.open(file);
    expect(source.text).toBe('first\n');
    source.apply([{ from: 5, to: 5, insert: '!' }], user);
    expect(source.dirty).toBe(true);
    await source.save();
    expect(onDisk).toBe('first!\n');
    expect(source.dirty).toBe(false);
    const changes: TextChange[] = [];
    source.onChange((change) => changes.push(change));
    watcher?.('changed by git\n');
    expect(source.text).toBe('changed by git\n');
    expect(source.dirty).toBe(false);
    expect(changes[0].origin).toEqual({ kind: 'program', name: 'file' });
    source.dispose();
    expect(watcher).toBeUndefined();
    await expect(new TextSource('x').save()).rejects.toThrow('no file');
  });
});
