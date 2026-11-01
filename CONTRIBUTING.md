<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Contributing

This guide explains the files, the development, the tests and the use of the
npm package `@nimblescape/markdown` before its release.
[docs/specification.md](docs/specification.md) lists what the editor must
do, each requirement with an ID, with the plan of the steps, the decisions
and the open questions. A requirement is the clean summary of a decision,
without the texts of the discussion. A change of a feature updates its
requirement in the same pull request.

## Files

| File | Purpose |
| --- | --- |
| `src/index.ts` | The exports of the npm package. |
| `src/editor.ts` | `MarkdownEditor`: the editor on a DOM element, with its Markdown text in and out, the read-only mode ([R-GEN-008](docs/specification.md#r-gen-008)) and the event of a change. |
| `src/extensions/core.ts` | The Tiptap extensions of the document: the nodes and marks of CommonMark and GFM, footnotes, the front matter and the raw nodes for HTML and for text that no block of Markdown holds. Attributes that record the form of the Markdown text, such as the bullet of a list, let a changed block keep its form. |
| `src/markdown/markdownIt.ts` | The markdown-it of the editor: HTML, links in the text, footnotes and task lists, and the markdown-it plugins of the extensions ([R-GEN-012](docs/specification.md#r-gen-012)). |
| `src/markdown/frontMatter.ts` | The front matter at the start of a file, in YAML, TOML or JSON ([R-FM-001](docs/specification.md#r-fm-001)). |
| `src/markdown/parse.ts` | The Markdown text into the document of the editor, by the tokens of markdown-it and `prosemirror-markdown`. It keeps the text of each top-level block and the blank lines between the blocks. |
| `src/markdown/serialize.ts` | The document back into Markdown text ([R-GEN-006](docs/specification.md#r-gen-006)): each block that the user did not change keeps its text byte for byte; a changed block is written new, in the form of the formatter of nimblescape Markdown Notes. |
| `src/markdown/escape.ts` | The backslashes of a changed block: only before characters that would otherwise start Markdown syntax. |
| `src/markdown/codec.ts` | `MarkdownCodec`: the parser and the serializer with one schema and one markdown-it, for the editor and for code without a page. |
| `src/styles/markdown.css` | The styles of the editor, with the tokens `--nsmd-*` of the theme ([R-THEME-001](docs/specification.md#r-theme-001)). |
| `src/types/` | The types of the packages without types of their own. |
| `src/**/*.test.ts` | The unit tests, with vitest: the round trip of the Markdown (`src/markdown/codec.test.ts`) and the editor in a page of happy-dom (`src/editor.test.ts`). |
| `test/corpus/` | The Markdown files of the tests of the round trip: GFM, the front matter in TOML and JSON, the format of Markdown Notes and the documents and layouts of Markdown Paper. [test/corpus/README.md](test/corpus/README.md) explains them. |
| `demo/index.html`, `demo/main.ts` | The example page: the editor on the left and its Markdown text on the right. |
| `licenses.json` | The license that was decided for each package that the editor needs at run time ([R-GEN-011](docs/specification.md#r-gen-011), [decision 22](docs/specification.md#decisions)). |
| `scripts/check-licenses.mjs`, `scripts/check-licenses.test.mjs` | The check of `package-lock.json` against `licenses.json` and its test. |
| `scripts/third-party-notices.mjs` | Writes the notices of the packages of a bundle from the installed packages, for the example page. |
| `esbuild.mjs` | Builds `dist/index.js` and `dist/markdown.css`, and with `--demo` or `--serve` the example page in `demo/dist/`. |
| `tsconfig.json`, `tsconfig.build.json` | The settings of the type check, and of the declarations of the package in `dist/`. |
| `eslint.config.mjs`, `vitest.config.mts` | The settings of the check of the code style and of the unit tests. |
| `package.json` | The manifest of the npm package. |
| `package-lock.json` | The locked libraries and development tools. npm writes this file, and nobody edits it by hand. |
| `.node-version` | The Node release of the development tools. `actions/setup-node` in the workflows and local Node version managers read it. |
| `.github/workflows/ci.yml` | Checks the types, the code style and the licenses, runs the tests, builds the package and the example page, and packs the npm package, for every push to `main` and every pull request. It publishes nothing. |
| `.github/dependabot.yml` | Proposes weekly updates of the libraries, of the development tools and of the pinned actions. |
| `dist/`, `demo/dist/` | The built package and the built example page, kept out of Git. |

## Development

The development tools are TypeScript, esbuild, ESLint and vitest, on the
Node.js release in `.node-version`.

| Command | Effect |
| --- | --- |
| `npm ci --ignore-scripts` | Installs the locked libraries and development tools and runs no install script of a dependency. |
| `npm run typecheck` | Checks the types with `tsc`. esbuild does not check them. |
| `npm run lint` | Checks the code style with ESLint. |
| `npm run licenses` | Checks the license of each package that the editor needs at run time against `licenses.json`. `npm run licenses -- --write` adds a new package with its license to `licenses.json`; the pull request then shows the new decision. |
| `npm test` | Runs the unit tests with vitest. |
| `npm run build` | Builds `dist/index.js`, `dist/markdown.css` and the declarations `dist/**/*.d.ts`. |
| `npm run demo` | Builds the example page and serves it on <http://localhost:8000>; it builds again after each change. `node esbuild.mjs --demo` only builds it. |
| `npm pack` | Builds the npm package `nimblescape-markdown-<version>.tgz` from `dist/`, after `npm run build`. |

## The round trip of the Markdown

The editor changes only the text of the blocks that the user changes
([R-GEN-006](docs/specification.md#r-gen-006)). The parser keeps the text of
each top-level block and the lines between the blocks; the serializer writes
each block that is still the same node of the document with this text, and
writes a changed block new. The tests check three things:

- Every example of the CommonMark specification (package `commonmark-spec`,
  a development tool only) and every file of `test/corpus/` comes back byte
  for byte when nothing changed.
- Written new, each example and each file shows the same HTML in markdown-it.
  `knownDifferences` in `src/markdown/codec.test.ts` lists the examples that
  the document cannot hold, with the reason, for example emphasis in
  emphasis.
- A change of one block changes only the text of that block.

A new form of Markdown that the editor must keep, for example of a plugin,
gets a file in `test/corpus/`.

## The npm package before the release

Nothing is published before the release
([R-GEN-007](docs/specification.md#r-gen-007)): no version of
`@nimblescape/markdown` on npmjs.com and no release tag. The package holds
`dist/index.js`, an ES module for browsers and the webviews of VS Code, its
declarations and `dist/markdown.css`. It bundles only its own code: Tiptap,
ProseMirror and markdown-it stay dependencies, so that the page that uses
the editor has one copy of ProseMirror, and the bundle of that page carries
the notices of the libraries.

Another repository installs the package from this repository at a fixed
commit, in the same way as the other nimblescape npm packages: a script of
that repository fetches the commit, runs `npm ci --ignore-scripts` and
`npm run build`, and copies the files that `npm pack --dry-run --json` lists
into `node_modules/@nimblescape/markdown`. After the release, the package
becomes a dependency of that repository with its version, and the script
goes away.

## Release

The release workflow of the npm package comes with step 11 of the
[plan](docs/specification.md#plan), the same as for the other nimblescape
npm packages. Until then, nothing is published.
