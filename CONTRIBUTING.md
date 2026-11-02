<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Contributing

This guide explains the files, the development, the tests and the use of the
npm packages of nimblescape Markdown before their release.
[docs/specification.md](docs/specification.md) is the normative
specification: what the libraries must, should and may do, each requirement
with an ID, the open questions and the plan of the steps. It gives the scope
and the architecture, and its section "Documents" lists the documents of
the parts, for example [docs/editor.md](docs/editor.md),
[docs/history.md](docs/history.md) and, for the reflection tool, which
builds on the history, [docs/reflection.md](docs/reflection.md). A
requirement is the
clean summary of a decision, without the texts of the discussion. A change
of a feature updates its requirement, in the document of its part, in the
same pull request.

## Files

| File | Purpose |
| --- | --- |
| `packages/` | The npm workspaces: one npm package for each part ([R-ARCH-002](docs/specification.md#r-arch-002)). Each package has its `package.json`, `src/`, `README.md`, `LICENSE` and `tsconfig.build.json`, and its build writes `dist/`. |
| `packages/markdowntext/src/index.ts` | The exports of `@nimblescape/markdowntext`, the source. |
| `packages/markdowntext/src/frontMatter/detect.ts` | The front matter at the start of a file, in YAML, TOML or JSON ([R-SRC-003](docs/source.md#r-src-003)). |
| `packages/markdowntext/src/frontMatter/edit.ts`, `packages/markdowntext/src/frontMatter/yaml.ts`, `packages/markdowntext/src/frontMatter/json.ts`, `packages/markdowntext/src/frontMatter/types.ts` | The reading and the edits of a front matter in YAML, TOML and JSON ([R-FM-005](docs/editor.md#r-fm-005)): each edit changes only the text of the edited value, so that the comments, the order and the quotes of the other keys stay. |
| `packages/markdowntext/src/frontMatter/schema.ts` | The check of a front matter against its JSON schema, with the path of each problem and a message in plain words, and the schema of a value ([R-FM-004](docs/editor.md#r-fm-004)). |
| `packages/markdowneditor/src/index.ts` | The exports of `@nimblescape/markdowneditor`, the editor. |
| `packages/markdowneditor/src/editor.ts` | `MarkdownEditor`: the editor on a DOM element, with its Markdown text in and out, the read-only mode ([R-GEN-008](docs/editor.md#r-gen-008)), the mode to learn Markdown ([R-GEN-013](docs/editor.md#r-gen-013)) and the event of a change. |
| `packages/markdowneditor/src/extensions/core.ts` | The Tiptap extensions of the document: the nodes and marks of CommonMark and GFM, footnotes, the front matter, which stays the first block, and the raw nodes for HTML and for text that no block of Markdown holds. Attributes that record the form of the Markdown text, such as the bullet of a list, let a changed block keep its form. |
| `packages/markdowneditor/src/markdown/markdownIt.ts` | The markdown-it of the editor: HTML, links in the text, footnotes and task lists, and the markdown-it plugins of the extensions ([R-GEN-012](docs/plugins.md#r-gen-012)). |
| `packages/markdowneditor/src/markdown/parse.ts` | The Markdown text into the document of the editor, by the tokens of markdown-it and `prosemirror-markdown`. It keeps the text of each top-level block and the blank lines between the blocks. |
| `packages/markdowneditor/src/markdown/serialize.ts` | The document back into Markdown text ([R-EDIT-004](docs/editor.md#r-edit-004), [R-EDIT-005](docs/editor.md#r-edit-005)): each block that the user did not change keeps its text byte for byte; a changed block is written new, in the form of the formatter of nimblescape Markdown Notes. |
| `packages/markdowneditor/src/markdown/tableComments.ts` | The comments of the tables for what GFM cannot store: the color of a cell and the widths of the columns ([R-EDIT-010](docs/editor.md#r-edit-010)). |
| `packages/markdowneditor/src/markdown/escape.ts` | The backslashes of a changed block: only before characters that would otherwise start Markdown syntax. |
| `packages/markdowneditor/src/markdown/codec.ts` | `MarkdownCodec`: the parser and the serializer with one schema and one markdown-it, for the editor and for code without a page. |
| `packages/markdowneditor/src/ui/interaction.ts` | The interaction of a document editor ([R-GEN-003](docs/editor.md#r-gen-003)): it puts the parts below around the text and gives the editor their plugins and keys as one Tiptap extension. |
| `packages/markdowneditor/src/ui/toolbar.ts`, `packages/markdowneditor/src/ui/formatBar.ts` | The toolbar at the top of the editor, and the format bar over selected text ([R-EDIT-007](docs/editor.md#r-edit-007)) with the buttons of extensions. |
| `packages/markdowneditor/src/ui/menu.ts`, `packages/markdowneditor/src/ui/items.ts`, `packages/markdowneditor/src/ui/slash.ts` | The menu of the editor, the items of the insert menu "+", of the slash commands and of the text styles, and the plugin of the slash commands. |
| `packages/markdowneditor/src/ui/blockHandle.ts` | The "+" and the handle beside the block under the mouse: insert, drag and drop, move up and down, duplicate, delete. |
| `packages/markdowneditor/src/ui/find.ts`, `packages/markdowneditor/src/ui/findBar.ts` | The plugin and the bar of find and replace. |
| `packages/markdowneditor/src/ui/learnMode.ts` | The mode to learn Markdown: the marks of the file beside the rendered text, as widgets that are not text of the document. |
| `packages/markdowneditor/src/ui/frontMatterForm.ts` | The form of the front matter ([R-FM-001](docs/editor.md#r-fm-001) to [R-FM-006](docs/editor.md#r-fm-006)): fixed keys and the edit of the keys, the problems of the schema, the inputs of plugins, and the text of a front matter that does not parse. |
| `packages/markdowneditor/src/ui/alerts.ts` | The GitHub alerts, `> [!NOTE]`, with the name of their kind in place of the marker. |
| `packages/markdowneditor/src/ui/table/grid.ts` | The commands of the tables ([R-EDIT-009](docs/editor.md#r-edit-009)): insert, move, delete, sort, align and color rows, columns and cells, and the widths of the columns. |
| `packages/markdowneditor/src/ui/table/tableHandles.ts`, `packages/markdowneditor/src/ui/table/tables.ts` | The handles and the markers "+" of the rows and the columns, the table menu ([R-EDIT-008](docs/editor.md#r-edit-008)), and the view of the widths of the columns from their comment ([R-EDIT-010](docs/editor.md#r-edit-010)). |
| `packages/markdowneditor/src/ui/ask.ts`, `packages/markdowneditor/src/ui/dom.ts` | The field that asks for one text, for example the address of a link, and the helpers for elements, buttons and icons. |
| `packages/markdowneditor/src/styles/markdown.css` | The styles of the editor, with the tokens `--nsmd-*` of the theme ([R-THEME-001](docs/platforms.md#r-theme-001)). |
| `packages/markdowneditor/src/types/` | The types of the packages without types of their own. |
| `packages/*/src/**/*.test.ts` | The unit tests, with vitest: the edits and the schema of the front matter (`packages/markdowntext/src/frontMatter/*.test.ts`), the round trip of the Markdown (`packages/markdowneditor/src/markdown/codec.test.ts`), and the editor, its interaction, its tables and the form of the front matter in a page of happy-dom (`editor.test.ts`, `ui/interaction.test.ts`, `ui/table/grid.test.ts` and `ui/frontMatterForm.test.ts` in `packages/markdowneditor/src/`). |
| `test/corpus/` | The Markdown files of the tests of the round trip: GFM, the front matter in TOML and JSON, the format of Markdown Notes and the documents and layouts of Markdown Paper. [test/corpus/README.md](test/corpus/README.md) explains them. |
| `demo/index.html`, `demo/main.ts` | The example page: the editor on the left and its Markdown text on the right. |
| `licenses.json` | The license that was decided for each package that the packages of the workspaces need at run time ([R-GEN-011](docs/specification.md#r-gen-011)). |
| `scripts/check-licenses.mjs`, `scripts/check-licenses.test.mjs` | The check of `package-lock.json` against `licenses.json` and its test. |
| `scripts/third-party-notices.mjs` | Writes the notices of the packages of a bundle from the installed packages, for the example page. |
| `esbuild.mjs` | In the folder of a package, builds its `dist/index.js` and a `dist/<name>.css` for each file of `src/styles/`; in the root, with `--demo` or `--serve`, builds the example page in `demo/dist/` from the sources of the packages. |
| `tsconfig.json`, `packages/*/tsconfig.build.json` | The settings of the type check of all packages, and of the declarations of each package in its `dist/`. |
| `eslint.config.mjs`, `vitest.config.mts` | The settings of the check of the code style and of the unit tests. |
| `package.json` | The manifest of the root of the workspaces: private, never published, with the development tools and the commands below. Each package has its own manifest with its libraries. |
| `package-lock.json` | The locked libraries and development tools. npm writes this file, and nobody edits it by hand. |
| `.node-version` | The Node release of the development tools. `actions/setup-node` in the workflows and local Node version managers read it. |
| `.github/workflows/ci.yml` | Checks the types, the code style and the licenses, runs the tests, builds the packages and the example page, and packs the npm packages, for every push to `main` and every pull request. It publishes nothing. |
| `.github/dependabot.yml` | Proposes weekly updates of the libraries, of the development tools and of the pinned actions. |
| `packages/*/dist/`, `demo/dist/` | The built packages and the built example page, kept out of Git. |

## Development

The development tools are TypeScript, esbuild, ESLint and vitest, on the
Node.js release in `.node-version`.

| Command | Effect |
| --- | --- |
| `npm ci --ignore-scripts` | Installs the locked libraries and development tools and runs no install script of a dependency. |
| `npm run typecheck` | Checks the types with `tsc`. esbuild does not check them. |
| `npm run lint` | Checks the code style with ESLint. |
| `npm run licenses` | Checks the license of each package that the packages of the workspaces need at run time against `licenses.json`. `npm run licenses -- --write` adds a new package with its license to `licenses.json`; the pull request then shows the new decision. |
| `npm test` | Runs the unit tests with vitest. |
| `npm run build` | Builds each package in the order of the workspaces in `package.json`, `@nimblescape/markdowntext` first: its `dist/index.js`, its styles and its declarations `dist/**/*.d.ts`. `npm run build -w packages/markdowntext` builds one package. |
| `npm run demo` | Builds the example page and serves it on <http://localhost:8000>; it builds again after each change. `node esbuild.mjs --demo` only builds it. |
| `npm run pack` | Packs each package from its `dist/` into `nimblescape-<name>-<version>.tgz` in the root, after `npm run build`. |

## Packages

Each part of the libraries is one npm package in `packages/<name>/`
([R-ARCH-002](docs/specification.md#r-arch-002)). A package uses another
package of the workspaces by its npm name, for example
`import { readFrontMatter } from '@nimblescape/markdowntext'`, never by a
path to its files, and it lists that package in the `dependencies` of its
manifest. npm links the packages of the workspaces into `node_modules/`.
Each package exports only its own API: a type of another package that its
API uses comes from that package.

The exports of each manifest have the condition `nimblescape-source`, which
points to `src/index.ts`. The type check (`customConditions` in
`tsconfig.json`), the tests (`resolve.conditions` in `vitest.config.mts`)
and the example page (`conditions` in `esbuild.mjs`) use it, so that they
read the sources of the other packages and need no build. The build of a
package does not use it: the declarations of a package refer to the built
declarations of the packages that it depends on, so `npm run build` builds
the packages in the order of their dependencies. The packed package keeps
the condition, but `src/` is not in it, and only this repository uses the
condition.

A new package gets its folder with a `package.json` in the form of the
others, a `tsconfig.build.json`, a `README.md` and a `LICENSE`, and its place
in `workspaces` of the root `package.json`, after the packages that it
depends on.

## The round trip of the Markdown

The editor changes only the text of the blocks that the user changes
([R-EDIT-004](docs/editor.md#r-edit-004)). The parser keeps the text of
each top-level block and the lines between the blocks; the serializer writes
each block that is still the same node of the document with this text, and
writes a changed block new. The tests check three things
([R-EDIT-006](docs/editor.md#r-edit-006)):

- Every example of the CommonMark specification (package `commonmark-spec`,
  a development tool only) and every file of `test/corpus/` comes back byte
  for byte when nothing changed.
- Written new, each example and each file shows the same HTML in markdown-it.
  `knownDifferences` in `packages/markdowneditor/src/markdown/codec.test.ts`
  lists the examples that
  the document cannot hold, with the reason, for example emphasis in
  emphasis.
- A change of one block changes only the text of that block.

A new form of Markdown that the editor must keep, for example of a plugin,
gets a file in `test/corpus/`.

## The npm packages before the release

Nothing is published before the release
([R-GEN-007](docs/specification.md#r-gen-007)): no version of a package on
npmjs.com and no release tag. Each package holds `dist/index.js`, an ES
module for browsers and the webviews of VS Code, and its declarations;
`@nimblescape/markdowneditor` also holds `dist/markdown.css`. A package
bundles only its own code: the other packages of the workspaces, Tiptap,
ProseMirror and markdown-it stay dependencies, so that the page that uses
the editor has one copy of ProseMirror, and the bundle of that page carries
the notices of the libraries.

Another repository installs the packages from this repository at a fixed
commit, in the same way as the other nimblescape npm packages: a script of
that repository fetches the commit, runs `npm ci --ignore-scripts` and
`npm run build`, and copies the files that
`npm pack --dry-run --json --workspaces` lists for each package into
`node_modules/@nimblescape/<name>`, for example
`node_modules/@nimblescape/markdowneditor` and
`node_modules/@nimblescape/markdowntext`. The packed files of
`npm run pack` also work: `npm install` with both files in one command
installs both packages, and the dependency of the editor on
`@nimblescape/markdowntext` uses the installed package. After the release,
the packages become dependencies of that repository with their versions,
and the script goes away.

## Release

The release workflow of the npm packages comes with step 11 of the
[plan](docs/specification.md#plan), the same as for the other nimblescape
npm packages. Until then, nothing is published.
