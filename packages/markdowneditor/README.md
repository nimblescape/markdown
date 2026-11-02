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
([R-EDIT-002](../../docs/editor.md#r-edit-002)).

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

The package is not on npmjs.com before the release.
[CONTRIBUTING.md](../../CONTRIBUTING.md) explains how another repository
installs it from GitHub.

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
