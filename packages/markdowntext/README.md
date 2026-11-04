<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# @nimblescape/markdowntext

The source of nimblescape Markdown: the text of a file without a view
([docs/source.md](../../docs/source.md)).

`TextSource` holds the text of a file and the selections of its editors
([R-SRC-001](../../docs/source.md#r-src-001)). Each change is a list of text
patches with its origin: a user in an editor, an AI or another program. The
source sends each change to every listener, moves the selections of the
other editors, and reads and saves the file through the object that the
platform gives. `setText` takes a whole new text, for example from Git, and
finds the patches of the lines that differ
([R-SRC-002](../../docs/source.md#r-src-002)).

```ts
import { TextSource } from '@nimblescape/markdowntext';

const source = new TextSource('a\nb\nc\n');
source.onChange((change) => console.log(change.origin.kind, change.patches));
source.setText('a\nB\nc\n', { kind: 'program', name: 'git' });
// program [{ from: 2, to: 3, insert: 'B' }]
```

`mergeTexts` merges two changes of the same text that came at the same
time, for example a change in an editor and a change of the file; where
both change the same characters, the second change stays.

```ts
import { mergeTexts } from '@nimblescape/markdowntext';

mergeTexts('one two three', 'One two three', 'one two Three');
// 'One two Three'
```

The front matter at the start of a text, in YAML, TOML or JSON
([R-SRC-003](../../docs/source.md#r-src-003)):

- `frontMatterOf` finds the front matter and its format.
- `readFrontMatter` returns its data.
- `editFrontMatter` changes one value, key or item, so that the comments,
  the order and the quotes of the other keys stay
  ([R-FM-005](../../docs/editor.md#r-fm-005)).
- `checkFrontMatter` checks the data against a JSON schema, draft 2020-12,
  and gives each problem the path of its value and a message in plain words
  ([R-FM-004](../../docs/editor.md#r-fm-004)).
- `frontMatterValues` returns the values of the keys as the text shows
  them between the markers of `valueMarkers`, for example
  `<wbr><!--{author.name}-->Hannes Stauss<!--{/author.name}-->`, by their
  paths ([R-FM-007](../../docs/editor.md#r-fm-007)), for the editor and
  for formatters.

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
