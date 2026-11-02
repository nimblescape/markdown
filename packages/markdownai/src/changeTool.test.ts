// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the tool with which the AI proposes a change (docs/ai.md, R-AI-006): the range of a part of the text that
// occurs once, only the words that change, the line breaks of Windows, and the inputs that give no change.

import { describe, expect, it } from 'vitest';
import { changeOf, type RangeChange } from './changeTool';

const text = '# Title\n\nFirst paragraph with **bold** words.\n\nSecond paragraph.\n';

/** applied returns a text after a change. */
function applied(of: string, change: RangeChange): string {
  return of.slice(0, change.from) + change.text + of.slice(change.to);
}

describe('the tool propose_change', () => {
  it('keeps only the words that change', () => {
    const change = changeOf(text, { old_text: 'First paragraph with **bold** words.', new_text: 'First paragraph with **strong** words.' });
    expect(change).toEqual({ from: text.indexOf('bold'), to: text.indexOf('bold') + 4, text: 'strong' });
  });

  it('changes whole words, not the letters inside a word', () => {
    const change = changeOf(text, { old_text: 'Second paragraph.', new_text: 'Second part.' }) as RangeChange;
    expect(text.slice(change.from, change.to)).toBe('paragraph');
    expect(change.text).toBe('part');
    const longer = changeOf(text, { old_text: 'words.', new_text: 'wordsmith.' }) as RangeChange;
    expect(text.slice(longer.from, longer.to)).toBe('words');
    expect(longer.text).toBe('wordsmith');
  });

  it('adds text after the text before it', () => {
    const change = changeOf(text, { old_text: 'Second paragraph.\n', new_text: 'Second paragraph.\n\nThird paragraph.\n' }) as RangeChange;
    expect(change.from).toBe(change.to);
    expect(applied(text, change)).toBe(`${text}\nThird paragraph.\n`);
  });

  it('keeps the line breaks of Windows of the file', () => {
    const windows = text.replace(/\n/g, '\r\n');
    const change = changeOf(windows, { old_text: 'Title\n\nFirst', new_text: 'Title\n\nA new paragraph.\n\nFirst' }) as RangeChange;
    expect(applied(windows, change)).toBe(windows.replace('Title\r\n\r\nFirst', 'Title\r\n\r\nA new paragraph.\r\n\r\nFirst'));
  });

  it('gives a reason for an input that gives no change', () => {
    expect(changeOf(text, { old_text: 'Third', new_text: 'Fourth' })).toEqual({ error: expect.stringContaining('does not occur') });
    expect(changeOf(text, { old_text: 'paragraph', new_text: 'part' })).toEqual({ error: expect.stringContaining('more than once') });
    expect(changeOf(text, { old_text: '', new_text: 'x' })).toEqual({ error: expect.stringContaining('empty') });
    expect(changeOf(text, { old_text: 'Title', new_text: 'Title' })).toEqual({ error: expect.stringContaining('same') });
    expect(changeOf(text, { old_text: 'Title' })).toEqual({ error: expect.stringContaining('needs old_text and new_text') });
    expect(changeOf(text, null)).toEqual({ error: expect.stringContaining('needs old_text and new_text') });
  });

  it('writes the first text of an empty document', () => {
    expect(changeOf('', { old_text: '', new_text: '# Title\n' })).toEqual({ from: 0, to: 0, text: '# Title\n' });
  });
});
