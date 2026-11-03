// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The context of the document for the AI (docs/ai.md, R-AI-001): a provider gives the AI the instructions of the
// integrating code with the document, the selection, the schema of the front matter and the format rules of the active
// plugins, in the text that instructionsOf makes, so that every provider gives the AI the same context.

import type { AiContext, AiRequest } from './provider';

/** defaultInstructions are the instructions when the integrating code gives none. */
export const defaultInstructions = [
  'You are the AI of an editor of a text document. The user works on the document below and talks with you in a chat.',
  'You change the document only with the tool propose_change: the user accepts or rejects each change, and nothing',
  'changes the document before the user accepts it. Keep the format of the document, the format rules below and the',
  'language of the document.',
].join(' ');

/**
 * fenced returns a text in a fenced code block whose fence is longer than each run of backticks in the text.
 * @param text - The text.
 * @param language - The language of the block.
 */
function fenced(text: string, language: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${text}${text.endsWith('\n') ? '' : '\n'}${fence}`;
}

/**
 * selectionText describes the selection of the user: the selected text, or the line of the cursor.
 * @param context - The context.
 */
function selectionText(context: AiContext): string | undefined {
  const { selection, document } = context;
  if (!selection) {
    return undefined;
  }
  const from = Math.max(0, Math.min(selection.from, selection.to, document.text.length));
  const to = Math.min(document.text.length, Math.max(selection.from, selection.to));
  if (from < to) {
    return `The user selected this text of the document:\n\n${fenced(document.text.slice(from, to), 'markdown')}`;
  }
  const start = document.text.lastIndexOf('\n', from - 1) + 1;
  const end = document.text.indexOf('\n', from);
  const line = document.text.slice(start, end < 0 ? undefined : end).replace(/\r$/, '');
  return `The cursor of the user is in this line of the document:\n\n${fenced(line, 'markdown')}`;
}

/**
 * contextText returns the context of the document as text for the AI.
 * @param context - The context.
 */
export function contextText(context: AiContext): string {
  const parts = [`# The document\n\nThe file \`${context.document.name}\`:\n\n${fenced(context.document.text, 'markdown')}`];
  const selection = selectionText(context);
  if (selection) {
    parts.push(`# The selection\n\n${selection}`);
  }
  if (context.frontMatterSchema !== undefined) {
    parts.push(`# The schema of the front matter\n\nThe front matter of the document follows this JSON schema:\n\n${fenced(JSON.stringify(context.frontMatterSchema, null, 2), 'json')}`);
  }
  const rules = (context.formatRules ?? []).map((rule) => rule.trim()).filter((rule) => rule !== '');
  if (rules.length > 0) {
    parts.push(`# The format rules\n\n${rules.join('\n\n')}`);
  }
  return parts.join('\n\n');
}

/**
 * instructionsOf returns the instructions of a request with the context of the document, the text that a provider
 * gives the AI as its instructions, for example as the system prompt.
 * @param request - The request.
 */
export function instructionsOf(request: Pick<AiRequest, 'instructions' | 'context'>): string {
  return `${request.instructions ?? defaultInstructions}\n\n${contextText(request.context)}`;
}
