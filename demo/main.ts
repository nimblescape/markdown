// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The example page of the editor (npm run demo): the editor on the left, the Markdown text that it writes on the
// right. A change in the editor shows at once in the text; "Load the text" shows the text of the right side in the
// editor; "Edit" switches the read-only mode.

import { MarkdownEditor } from '../src/index';

const sample = `---
title: An example
---

# nimblescape Markdown

A paragraph with **bold**, *italic*, ~~strikethrough~~, \`code\` and a [link](https://github.com/nimblescape/markdown).

> [!NOTE]
> Blocks that you do not change stay as the file has them,
> also these two lines.

- [ ] a task
- [x] a finished task

| Column | Value |
|:-------|------:|
| a      |     1 |
| b      |     2 |

\`\`\`ts
const editor = new MarkdownEditor(element, { markdown });
\`\`\`

A footnote.[^1]

[^1]: The text of the footnote.
`;

const textArea = document.querySelector<HTMLTextAreaElement>('#markdown');
const element = document.querySelector<HTMLElement>('#editor');
const editable = document.querySelector<HTMLInputElement>('#editable');
const load = document.querySelector<HTMLButtonElement>('#load');
if (!textArea || !element || !editable || !load) {
  throw new Error('The example page misses an element.');
}
textArea.value = sample;
const editor = new MarkdownEditor(element, { markdown: sample, onChange: (changed) => (textArea.value = changed.getMarkdown()) });
editable.addEventListener('change', () => editor.setEditable(editable.checked));
load.addEventListener('click', () => editor.setMarkdown(textArea.value));
