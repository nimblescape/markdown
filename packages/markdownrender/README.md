<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# @nimblescape/markdownrender

The renderer of nimblescape Markdown: the text of a file as HTML without edit
functions ([docs/rendering.md](../../docs/rendering.md)). It uses
markdown-it 14, the version of the Markdown preview of VS Code, with
footnotes and task lists ([R-REN-001](../../docs/rendering.md#r-ren-001)).
It runs without the editor and without a page, for example in a command
line ([R-REN-003](../../docs/rendering.md#r-ren-003)). The editor
[`@nimblescape/markdowneditor`](../markdowneditor) is built on it: it reads
the text with the same markdown-it, shows its rendered blocks with this
renderer, and has the same styles of rendered content
([R-GEN-010](../../docs/specification.md#r-gen-010)).

```ts
import { MarkdownRenderer } from '@nimblescape/markdownrender';

const renderer = new MarkdownRenderer();
const { html } = renderer.toHtml('---\ntitle: A\n---\n\n# Title\n\n> [!NOTE]\n> A note.\n');
// <h1 id="title" data-line="4">Title</h1>
// <div class="markdown-alert markdown-alert-note" data-line="6">
// <p class="markdown-alert-title">Note</p>
// <p data-line="7">A note.</p>
// </div>
```

The HTML is the HTML that GitHub writes where GitHub has one: GitHub alerts,
the IDs of the headings, task lists and footnotes at the end. The front
matter is no part of the rendering, and each block names its line in the
file (`data-line`). The comments of the tables of the editor show as the
editor shows them: the color of a cell and the widths of the columns. Raw
HTML of the file shows safely by default: comments do not show, a fixed list
of elements without attributes and the anchors `<a id="…">` show as HTML, and
any other raw HTML shows as its text. The option `rawHtml: 'text'` shows all
raw HTML as its text; the way `trusted` is only for the test against the
CommonMark specification. A code block with a language gets the syntax colors of
the editor, the classes `hljs-*` of highlight.js; the option
`syntaxColors: false` leaves them out.

## Plugins

A plugin of the renderer adds syntax with `extendMarkdownIt(md)`, as in
VS Code, so that a markdown-it plugin works in VS Code and in the renderer
without a change ([R-REN-002](../../docs/rendering.md#r-ren-002)). It may
add styles, and a function `render(source, element, token)` for each kind of
token that it shows in a page. Without a page, the token shows with the HTML
of its rule of markdown-it. A plugin of the editor is a plugin of the
renderer with more members, so the same object works in both.

```ts
import { MarkdownRenderer, type RenderPlugin } from '@nimblescape/markdownrender';

const diagrams: RenderPlugin = {
  name: 'diagrams',
  apiVersion: 1,
  render: { 'fence:mermaid': (source, element) => drawDiagram(source, element) },
};

const renderer = new MarkdownRenderer({ plugins: [diagrams] });
const dispose = renderer.render(text, document.querySelector('#rendering')!);
```

A plugin that works in the markdown-it of another program, for example in
the Markdown preview of VS Code, gives that rendering the output of the
renderer: `addOutputRules(md)` adds the rules of the title of an alert and
of the widths of the columns of a table, and `prepareOutput(tokens)` turns
the tokens of a rendering into the output of the renderer, with the GitHub
alerts, the colors of the cells and the widths of the columns.

```ts
import { addOutputRules, prepareOutput } from '@nimblescape/markdownrender';

addOutputRules(md);
md.core.ruler.push('output', (state) => prepareOutput(state.tokens, { headingIds: false, lines: false }));
```

The element of a rendering gets the styles of rendered content from
`content.css` with the classes `nsmd-document nsmd-content`:

```ts
import '@nimblescape/markdownrender/content.css';
```

The package is not on npmjs.com before the release.
[CONTRIBUTING.md](../../CONTRIBUTING.md) explains how another repository
installs it from GitHub.

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
