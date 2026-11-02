<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# @nimblescape/markdowneditor

The editor of rendered Markdown of nimblescape Markdown, for the web and for
the webviews of VS Code, built on ProseMirror through Tiptap 3
([docs/editor.md](../../docs/editor.md)). A block of the file that the user
does not change keeps its text byte for byte. The editor has a toolbar, a
format bar over selected text, an insert menu and slash commands, handles of
the blocks, find and replace, tables with handles and a table menu, a
read-only mode, a mode that shows the Markdown marks beside the rendered
text, and a form of the front matter with a JSON schema. The front matter
code comes from [`@nimblescape/markdowntext`](../markdowntext). With the
option `source`, the editor is one of several editors of a file: it gives
each change of the user to the `TextSource` and shows each change from
another editor or from outside, with only the blocks whose text changed
([R-EDIT-002](../../docs/editor.md#r-edit-002)). The editor is built on the
renderer [`@nimblescape/markdownrender`](../markdownrender): it reads the
text with the markdown-it of the renderer, shows the blocks of plugins with
the renderer, and `markdown.css` holds the styles of rendered content of the
renderer, so that the editor and a rendering look the same
([R-GEN-010](../../docs/specification.md#r-gen-010)).

```ts
import { MarkdownEditor } from '@nimblescape/markdowneditor';
import type { JsonSchema } from '@nimblescape/markdowntext';
import '@nimblescape/markdowneditor/markdown.css';

const schema: JsonSchema = { type: 'object', required: ['title'] };
const editor = new MarkdownEditor(document.querySelector('#editor')!, {
  markdown: '# Title\n\nSome *text*.\n',
  frontMatterSchema: schema,
  onChange: (changed) => console.log(changed.getMarkdown()),
});
editor.setEditable(false); // read-only mode
editor.setLearnMode(true); // show the Markdown marks
```

The editor adds style elements to the page: the base styles of Tiptap and
the styles of the plugins. A page whose policy allows only style elements
with a nonce gives this nonce in the option `styleNonce`
([R-PLAT-001](../../docs/platforms.md#r-plat-001)).

## Plugins

Plugins extend the editor through the plugin API, version 1
([docs/plugins.md](../../docs/plugins.md),
[R-PLUGIN-001](../../docs/plugins.md#r-plugin-001)). A plugin is one object.
At the level "render", it adds syntax to markdown-it and shows its kinds of
tokens; the editor keeps such a block byte for byte as one unit, and the
user changes it through its source ("Edit source" or a double click). At the
level "render and edit", it adds nodes and marks, how they are read and
written, commands, keys and items of the menus. A plugin may mark the parts
that it generates as read-only and show threads beside the text.

```ts
import { MarkdownEditor, type MarkdownPlugin } from '@nimblescape/markdowneditor';

const diagrams: MarkdownPlugin = {
  name: 'diagrams',
  apiVersion: 1,
  // A fenced code block with the language `mermaid` shows as a diagram.
  render: { 'fence:mermaid': (source, element) => drawDiagram(source, element) },
  // The citations, links to `#ref-…`, are generated and read-only.
  generated: (doc) => citationsOf(doc),
  threads: { find: (doc) => notesOf(doc), open: (thread, panel) => showThread(thread, panel) },
};

const editor = new MarkdownEditor(element, { markdown, plugins: [diagrams], host: { platform: 'web' } });
editor.runCommand('diagrams.someCommand');
```

The example page of the repository uses the plugin
[demo/examplePlugin.ts](../../demo/examplePlugin.ts).

The package is not on npmjs.com before the release.
[CONTRIBUTING.md](../../CONTRIBUTING.md) explains how another repository
installs it from GitHub.

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
