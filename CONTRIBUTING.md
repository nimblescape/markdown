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
| `packages/markdowntext/src/source/textSource.ts` | `TextSource`: the text of a file, the changes with their origin, the selections of the editors, the listeners and the file ([R-SRC-001](docs/source.md#r-src-001)). |
| `packages/markdowntext/src/source/patch.ts` | The text patches: apply them, move a position with them, find the patches between two texts with the line diff of the library `diff`, and merge two changes of the same text ([R-SRC-002](docs/source.md#r-src-002)). |
| `packages/markdowntext/src/frontMatter/detect.ts` | The front matter at the start of a file, in YAML, TOML or JSON ([R-SRC-003](docs/source.md#r-src-003)). |
| `packages/markdowntext/src/frontMatter/edit.ts`, `packages/markdowntext/src/frontMatter/yaml.ts`, `packages/markdowntext/src/frontMatter/json.ts`, `packages/markdowntext/src/frontMatter/types.ts` | The reading and the edits of a front matter in YAML, TOML and JSON ([R-FM-005](docs/editor.md#r-fm-005)): each edit changes only the text of the edited value, so that the comments, the order and the quotes of the other keys stay. |
| `packages/markdowntext/src/frontMatter/schema.ts` | The check of a front matter against its JSON schema, with the path of each problem and a message in plain words, and the schema of a value ([R-FM-004](docs/editor.md#r-fm-004)). |
| `packages/markdownai/src/index.ts` | The exports of `@nimblescape/markdownai`, the AI without a view. |
| `packages/markdownai/src/provider.ts` | The provider API: the provider, its models, the request with the messages, the context and the tools, and the events of an answer ([R-AI-002](docs/ai.md#r-ai-002)). |
| `packages/markdownai/src/context.ts` | The instructions with the context of the document for the AI: the document, the selection, the schema of the front matter and the format rules ([R-AI-001](docs/ai.md#r-ai-001)). |
| `packages/markdownai/src/changeTool.ts` | The tool `propose_change` and the range of the text of the file of its input, with only the words that change ([R-AI-006](docs/ai.md#r-ai-006)). |
| `packages/markdownai/src/chat.ts` | `runChat`: the loop of one answer of a chat, with the proposed changes and the tools of the integrating code ([R-AI-002](docs/ai.md#r-ai-002)). |
| `packages/markdownai/src/remote.ts` | `remoteProvider` and `serveProvider`: a provider in another process through a channel of messages, so that the API key never reaches the page ([R-AI-005](docs/ai.md#r-ai-005)). |
| `packages/markdownrender/src/index.ts` | The exports of `@nimblescape/markdownrender`, the renderer. |
| `packages/markdownrender/src/renderer.ts` | `MarkdownRenderer`: the text of a file as HTML without a page (`toHtml`), and in a page with the functions of the plugins (`render`, `fill`) ([R-REN-001](docs/rendering.md#r-ren-001), [R-REN-003](docs/rendering.md#r-ren-003)). |
| `packages/markdownrender/src/markdownIt.ts` | The markdown-it of nimblescape Markdown, for the renderer and the editor: HTML, links in the text, footnotes and task lists, and the markdown-it plugins of the plugins. |
| `packages/markdownrender/src/output.ts` | The output as GitHub writes it: GitHub alerts, the IDs of the headings, the comments of the tables and the lines of the blocks. |
| `packages/markdownrender/src/rawHtml.ts` | The raw HTML of the file in the rendering: `safe`, `text` or `trusted`. |
| `packages/markdownrender/src/plugins.ts` | The plugins of the renderer ([R-REN-002](docs/rendering.md#r-ren-002)), the level "render" of the plugins of the editor: their check, their parts and their styles. |
| `packages/markdownrender/src/styles/content.css` | The styles of rendered content, for a rendering and for the text of the editor, with the tokens `--nsmd-*` of the theme ([R-GEN-010](docs/specification.md#r-gen-010), [R-THEME-001](docs/platforms.md#r-theme-001)). |
| `packages/markdownrender/src/types/` | The types of the markdown-it plugins without types of their own. |
| `packages/markdownlayout/src/index.ts` | The exports of `@nimblescape/markdownlayout`, the layout. |
| `packages/markdownlayout/src/format.ts` | The layout folder format `nimblescape-layout` of Markdown Paper, version 1.1.0: the reading and the check of `layout.json`, the terms of the languages, the language of the field `lang`, and the fields and the schema of the front matter ([R-LAYOUT-001](docs/rendering.md#r-layout-001)). |
| `packages/markdownlayout/src/text.ts` | The plugin of the renderer for the text of the pages ([R-LAYOUT-004](docs/rendering.md#r-layout-004)): the numbers of the headings, the special sections and the parts, the captions of figures, tables and listings, the labels of the links to them, and `renderText`. |
| `packages/markdownlayout/src/footnotes.ts`, `packages/markdownlayout/src/lists.ts`, `packages/markdownlayout/src/tokens.ts` | The footnotes at the foot of their pages, with the addresses of the links to the outside; the generated lists (table of contents, lists of figures, tables and listings); the tokens of the HTML of the layout, which the safe raw HTML of the renderer leaves as it is. |
| `packages/markdownlayout/src/hyphenate.ts`, `packages/markdownlayout/src/template.ts`, `packages/markdownlayout/src/frontMatter.ts` | The soft hyphens by the language, with the patterns of `hyphen`; the templates of the fixed pages and the name of the PDF; the values of the fields of the front matter. |
| `packages/markdownlayout/src/page.ts`, `packages/markdownlayout/src/page/handlers.js` | The page of a document in its layout: the search for the layout, its style sheets, templates and schema, the policy of the scripts, and the script of the layout in the page, which starts Paged.js when the page is complete and numbers the pages ([R-LAYOUT-001](docs/rendering.md#r-layout-001) to [R-LAYOUT-003](docs/rendering.md#r-layout-003)). |
| `packages/markdownlayout/src/pages.ts`, `packages/markdownlayout/src/embed.ts` | `showPages`: the view of the pages in a frame, with the functions of the plugins before Paged.js; with the option `embed`, the files of the page as `blob:` URLs, for a webview of VS Code ([R-LAYOUT-003](docs/rendering.md#r-layout-003)). |
| `packages/markdownlayout/src/livePages.ts` | `LivePages`: the pages of a file that follow the changes of its text while they show, and the place of a double click on a block (`lineAt`, `offsetOfLine`) ([R-LAYOUT-003](docs/rendering.md#r-layout-003)). |
| `packages/markdownlayout/src/pageRenders.ts` | The functions of the plugins in the page itself, for the PDF: the data of the placeholders as JSON in the page, and `registerRenders` for a script of the page ([R-LAYOUT-002](docs/rendering.md#r-layout-002)). |
| `packages/markdownlayout/src/pdf/` | The entry point `@nimblescape/markdownlayout/pdf` for Node.js: the search for an installed browser, the connection to it through the Chrome DevTools Protocol, the print of the page, the finish of the PDF with `pdf-lib`, and the host of the disk ([R-LAYOUT-002](docs/rendering.md#r-layout-002)). The code is the PDF code of Markdown Paper. |
| `packages/markdownlayout/src/builtin.ts`, `packages/markdownlayout/layouts/plain/` | The built-in layout `plain`, whose files the package holds as texts. |
| `packages/markdowneditor/src/index.ts` | The exports of `@nimblescape/markdowneditor`, the editor. |
| `packages/markdowneditor/src/editor.ts` | `MarkdownEditor`: the editor on a DOM element, with its Markdown text in and out, the read-only mode ([R-GEN-008](docs/editor.md#r-gen-008)), the mode to learn Markdown ([R-GEN-013](docs/editor.md#r-gen-013)) and the event of a change. |
| `packages/markdowneditor/src/ui/proposals.ts` | The proposed changes as tracked changes: the proposals in the state of the editor, the removed text struck through, the new text and the buttons "Accept" and "Reject" ([R-AI-006](docs/ai.md#r-ai-006)). |
| `packages/markdowneditor/src/extensions/core.ts` | The Tiptap extensions of the document: the nodes and marks of CommonMark and GFM, footnotes, the front matter, which stays the first block, and the raw nodes for HTML and for text that no block of Markdown holds. Attributes that record the form of the Markdown text, such as the bullet of a list, let a changed block keep its form. |
| `packages/markdowneditor/src/markdown/parse.ts` | The Markdown text into the document of the editor, by the tokens of markdown-it and `prosemirror-markdown`. It keeps the text of each top-level block and the blank lines between the blocks. |
| `packages/markdowneditor/src/markdown/serialize.ts` | The document back into Markdown text ([R-EDIT-004](docs/editor.md#r-edit-004), [R-EDIT-005](docs/editor.md#r-edit-005)): each block that the user did not change keeps its text byte for byte; a changed block is written new, in the form of the formatter of nimblescape Markdown Notes. |
| `packages/markdowneditor/src/markdown/tableComments.ts` | The comments of the tables for what GFM cannot store: the color of a cell and the widths of the columns ([R-EDIT-010](docs/editor.md#r-edit-010)), with the patterns of the renderer. |
| `packages/markdowneditor/src/markdown/escape.ts` | The backslashes of a changed block: only before characters that would otherwise start Markdown syntax. |
| `packages/markdowneditor/src/markdown/update.ts` | A change of the text from outside in the document of the editor: only the top-level blocks whose text or node changed ([R-SRC-002](docs/source.md#r-src-002)). |
| `packages/markdowneditor/src/markdown/codec.ts` | `MarkdownCodec`: the parser and the serializer with one schema and one markdown-it, the one of the renderer, for the editor and for code without a page. |
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
| `packages/markdowneditor/src/plugins/api.ts` | The plugin API, version 1 ([R-PLUGIN-001](docs/plugins.md#r-plugin-001)): the plugin object, the API of the editor and of the platform for the plugins, and the check and combination of the plugins of an editor. |
| `packages/markdowneditor/src/plugins/render.ts` | The level "render" ([R-GEN-012](docs/plugins.md#r-gen-012)): the view of the blocks with a source, which shows a block with the renderer of the editor and the plugins, with "Edit source". |
| `packages/markdowneditor/src/plugins/generated.ts`, `packages/markdowneditor/src/plugins/threads.ts`, `packages/markdowneditor/src/plugins/cache.ts` | The read-only generated parts ([R-EDIT-011](docs/editor.md#r-edit-011)), the threads beside the text with their icons and their panel ([R-GEN-014](docs/editor.md#r-gen-014)), and the cache of the parts and threads of each document. |
| `packages/markdowneditor/src/styles/markdown.css` | The styles of the editor: the styles of rendered content of the renderer, which it imports, and the styles of the interaction ([R-THEME-001](docs/platforms.md#r-theme-001)). |
| `packages/markdowneditor/src/types/` | The types of the packages without types of their own. |
| `packages/markdownvscode/src/index.ts`, `packages/markdownvscode/src/webview.ts` | The exports of `@nimblescape/markdownvscode`, the adapter for VS Code: the side of the extension, and the side of the page as `@nimblescape/markdownvscode/webview`. |
| `packages/markdownvscode/src/extension/editor.ts` | `registerMarkdownEditor`: the custom text editor ([R-VSC-001](docs/platforms.md#r-vsc-001)), the text editor to the side ([R-VSC-002](docs/platforms.md#r-vsc-002)), the changes between each page and its document ([R-VSC-005](docs/platforms.md#r-vsc-005)), and the views "Edit" and "Pages" with the files that the page reads through the extension ([R-VSC-007](docs/platforms.md#r-vsc-007)). |
| `packages/markdownvscode/src/extension/page.ts` | The HTML of the page of the webview, with the frame of the pages and the policy of its content. |
| `packages/markdownvscode/src/webview/connection.ts` | `connectVsCode`: the source of the page, its changes to and from the document, the fonts, the keys that stay in the page ([R-VSC-006](docs/platforms.md#r-vsc-006)), the channels of the plugins to the extension, and the view, the frame and the host of the pages ([R-VSC-007](docs/platforms.md#r-vsc-007)). |
| `packages/markdownvscode/src/messages.ts` | The messages between the extension and the page, and the check of the messages of the page. |
| `packages/markdownvscode/src/styles/vscode.css` | The theme of VS Code: the tokens `--nsmd-*` from the variables `--vscode-*` of the color theme, and the fonts ([R-THEME-001](docs/platforms.md#r-theme-001), [R-THEME-003](docs/platforms.md#r-theme-003)). |
| `packages/markdownvscode/src/test/fakeVscode.ts` | A small API of VS Code for the tests of the adapter, with a webview panel whose messages wait until a test gives them. |
| `packages/*/src/**/*.test.ts` | The unit tests, with vitest: the source (`packages/markdowntext/src/source/source.test.ts`), the AI without a provider of its own, with a provider of prepared answers (`packages/markdownai/src/*.test.ts`), the edits and the schema of the front matter (`packages/markdowntext/src/frontMatter/*.test.ts`), the renderer without a page and in a page of happy-dom (`packages/markdownrender/src/renderer.test.ts`, `packages/markdownrender/src/page.test.ts`), the layout folder format, the text of the pages and the page of a document in its layout (`packages/markdownlayout/src/format.test.ts`, `text.test.ts` and `page.test.ts`), the functions of the plugins in the page of the PDF, the files of the page in the frame and the pages that follow the text in a page of happy-dom (`packages/markdownlayout/src/pageRenders.test.ts`, `embed.test.ts` and `livePages.test.ts`), the PDF with an installed browser (`packages/markdownlayout/src/pdf/pdf.test.ts`; without a browser, this test runs only in CI, where Google Chrome is installed), the round trip of the Markdown (`packages/markdowneditor/src/markdown/codec.test.ts`), the editor, two editors of one source, its interaction, its tables, the form of the front matter, the proposed changes, the plugin API and the nonce of its style elements in a page of happy-dom (`editor.test.ts`, `source.test.ts`, `ui/interaction.test.ts`, `ui/table/grid.test.ts`, `ui/frontMatterForm.test.ts`, `ui/proposals.test.ts`, `plugins/plugins.test.ts` and `styleNonce.test.ts` in `packages/markdowneditor/src/`), and the adapter for VS Code with the small API of VS Code, also the views "Edit" and "Pages" (`packages/markdownvscode/src/editor.test.ts`). |
| `test/corpus/` | The Markdown files of the tests of the round trip: GFM, the front matter in TOML and JSON, the format of Markdown Notes and the documents and layouts of Markdown Paper. [test/corpus/README.md](test/corpus/README.md) explains them. |
| `demo/index.html`, `demo/main.ts` | The example page: two editors of one source, the rendered editor on the left and the Markdown text on the right; a change in one shows at once in the other. The button "Rendering" shows the rendering of the renderer in place of the text, and the button "Pages" the pages of the text in the built-in layout `plain`. |
| `demo/examplePlugin.ts` | The plugin of the example page and of the example extension: a CSV table at the level "render", a read-only citation and a thread beside the text. |
| `demo/vscode/` | The example extension for VS Code: it opens each Markdown file in the editor, with the adapter. It is never published. |
| `.vscode/launch.json`, `.vscode/tasks.json` | Runs the example extension in a new window of VS Code, after its build. |
| `licenses.json` | The license that was decided for each package that the packages of the workspaces need at run time ([R-GEN-011](docs/specification.md#r-gen-011)). |
| `scripts/check-licenses.mjs`, `scripts/check-licenses.test.mjs` | The check of `package-lock.json` against `licenses.json` and its test. |
| `scripts/third-party-notices.mjs` | Writes the notices of the packages of a bundle from the installed packages, for the example page and the example extension. |
| `esbuild.mjs` | In the folder of a package, builds a `dist/<name>.js` for each entry point of its exports, for Node.js when its export has the condition `node`, and a `dist/<name>.css` for each file of `src/styles/`, with the texts of the imports with the suffix `?raw`, and copies the script of Paged.js for a package that exports it; in the root, with `--demo` or `--serve`, builds the example page in `demo/dist/`, and with `--vscode` the example extension in `demo/vscode/dist/`, with the script of Paged.js for its pages, from the sources of the packages. |
| `tsconfig.json`, `packages/*/tsconfig.build.json` | The settings of the type check of all packages, and of the declarations of each package in its `dist/`. |
| `eslint.config.mjs`, `vitest.config.mts` | The settings of the check of the code style and of the unit tests. |
| `package.json` | The manifest of the root of the workspaces: private, never published, with the development tools and the commands below. Each package has its own manifest with its libraries. |
| `package-lock.json` | The locked libraries and development tools. npm writes this file, and nobody edits it by hand. |
| `.node-version` | The Node release of the development tools. `actions/setup-node` in the workflows and local Node version managers read it. |
| `.github/workflows/ci.yml` | Checks the types, the code style and the licenses, runs the tests, builds the packages, the example page and the example extension, and packs the npm packages, for every push to `main`, every pull request and the commit of every release. The release publishes the npm packages of this workflow, so a change of it needs a dry run (rule 4 of the [release rules](#release-rules)). |
| `.github/workflows/release.yml` | Releases a version of all npm packages on a manual start: commits the version to a temporary branch, tests and packs it with `ci.yml`, and only then moves `main` to it, creates its tag and GitHub release and publishes the packages to npmjs.com. A dry run tests without a change. The section [Release](#release) explains it. |
| `.github/workflows/release-dry-run.yml` | Fails on a pull request that changes the release process (`release.yml`, `ci.yml` or `scripts/release-checks.mjs`) until a dry run on its branch tested the change (rule 4 of the [release rules](#release-rules)). |
| `scripts/release-checks.mjs`, `scripts/release-checks.test.mjs` | The check of rule 4 of the [release rules](#release-rules), which `release.yml` and `release-dry-run.yml` run, and its test. |
| `scripts/npm-setup.sh` | Sets up the publishing to npmjs.com: the environment `npm`, the first version of each package and its trusted publisher ([npmjs.com setup](#npmjscom-setup)). |
| `CHANGELOG.md` | The changes of each released version; the release takes the section of its version as the notes of its GitHub release. |
| `.github/dependabot.yml` | Proposes weekly updates of the libraries, of the development tools and of the pinned actions. TypeScript stays at 6.0.3, as in every nimblescape repository ([R-GEN-007](docs/specification.md#r-gen-007)). |
| `packages/*/dist/`, `demo/dist/`, `demo/vscode/dist/` | The built packages, the built example page and the built example extension, kept out of Git. |

## Development

The development tools are TypeScript 6.0.3, esbuild, ESLint with
typescript-eslint and vitest, on the Node.js release in `.node-version`.

| Command | Effect |
| --- | --- |
| `npm ci --ignore-scripts` | Installs the locked libraries and development tools and runs no install script of a dependency. |
| `npm run typecheck` | Checks the types with `tsc`. esbuild does not check them. |
| `npm run lint` | Checks the code style with ESLint. |
| `npm run licenses` | Checks the license of each package that the packages of the workspaces need at run time against `licenses.json`. `npm run licenses -- --write` adds a new package with its license to `licenses.json`; the pull request then shows the new decision. |
| `npm test` | Runs the unit tests with vitest. |
| `npm run build` | Builds each package in the order of the workspaces in `package.json`, `@nimblescape/markdowntext` first: its JavaScript in `dist/`, its styles and its declarations `dist/**/*.d.ts`. `npm run build -w packages/markdowntext` builds one package. |
| `npm run demo` | Builds the example page and serves it on <http://localhost:8000>; it builds again after each change. `node esbuild.mjs --demo` only builds it. |
| `npm run demo:vscode` | Builds the example extension for VS Code in `demo/vscode/dist/`. |
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
points to the source of each entry point, for example `src/index.ts`. The type check (`customConditions` in
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

## The example extension for VS Code

`demo/vscode/` is a small extension that opens each Markdown file in the
editor of rendered Markdown, with `@nimblescape/markdownvscode`
([R-VSC-001](docs/platforms.md#r-vsc-001)). It is a tool of the development
and is never published. To try it, open this repository in VS Code and
start "Example extension" in "Run and Debug" (F5): the task builds it with
`npm run demo:vscode`, and a new window of VS Code opens with the extension.
In that window, a Markdown file opens in the editor; the button
"Open Text Editor to the Side" in the title of the editor opens its text,
and the button "Switch to Pages" shows the pages of the file in its layout
([R-VSC-007](docs/platforms.md#r-vsc-007)); a double click on a page goes
back to that block in "Edit". A changed Markdown file in the view "Source
Control" opens in a diff with the editor on both sides
([R-VSC-009](docs/platforms.md#r-vsc-009)); the arrow buttons in the title
of the editor go to the previous and to the next change. After a change of
the code, run the build again and reload the window.

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
module for browsers, the webviews of VS Code and the extension host of VS
Code, and its declarations; `@nimblescape/markdownrender` also holds
`dist/content.css`, `@nimblescape/markdownlayout` holds
`dist/paged.polyfill.js`, the script of Paged.js, unchanged, with the
notices of the packages in it in `dist/THIRD-PARTY-NOTICES.md`, and
`dist/pdf/index.js`, the entry point `./pdf` for Node.js only,
`@nimblescape/markdowneditor` holds
`dist/markdown.css` with the styles of `content.css` in it, and
`@nimblescape/markdownvscode` holds
`dist/webview.js` for the page and `dist/vscode.css`. A package
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
`node_modules/@nimblescape/markdowneditor`,
`node_modules/@nimblescape/markdownrender` and
`node_modules/@nimblescape/markdowntext`. The packed files of
`npm run pack` also work: `npm install` with the files of all packages in
one command installs them, and the dependency of a package on another
package of the workspaces, for example on `@nimblescape/markdowntext`, uses
the installed package. After the release,
the packages become dependencies of that repository with their versions,
and the script goes away.

## Release

Nothing is released before the release decision, and the packages are
released together with nimblescape Markdown Notes
([R-GEN-007](docs/specification.md#r-gen-007)). The release process is the
same as for the other nimblescape npm packages, for example the package
`@nimblescape/markdownnotes` of Markdown Notes, without the Marketplace.

A released version is a tag `v<version>` whose `<version>` equals the
version in the `package.json` of each package in `packages/`. All packages
have the same version, and each package needs the other packages of the
workspaces in exactly this version. The workflow "Release" creates the
version, its tag, its GitHub release and the version of each package on
npmjs.com in one run. To release a version, follow these steps:

1. Optional: add a section `## <version>` to `CHANGELOG.md` on `main`. The section describes the changes for the users (see [Release rules](#release-rules)).
2. In the tab "Actions", choose the workflow "Release", then "Run workflow" on the branch `main`. Enter the version, for example `0.1.7`. When `CHANGELOG.md` has no section for the version, enter its notes too: they become the section.

The run has four jobs:

1. "Version commit" checks that the run starts from `main`, that the version has the form `<major>.<minor>.<patch>`, that all packages have the same version and that the new version is not lower, that its tag does not exist, and, in a release, that a dry run tested the files of the release process with `scripts/release-checks.mjs dry-run` (rule 4 of the [release rules](#release-rules)). It sets the version in the `package.json` of each package, in the dependencies of the packages on each other and in `package-lock.json`, adds the section of the notes to `CHANGELOG.md` when the file has none, commits the change as "Release `<version>`" and pushes it to the temporary branch `release/run-<run ID>`, not to `main`. When `main` holds the version and its section already, it commits nothing. It first deletes the temporary branches of earlier runs, so that its push creates a new branch and needs no force.
2. "CI" runs the workflow `ci.yml` for the commit of the version, because a push with the token of a workflow starts no other workflow. The npm packages that this job tests and packs are the files of the release, so the release repeats no test and no build.
3. "Main, tag and GitHub release" runs only when CI passed. It moves `main` to the commit of the version as a fast-forward and deletes the temporary branch. When `main` changed during the run, it stops before the tag. Then it creates the tag `v<version>` on the commit and the release of the tag with the GitHub CLI `gh`. The section of the version in `CHANGELOG.md` becomes the notes, and the npm package of each package (for example `nimblescape-markdowneditor-<version>.tgz`) becomes a file of the release. A release that exists keeps its notes and receives only a file that it does not hold.
4. "Publish to npmjs.com" downloads the npm packages of the GitHub release and publishes them with `npm publish --access public`, each package after the packages of the workspaces that it needs, with [trusted publishing](https://docs.npmjs.com/trusted-publishers): npm exchanges the OpenID Connect token of the job for a token of npmjs.com that can publish only the package, and adds the provenance of the build. It skips a version that npmjs.com holds already, and it stops with a message before it publishes anything when a package does not exist yet (see [npmjs.com setup](#npmjscom-setup)).

`main` receives the version commit only after CI passed. When CI fails,
`main`, the tags, the releases and npmjs.com stay unchanged, and the
version can still be released: fix the cause on `main` and start the release
of the same version again. The jobs move and push with the token of the
workflow, so a rule of `main` that blocks direct pushes stops the release.

A dry run tests a release without a change: choose "Dry run" when you start
the workflow. The run makes the version commit on its temporary branch, runs
CI for it and deletes the branch; it changes neither `main`, a tag, a release
nor npmjs.com. Its run name ends with "(dry run)". A dry run may start from
another branch than `main`, so it also tests a change of `release.yml` on
that branch before the change reaches `main`.

When a job fails, remove the cause and choose "Re-run failed jobs" on the
run. A re-run keeps the tag and the files that the GitHub release already
holds, and the publish job skips a version that npmjs.com already holds, so
a re-run never publishes a version twice. GitHub allows a re-run only within
30 days of the run. A new run deletes the temporary branch of a failed run,
so a failed run can no longer be re-run after a new run started.

The workflow `release-dry-run.yml` and the script `scripts/release-checks.mjs`
with its test are the same as in the extension repositories of nimblescape.

### Release rules

The npm packages of this repository follow these rules. Only rule 4 has a
check in the workflows, `scripts/release-checks.mjs dry-run`; everyone
follows the other rules without a check.

1. **The names never change.** A package keeps its name `@nimblescape/markdown<part>` ([R-ARCH-002](docs/specification.md#r-arch-002)), and nimblescape never publishes a package under a new name.
2. **No deletion.** nimblescape never deletes a package or a version on npmjs.com. No workflow, npm script or file of `scripts/` runs `npm unpublish`, after which npmjs.com never accepts the number of that version again.
3. **Only changes for the users, at most one version in 7 days.** A version is published only when it changes something for the users of a package, its section in `CHANGELOG.md` describes that change, and at least 7 days passed since the newest release; an urgent fix may come earlier. A change for the users changes the code of a package (`src/`, which the build bundles into `dist/`), another file of a package that is not a document, or a field of a `package.json` that changes how the package works, for example `exports`. A change only of the documents, the tests, the example page and extension or the build tools does not count: it reaches the users with the next version that changes a package.
4. **Dry run first.** A change of the release process is tested with a dry run before it reaches `main`. The files of the release process are `release.yml`, `ci.yml`, whose npm packages the release publishes, and `scripts/release-checks.mjs`. The workflow "Release dry run" runs on every pull request. When the pull request changes one of these files, also in an update by Dependabot, the check `dry-run` fails until a successful dry run, or the newest release, had these files as they are at the head of the pull request. Start the workflow "Release" on the branch of the pull request with "Dry run" and a version without a tag (with notes when `CHANGELOG.md` has no section for the version), then re-run the job "release dry run" of the pull request. A pull request from a fork cannot meet the rule, because the dry run needs a branch of this repository. A pull request whose base branch has no `release.yml` yet, such as the first pull request of the release process, passes the check with a notice, because GitHub starts the workflow "Release" only from the default branch; the job "Version commit" of the first release runs the check on `main`. The job "Version commit" of a release runs the check `dry-run` again, so a change that reached `main` without a dry run stops the release until a dry run tested it. Do not make "release dry run" a required check of `main`: the release moves `main` to its version commit, which has no result of the check.
5. **Only GitHub Actions.** Only the job "Publish to npmjs.com" publishes, with trusted publishing and no token. No other workflow, npm script or file of `scripts/` runs `npm publish`, apart from `scripts/npm-setup.sh` for the first version of each package, because npmjs.com sets up a trusted publisher only for a package that exists.

## npmjs.com setup

The job "Publish to npmjs.com" publishes with
[trusted publishing](https://docs.npmjs.com/trusted-publishers): npmjs.com
trusts the workflow `release.yml` of this repository in the environment
`npm` for each package, and accepts the OpenID Connect token of its job
instead of a token. No npm token is stored in GitHub. npm adds the
provenance of the build only for a public repository, which this repository
is.

### What exists

| Part | Where | Value |
| --- | --- | --- |
| Organization | [npmjs.com](https://www.npmjs.com/org/nimblescape) | `nimblescape`, the scope of the packages |
| Packages | npmjs.com | `@nimblescape/markdowntext`, `@nimblescape/markdownai`, `@nimblescape/markdownrender`, `@nimblescape/markdownlayout`, `@nimblescape/markdowneditor` and `@nimblescape/markdownvscode`, public, after the first release |
| Trusted publisher | the settings of each package on npmjs.com, "Trusted Publisher" | GitHub Actions, the repository `nimblescape/markdown`, the workflow `release.yml`, the environment `npm` |
| Environment | the settings of the repository, "Environments" | `npm`, reachable from the tags `v*` and the branch `main` only |

### Setup

`npm publish` with provenance fails when `repository.url` of the
`package.json` of a package names another repository, so a rename of the
repository needs the trusted publishers again. The script
`scripts/npm-setup.sh` sets up the environment, the first version of each
package and the trusted publishers. It needs the GitHub CLI and npm 11.15.0
or newer, both signed in, with an npm account that may publish in the
organization `nimblescape` and has two-factor authentication. It shows what
it sets up and asks before it changes anything; it changes nothing that
already exists, so it can run again:

```sh
gh auth login
npm login
scripts/npm-setup.sh            # before the first release: the environment only
scripts/npm-setup.sh 0.1.0      # after the release 0.1.0: the first versions and the trusted publishers
```

The first release stops in the job "Publish to npmjs.com", because no package
exists yet. Run the script with the version of that release, then re-run the
failed job: it finds the versions on npmjs.com and ends without a change. A
package that is added to the workspaces later needs the same setup after the
first release that holds it.
