// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the context of the document for the AI (docs/ai.md, R-AI-001): the document, the selection, the schema of
// the front matter and the format rules, after the instructions.

import { describe, expect, it } from 'vitest';
import { contextText, defaultInstructions, instructionsOf } from './context';

const text = '---\ntitle: A\n---\n\n# Title\n\nSome `code` and ```` four ```` ticks.\n';

describe('the context of the document', () => {
  it('gives the document in a fence that is longer than its runs of backticks', () => {
    const context = contextText({ document: { name: 'docs/a.md', text } });
    expect(context).toContain('The file `docs/a.md`:');
    expect(context).toContain(`\`\`\`\`\`markdown\n${text}\`\`\`\`\``);
    expect(context).not.toContain('# The selection');
  });

  it('gives the selected text, or the line of the cursor', () => {
    const from = text.indexOf('Some');
    expect(contextText({ document: { name: 'a.md', text }, selection: { from, to: from + 4 } })).toContain('The user selected this text of the document:\n\n```markdown\nSome\n```');
    const windows = text.replace(/\n/g, '\r\n');
    const at = windows.indexOf('Some') + 2;
    expect(contextText({ document: { name: 'a.md', text: windows }, selection: { from: at, to: at } })).toContain(
      'The cursor of the user is in this line of the document:\n\n`````markdown\nSome `code` and ```` four ```` ticks.\n`````',
    );
  });

  it('gives the schema of the front matter and the format rules', () => {
    const context = contextText({ document: { name: 'a.md', text }, frontMatterSchema: { type: 'object', required: ['title'] }, formatRules: ['A note is a footnote.', ' ', 'Citations are links.'] });
    expect(context).toContain('# The schema of the front matter');
    expect(context).toContain('"required": [\n    "title"\n  ]');
    expect(context).toContain('# The format rules\n\nA note is a footnote.\n\nCitations are links.');
  });

  it('puts the instructions before the context', () => {
    const context = { document: { name: 'a.md', text } };
    expect(instructionsOf({ context })).toBe(`${defaultInstructions}\n\n${contextText(context)}`);
    expect(instructionsOf({ instructions: 'Answer in German.', context }).startsWith('Answer in German.\n\n# The document')).toBe(true);
  });
});
