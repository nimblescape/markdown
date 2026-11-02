# nimblescape Markdown

General libraries for text documents, Markdown first, for VS Code and the
web: the source of a file with its changes, editors (first an editor of
rendered Markdown, built on ProseMirror), a renderer, and layouts with pages
and PDF. The file stays plain text. nimblescape Markdown Notes and
nimblescape Markdown Paper extend the libraries with their functions through
a plugin API. The history, which records every action on any file, and its
evaluation are products of their own; their documents stay in this
repository until they have repositories of their own.

[docs/specification.md](docs/specification.md) is the normative
specification: the scope, the architecture, the open questions and the plan
of the steps, with the documents of the parts, for example
[docs/editor.md](docs/editor.md) and [docs/history.md](docs/history.md).
The first steps are built: the npm package and the core, which reads
Markdown into the document of the editor and writes it back. A block that
the user does not change keeps its text byte for byte. The toolbars, the
menus and the plugin API come in the next steps.

## Use

```ts
import { MarkdownEditor } from '@nimblescape/markdown';
import '@nimblescape/markdown/markdown.css';

const editor = new MarkdownEditor(document.querySelector('#editor')!, {
  markdown: '# Title\n\nSome *text*.\n',
  onChange: (changed) => console.log(changed.getMarkdown()),
});
editor.setEditable(false); // read-only mode
```

The package is not on npmjs.com before the release.
[CONTRIBUTING.md](CONTRIBUTING.md) explains the development, the example
page (`npm run demo`) and how another repository installs the package from
GitHub.

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
