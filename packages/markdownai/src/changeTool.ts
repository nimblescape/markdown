// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tool with which the AI proposes a change of the text (docs/ai.md, R-AI-001, R-AI-006): as the tool to edit a file
// of Claude Code, the AI gives a part of the text that occurs once in the document and its new text, not the places in
// the text, which an AI counts badly. changeOf finds the range of that part in the text of the file and keeps only the
// words that change, so that a change of some words of a paragraph shows in the line.

import type { AiTool } from './provider';

/** proposeChangeTool is the tool with which the AI proposes a change of the document. */
export const proposeChangeTool: AiTool = {
  name: 'propose_change',
  description: [
    'Proposes a change of the text of the document to the user, who accepts or rejects it; the result says which.',
    'old_text is a part of the text of the document, exactly as the document has it, that occurs only once in the',
    'document: give enough text around the change to make it unique. new_text replaces it. To add text, give the text',
    'before the new text as old_text and repeat it at the start of new_text. Propose one change for each place.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      old_text: { type: 'string', description: 'The text of the document that the change replaces; it occurs once in the document.' },
      new_text: { type: 'string', description: 'The new text, Markdown.' },
    },
    required: ['old_text', 'new_text'],
    additionalProperties: false,
  },
};

/** RangeChange is a change of a range of the text of the file, as the source counts the text. */
export interface RangeChange {
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

/** ChangeOf is the change of an input of the tool, or why the input gives no change. */
export type ChangeOf = RangeChange | { readonly error: string };

/** word is a character of a word. */
const word = /[\p{L}\p{N}_]/u;

/**
 * withLineBreaks returns a text with the line breaks of a file: CRLF when the file has CRLF.
 * @param text - The text of the AI, with LF or CRLF.
 * @param file - The text of the file.
 */
function withLineBreaks(text: string, file: string): string {
  return file.includes('\r\n') ? text.replace(/\r?\n/g, '\r\n') : text;
}

/**
 * count returns how often a text occurs in a text, up to two.
 * @param text - The text.
 * @param part - The part.
 */
function count(text: string, part: string): number {
  const first = text.indexOf(part);
  return first < 0 ? 0 : text.indexOf(part, first + 1) < 0 ? 1 : 2;
}

/**
 * changeOf returns the change of the text of a file that an input of the tool `propose_change` proposes: only the words
 * that change, between the common start and the common end of the old and the new text.
 * @param file - The text of the file.
 * @param input - The input of the tool.
 */
export function changeOf(file: string, input: unknown): ChangeOf {
  const value = (input ?? {}) as { old_text?: unknown; new_text?: unknown };
  if (typeof value.old_text !== 'string' || typeof value.new_text !== 'string') {
    return { error: 'The input needs old_text and new_text, both texts.' };
  }
  const old = withLineBreaks(value.old_text, file);
  const replacement = withLineBreaks(value.new_text, file);
  if (old === '') {
    return file === '' ? { from: 0, to: 0, text: replacement } : { error: 'old_text is empty; give a part of the text of the document.' };
  }
  const found = count(file, old);
  if (found === 0) {
    return { error: 'old_text does not occur in the document. Give the text exactly as the document has it, with its marks and line breaks.' };
  }
  if (found > 1) {
    return { error: 'old_text occurs more than once in the document. Give more text around the change, so that it occurs once.' };
  }
  if (old === replacement) {
    return { error: 'new_text is the same as old_text.' };
  }
  const at = file.indexOf(old);
  // The common start and end, at the edges of words, so that a change of a word shows the whole word.
  let start = 0;
  while (start < old.length && start < replacement.length && old[start] === replacement[start]) {
    start++;
  }
  while (start > 0 && word.test(old[start - 1]) && (word.test(old[start] ?? '') || word.test(replacement[start] ?? ''))) {
    start--;
  }
  let end = 0;
  while (end < old.length - start && end < replacement.length - start && old[old.length - 1 - end] === replacement[replacement.length - 1 - end]) {
    end++;
  }
  while (end > 0 && word.test(old[old.length - end]) && (word.test(old[old.length - 1 - end] ?? '') || word.test(replacement[replacement.length - 1 - end] ?? ''))) {
    end--;
  }
  return { from: at + start, to: at + old.length - end, text: replacement.slice(start, replacement.length - end) };
}
