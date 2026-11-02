# nimblescape Markdown

General libraries for text documents, Markdown first, for VS Code and the
web: the source of a file with its changes, editors (first an editor of
rendered Markdown, built on ProseMirror), a renderer, and layouts with pages
and PDF. The file stays plain text. nimblescape Markdown Notes and
nimblescape Markdown Paper extend the libraries with their functions through
a plugin API. The history, which records every action on any file, is a
product of nimblescape of its own, and the reflection tool builds on it;
their documents stay in this repository until each has a repository of its
own.

[docs/specification.md](docs/specification.md) is the normative
specification: the scope, the architecture, the open questions and the plan
of the steps, with the documents of the parts, for example
[docs/editor.md](docs/editor.md) and [docs/history.md](docs/history.md).
The first steps are built: the npm workspaces; the core, which reads Markdown
into the document of the editor and writes it back, so that a block that the
user does not change keeps its text byte for byte; and the interaction of a
document editor: the toolbar, the format bar over selected text, the insert
menu "+" and the slash commands, the handles of the blocks, find and
replace, read-only mode and a mode that shows the Markdown marks beside the
rendered text; the tables with handles, markers and a table menu; and the
form of the front matter, with a JSON schema, for YAML, TOML and JSON.
VS Code and the plugin API come in the next steps.

## Packages

The repository holds one npm package for each part, as npm workspaces in
`packages/`
([R-ARCH-002](docs/specification.md#r-arch-002)). The other parts get their
packages with their steps of the plan.

| Package | Part |
| --- | --- |
| [`@nimblescape/markdowntext`](packages/markdowntext) | The source: the front matter in YAML, TOML and JSON, its edits and the check against a JSON schema, without a view |
| [`@nimblescape/markdowneditor`](packages/markdowneditor) | The editor of rendered Markdown for the web and for the webviews of VS Code |

## Use

```ts
import { MarkdownEditor } from '@nimblescape/markdowneditor';
import '@nimblescape/markdowneditor/markdown.css';

const editor = new MarkdownEditor(document.querySelector('#editor')!, {
  markdown: '# Title\n\nSome *text*.\n',
  onChange: (changed) => console.log(changed.getMarkdown()),
});
editor.setEditable(false); // read-only mode
editor.setLearnMode(true); // show the Markdown marks
editor.setFrontMatterSchema({ type: 'object', required: ['title'] }); // the schema of the form of the front matter
```

The options `toolbar`, `readOnlyToggle` and `learnToggle` leave out the
toolbar or its switches, and `learnMode` starts the editor with the
Markdown marks shown.

The packages are not on npmjs.com before the release.
[CONTRIBUTING.md](CONTRIBUTING.md) explains the development, the example
page (`npm run demo`) and how another repository installs the packages from
GitHub.

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
