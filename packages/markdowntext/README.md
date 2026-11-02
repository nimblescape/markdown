<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# @nimblescape/markdowntext

The source of nimblescape Markdown: the text of a file without a view
([docs/source.md](../../docs/source.md)). Today the package holds the front
matter at the start of a text, in YAML, TOML or JSON
([R-SRC-003](../../docs/source.md#r-src-003)):

- `frontMatterOf` finds the front matter and its format.
- `readFrontMatter` returns its data.
- `editFrontMatter` changes one value, key or item, so that the comments,
  the order and the quotes of the other keys stay
  ([R-FM-005](../../docs/editor.md#r-fm-005)).
- `checkFrontMatter` checks the data against a JSON schema, draft 2020-12,
  and gives each problem the path of its value and a message in plain words
  ([R-FM-004](../../docs/editor.md#r-fm-004)).

The package needs no page, so that the editor, the renderer, the layout and
the command line use the same code.

```ts
import { checkFrontMatter, editFrontMatter, readFrontMatter } from '@nimblescape/markdowntext';

const text = editFrontMatter('---\ntitle: Old  # the title\n---', 'yaml', { kind: 'set', path: ['title'], value: 'New' });
// '---\ntitle: New  # the title\n---'
const problems = checkFrontMatter(readFrontMatter(text, 'yaml'), { type: 'object', required: ['date'] });
// [{ path: ['date'], message: 'A value is required.' }]
```

The package is not on npmjs.com before the release.
[CONTRIBUTING.md](../../CONTRIBUTING.md) explains how another repository
installs it from GitHub.

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
