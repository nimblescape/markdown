// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The example page of the editor (npm run demo): two editors of one source (docs/editor.md, R-EDIT-002), the rendered
// editor on the left and the Markdown text in a text field on the right. A change in either editor shows at once in the
// other one: the text field takes the patches of each change, so that its cursor stays, and the rendered editor changes
// only the blocks whose text changed (docs/source.md, R-SRC-002). The head of the page shows the origin of the last
// change and the selection of the rendered editor in the text. The toolbar of the editor switches the read-only mode
// and the mode to learn Markdown. The front matter shows as a form with the example schema below; "Edit keys" switches
// the form to the edit of the keys. The example plugin (examplePlugin.ts) shows the plugin API: a CSV table at the level
// "render", a read-only citation and a thread beside the text. The button "Rendering" shows the rendering of the
// renderer (docs/rendering.md, R-REN-001) in place of the text field: the same text as HTML without edit functions,
// with the same plugin, which follows each change.

import { MarkdownEditor } from '@nimblescape/markdowneditor';
import { MarkdownRenderer } from '@nimblescape/markdownrender';
import { TextSource, type JsonSchema, type TextChange } from '@nimblescape/markdowntext';
import { examplePlugin } from './examplePlugin';

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

## The example plugin

A CSV table that a plugin shows. Double click it to change its text:

\`\`\`csv
Name, Value
a, 1
b, 2
\`\`\`

A citation that a plugin generates, so it is read-only: as [Levitt, 1972](#ref-levitt-1972) wrote.

TODO: this paragraph has a thread. Its icon is at the right of the text.

[^1]: The text of the footnote.
`;

const textArea = document.querySelector<HTMLTextAreaElement>('#markdown');
const element = document.querySelector<HTMLElement>('#editor');
const status = document.querySelector<HTMLOutputElement>('#status');
const rendering = document.querySelector<HTMLElement>('#rendering');
const showText = document.querySelector<HTMLButtonElement>('#show-text');
const showRendering = document.querySelector<HTMLButtonElement>('#show-rendering');
if (!textArea || !element || !status || !rendering || !showText || !showRendering) {
  throw new Error('The example page misses an element.');
}

/** source is the source of the example file, which both editors share. */
const source = new TextSource(sample);
const plugin = examplePlugin();
const editor = new MarkdownEditor(element, { source, id: 'rendered', frontMatterSchema: schema, plugins: [plugin] });

// The text field is the second editor of the source: each input becomes a change of the user, and each change from the
// rendered editor becomes the patches of the text field, from its end, so that the positions before each patch stay.
textArea.value = source.text;
textArea.addEventListener('input', () => source.setText(textArea.value, { kind: 'user', editor: 'text' }));
for (const event of ['select', 'keyup', 'mouseup']) {
  textArea.addEventListener(event, () => source.setSelections('text', [{ anchor: textArea.selectionStart, head: textArea.selectionEnd }]));
}
source.onChange((change: TextChange) => {
  if (change.origin.editor !== 'text') {
    for (const patch of [...change.patches].reverse()) {
      textArea.setRangeText(patch.insert, patch.from, patch.to, 'preserve');
    }
  }
});

/** showStatus shows the version of the text, the origin of the last change and the selection of the rendered editor. */
let last = 'none';
const showStatus = () => {
  const [selection] = source.selections(editor.id);
  const range = selection ? `${Math.min(selection.anchor, selection.head)} to ${Math.max(selection.anchor, selection.head)}` : 'none';
  status.value = `Version ${source.version} · last change: ${last} · selection of the rendered editor in the text: ${range}`;
};
source.onChange((change) => {
  last = `${change.origin.kind}${change.origin.editor ? ` in ${change.origin.editor}` : ''}`;
  showStatus();
});
source.onSelections(showStatus);
showStatus();

// The rendering of the renderer: the renderer has the same plugin as the editor, and shows the text again 150 ms after
// a change, while the rendering shows.
const renderer = new MarkdownRenderer({ plugins: [plugin] });
let stopRendering: () => void = () => undefined;
let renderTimer: ReturnType<typeof setTimeout> | undefined;
const render = () => {
  stopRendering();
  stopRendering = renderer.render(source.text, rendering);
};
const show = (text: boolean) => {
  textArea.hidden = !text;
  rendering.hidden = text;
  showText.setAttribute('aria-pressed', String(text));
  showRendering.setAttribute('aria-pressed', String(!text));
  if (!text) {
    render();
  }
};
showText.addEventListener('click', () => show(true));
showRendering.addEventListener('click', () => show(false));
source.onChange(() => {
  if (!rendering.hidden) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 150);
  }
});
