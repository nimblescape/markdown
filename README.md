# nimblescape Markdown

An editor of rendered Markdown for the web and for VS Code, as a general
library built on ProseMirror. The user reads
and edits the rendered text; the file stays plain Markdown. nimblescape
Markdown Notes and nimblescape Markdown Paper extend the editor with their
functions through a plugin API.

[docs/specification.md](docs/specification.md) holds the requirements, the
decisions, the open questions and the plan of the steps. The first steps
are built: the npm package and the core, which reads Markdown into the
document of the editor and writes it back. A block that the user does not
change keeps its text byte for byte. The toolbars, the menus and the plugin
API come in the next steps.

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
