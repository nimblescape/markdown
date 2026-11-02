// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The example page of the editor (npm run demo): the editor on the left, the Markdown text that it writes on the
// right. A change in the editor shows at once in the text; "Load the text" shows the text of the right side in the
// editor. The toolbar of the editor switches the read-only mode and the mode to learn Markdown. The front matter shows
// as a form with the example schema below; "Edit keys" switches the form to the edit of the keys.

import { MarkdownEditor, type JsonSchema } from '../src/index';

/** schema is an example schema of a front matter (docs/editor.md, R-FM-004). */
const schema: JsonSchema = {
  type: 'object',
  required: ['title'],
  properties: {
    title: { type: 'string', title: 'Title' },
    date: { type: 'string', format: 'date', title: 'Date' },
    lang: { enum: ['en', 'de'], title: 'Language', description: 'The language of the document' },
    tags: { type: 'array', items: { type: 'string' }, title: 'Tags' },
    draft: { type: 'boolean', title: 'Draft' },
    pages: { type: 'integer', minimum: 1, title: 'Pages' },
  },
};

const sample = `---
title: An example  # the title
date: 2026-11-02
lang: en
tags:
- editor
- markdown
---

# nimblescape Markdown

A paragraph with **bold**, *italic*, <ins>underline</ins>, ~~strikethrough~~, \`code\` and a [link](https://github.com/nimblescape/markdown).

Select some text for the format bar, type \`/\` for the slash commands, or move the mouse left of a block for its handles.

> [!NOTE]
> Blocks that you do not change stay as the file has them,
> also these two lines.

> [!TIP]
> A button of the toolbar shows the Markdown marks beside the text.

- [ ] a task
- [x] a finished task

<!-- table: widths=60,40 -->
| Column | Value |
|:-------|------:|
| a      |     1 |
| <!--cell yellow--> b |     2 |
| c      |    10 |

\`\`\`ts
const editor = new MarkdownEditor(element, { markdown });
\`\`\`

A footnote.[^1]

[^1]: The text of the footnote.
`;

const textArea = document.querySelector<HTMLTextAreaElement>('#markdown');
const element = document.querySelector<HTMLElement>('#editor');
const load = document.querySelector<HTMLButtonElement>('#load');
if (!textArea || !element || !load) {
  throw new Error('The example page misses an element.');
}
textArea.value = sample;
const editor = new MarkdownEditor(element, { markdown: sample, frontMatterSchema: schema, onChange: (changed) => (textArea.value = changed.getMarkdown()) });
load.addEventListener('click', () => editor.setMarkdown(textArea.value));
