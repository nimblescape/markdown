<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Specification

This document specifies nimblescape Markdown, an editor of rendered Markdown
for the web and for VS Code. Each requirement has an ID as its heading, so
that code, tests and pull requests can link to it, for example
`[R-GEN-001](docs/specification.md#r-gen-001)`. The
[decisions](#decisions) of Hannes are numbered; each requirement names the
decisions that it follows. The [open questions](#open-questions) are not
decided yet: no requirement depends on them.

## Plan

| Step | Content | Requirements | State |
| --- | --- | --- | --- |
| 1 | Setup of the repository: the npm package, an example page for the web, CI with a check of the licenses | [R-GEN-007](#r-gen-007), [R-GEN-011](#r-gen-011) | built |
| 2 | The core on ProseMirror: Markdown into the document of the editor and back, with tests of the round trip | [R-GEN-006](#r-gen-006), [R-GEN-009](#r-gen-009) | built |
| 3 | Rendered editing of CommonMark and GFM: toolbar, format bar, insert menu, slash menu, block handles, find and replace, read-only mode, the mode to learn Markdown | [R-GEN-003](#r-gen-003), [R-GEN-008](#r-gen-008), [R-GEN-013](#r-gen-013) | planned |
| 4 | Tables: handles, markers for new rows and columns, the table menu | [R-GEN-003](#r-gen-003) | planned |
| 5 | The editor of the front matter with both modes and the JSON schema | [R-FM-001](#r-fm-001) to [R-FM-004](#r-fm-004) | planned |
| 6 | The adapter for the webviews of VS Code and the theme of VS Code | [R-GEN-004](#r-gen-004), [R-THEME-001](#r-theme-001) | planned |
| 7 | The plugin API, version 1, with both levels of extensions | [R-GEN-005](#r-gen-005), [R-GEN-012](#r-gen-012) | planned |
| 8 | The plugin of nimblescape Markdown Notes, in its repository; the editor in the Notes side view | [R-GEN-002](#r-gen-002), [R-GEN-004](#r-gen-004), [R-GEN-005](#r-gen-005) | planned |
| 9 | The plugin of nimblescape Markdown Paper, in its repository; the schema of each layout | [R-GEN-005](#r-gen-005), [R-FM-004](#r-fm-004) | planned |
| 10 | The provider API, the Claude provider and the proposed changes in the editor; in Notes, the AI chat as notes and the memory | [R-AI-001](#r-ai-001) to [R-AI-003](#r-ai-003) | planned |
| 11 | The release workflow of the npm package, the same as for the other nimblescape npm packages | [R-GEN-007](#r-gen-007) | planned |

## General

### R-GEN-001

**A general library.** nimblescape Markdown is an independent editor of
rendered Markdown, delivered as a general library, the npm package
`@nimblescape/markdown`. It runs on the web and in the webviews of VS Code
with the same code; it is not a VS Code extension of its own. It shows the
text rendered, and the user edits the rendered text
([decision 1](#decisions), [decision 9](#decisions),
[decision 11](#decisions)).

### R-GEN-002

**One view to read and to edit.** In VS Code, the editor replaces the clean
editing view and the visual editor of nimblescape Markdown Notes and the
Markdown preview ([decision 3](#decisions)).

### R-GEN-003

**The interaction of a document editor.** The editor works as the document
editor of Claude Desktop and of Claude on the web
([decision 2](#decisions)):

- an insert menu "+" in the toolbar, and slash commands: `/` in the text
  opens the same list of items, and typed words filter it;
- in a table, handles of the rows and the columns, markers that insert a new
  row or a new column, and a context menu that inserts, moves and deletes
  rows and columns, sets the width of a column, deletes the table, sorts a
  column, aligns a column, colors cells, switches the header row and inserts
  items;
- a format bar over selected text with the buttons comment, reaction, text
  style, bold, italic, underline, strikethrough, code, color, list and link;
  a button whose function comes from an extension, such as the comment of
  Notes, shows only when that extension is active
  ([decision 21](#decisions));
- these functions come from the code of this repository; no code and no
  design file of the Claude interface is copied.

### R-GEN-004

**The extensions decide where they use it.** Notes and Paper decide where
they use the editor. Notes uses it for each answer of a note in its side
view "Notes", and the editor is made to edit a whole file in the main
editor area too ([decision 4](#decisions), [decision 11](#decisions)). In
VS Code, a setting of the extension chooses which Markdown files open in the
editor ([decision 24](#decisions)). The editor and its adapter for the
webviews of VS Code can require a newer VS Code version than the extensions
require today, when that makes the editor simpler
([decision 23](#decisions)).

### R-GEN-005

**Extension through a clean API.** nimblescape Markdown Notes and
nimblescape Markdown Paper extend the editor with their functions through a
documented plugin API. The plugin of each extension lives in the repository
of that extension. The editor holds the general functions; a plugin adds
only the functions of its extension ([decision 9](#decisions)).

### R-GEN-006

**The file formats.** The editor knows Markdown. Notes and Paper extend the
file format with the parts that they add, through the API of the editor
for the parsing, the Markdown form and the view of each part: Notes with
the notes, the hidden form, the comment of the format, captions, listings
and values of the front matter in the text; Paper with layouts, citations,
the sources, special sections and generated lists
([decision 6](#decisions)). The editor keeps every part of a file that no
plugin knows, so that a file stays intact.

### R-GEN-007

**Rules of all nimblescape repositories:**

- The requirements are a clean summary: each decision of Hannes is a
  numbered decision and a requirement in this document, in the same change.
- Code and documents use English terms.
- Nothing is published before the release: no version of the extension on
  the Marketplace, no version of the npm package on npmjs.com, no release
  tag. Other repositories install the npm package from this repository at a
  fixed commit.
- The npm package uses the same structure, build and release workflow as
  the npm packages of the other nimblescape extensions.

### R-GEN-008

**Read-only mode.** A button switches the editor between editing and
reading. The code that integrates the library decides whether the button
is available at all and in which mode the editor starts, so that an
extension can make the editor a viewer only, also through a setting of its
user ([decision 10](#decisions)).

### R-GEN-009

**The engine.** The editor is built on ProseMirror. The engine meets each
requirement through its normal API, without workarounds; a requirement that
ProseMirror cannot meet in this way leads to a new engine of its own
([decision 12](#decisions)).

### R-GEN-010

**One rendering.** There is no renderer apart from the editor: a rendered
view without edit functions is the editor in its read-only mode
([R-GEN-008](#r-gen-008)). The view, the pages of a paper and the PDF come
from the same rendering code and the same views of the plugins
([decision 13](#decisions)). The view of the Markdown with its layout, with
pages, comes from nimblescape Markdown Paper, as an extension of the editor;
the editor has no layouts of its own ([decision 20](#decisions)).

### R-GEN-011

**Available libraries first.** The editor uses existing open-source
libraries wherever one fits, and respects their licenses
([decision 14](#decisions)). The license of each library is decided one by
one, and the license of the editor itself, MIT today, can change when a
library needs it ([decision 22](#decisions)). The file
`licenses.json` lists each package of the bundle with the license that was
decided for it; CI fails for a package or a license that the file does not
list. The notices go with every bundle. Own code stays for what no library
does. The libraries:

| Library | License | Use |
| --- | --- | --- |
| Tiptap 3 (`@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit` and the `@tiptap/extension-*` packages of the nodes and marks) | MIT | The editor on ProseMirror, its extensions, and the extension API for the plugins |
| ProseMirror (through `@tiptap/pm`) | MIT | The engine ([R-GEN-009](#r-gen-009)) |
| markdown-it, `markdown-it-footnote`, `markdown-it-task-lists` | MIT, MIT, ISC | Parsing the Markdown text, as Notes and Paper do |
| `prosemirror-markdown` | MIT | The bridge from the tokens of markdown-it to the document, and the Markdown of a changed block |
| `string-width` | MIT | The width of the cells of a table |

### R-GEN-012

**Extensions that render, or render and edit.** An extension adds a
function at one of two levels ([decision 18](#decisions)):

- *Render:* it adds syntax with the function `extendMarkdownIt(md)`, as an
  extension of the Markdown preview of VS Code does, and a view for each new
  kind of token. The editor keeps the Markdown text of such a block
  unchanged; the user changes it by editing its source.
- *Render and edit:* it also adds nodes and marks of the document, how a
  token becomes a node and how a changed node is written as Markdown,
  commands, keys and menu items.

The Markdown API of VS Code (`markdown.markdownItPlugins`,
`markdown.previewStyles`, `markdown.previewScripts`) is the reference for
the extension API, so that a markdown-it plugin works in the preview of
VS Code and in the editor without a change.

### R-GEN-013

**A mode to learn Markdown.** When the user switches this mode on, the
editor shows the Markdown marks under the rendered text, as other editors do,
for example `**` around bold text and `#` before a heading
([decision 19](#decisions)).

## AI chat

### R-AI-001

**AI chats are notes.** An AI chat works as Claude Code does: it knows the
document and the selection, and it proposes changes that the user accepts or
rejects ([decision 15](#decisions)). The chat is a thread of a note of
nimblescape Markdown Notes: the AI answers in the thread as one more author.
Notes integrates the chat; the editor gives the general parts: the provider
API ([R-AI-002](#r-ai-002)) and the proposed changes in the text
([decision 16](#decisions)).

### R-AI-002

**Pluggable AI.** A general provider API makes any AI pluggable. The first
and for now only provider is the Claude API ([decision 15](#decisions)). The
integrating code gives the AI its tools through the provider API, for
example the memory ([R-AI-003](#r-ai-003)).

### R-AI-003

**Memory.** The AI uses a memory, so that a decision in a chat has the
context of the other decisions and chats ([decision 17](#decisions)).

## Theme

### R-THEME-001

**Colors of VS Code.** In VS Code, every color of the editor comes from the
active color theme of VS Code ([decision 5](#decisions)).

### R-THEME-002

**Themes on the web.** On the web, the editor is themable: the page that
creates the editor chooses its colors ([decision 5](#decisions)).

## Front matter

### R-FM-001

**Structured editor of the front matter.** The editor shows the front matter
of a file as a form, not as YAML text. The form is a general function of the
editor, for every Markdown file; Notes and Paper add only their own parts
([decision 7](#decisions), [decision 9](#decisions)). The form edits every
front matter format: YAML, TOML and JSON.

### R-FM-002

**Read-only mode.** In the read-only mode, the keys of the front matter are
fixed: the user adds no key and changes only values. A schema defines what
the front matter must hold, which keys the user can edit, and which values
each key allows ([decision 7](#decisions)).

### R-FM-003

**Edit mode.** In the edit mode, the user also adds keys and structured
values, such as lists and maps ([decision 7](#decisions)).

### R-FM-004

**JSON schemas.** A schema of the front matter is a JSON file, as all data
formats of the project are JSON. Each layout of nimblescape Markdown Paper
has a schema of the front matter of its documents
([decision 8](#decisions)).

## Decisions

1. **One editor for two platforms:** nimblescape Markdown is an independent
   and extensible editor of rendered Markdown for the web and for VS Code
   ([R-GEN-001](#r-gen-001)).
2. **The interaction of the Claude document editor:** insert menu, slash
   commands, handles and markers for new rows and columns of a table, and
   the context menu of a table, in original code
   ([R-GEN-003](#r-gen-003)).
3. **One view:** the editor replaces the clean editing view and the visual
   editor of Markdown Notes and the Markdown preview
   ([R-GEN-002](#r-gen-002)).
4. **Main view and side view:** Notes and Paper decide where they use the
   editor; Notes uses it in its side view, and the editor can also edit a
   whole file in the main editor area ([R-GEN-004](#r-gen-004)).
5. **Theme:** the colors of the VS Code theme in VS Code; themable on the
   web ([R-THEME-001](#r-theme-001), [R-THEME-002](#r-theme-002)).
6. **File formats:** Notes and Paper extend the file format with their
   parts, and the editor gives them the API for it
   ([R-GEN-006](#r-gen-006)).
7. **Front matter:** a structured editor for every front matter format
   (YAML, TOML and JSON), with a read-only mode (values only, driven by a
   schema) and an edit mode (structured values can be added)
   ([R-FM-001](#r-fm-001) to [R-FM-003](#r-fm-003)).
8. **JSON schemas:** the schema of a front matter is JSON; each layout gets
   one ([R-FM-004](#r-fm-004)).
9. **An editor with a clean API:** Notes and Paper extend the editor with
   their functions through a clean API; the front matter is a general
   function of the editor ([R-GEN-005](#r-gen-005), [R-FM-001](#r-fm-001)).
10. **Read-only mode:** a button switches to read-only; the integrating code
    decides whether the button is available at all and can make the editor
    a viewer only ([R-GEN-008](#r-gen-008)).
11. **A general library:** the editor is a general Markdown library, not a
    VS Code extension of its own; Notes and Paper decide where they use it
    ([R-GEN-001](#r-gen-001), [R-GEN-004](#r-gen-004)).
12. **The engine:** the engine that suits the editor best, which meets each
    requirement through its normal API without workarounds, else a new
    engine; ProseMirror ([R-GEN-009](#r-gen-009)).
13. **One rendering:** the renderer is the editor without its edit
    functions; view, pages and PDF share one rendering
    ([R-GEN-010](#r-gen-010)).
14. **Available libraries first:** existing open-source libraries wherever
    one fits, with respect for their licenses ([R-GEN-011](#r-gen-011)).
15. **AI chat:** an AI chat as in Claude Code, with a provider API; Claude
    first ([R-AI-001](#r-ai-001), [R-AI-002](#r-ai-002)).
16. **AI chats are notes:** an AI chat is a thread of a note of Markdown
    Notes; Notes integrates the chat ([R-AI-001](#r-ai-001)).
17. **Memory of the AI:** the AI uses a memory, so that a decision in a chat
    has the context of the other decisions and chats
    ([R-AI-003](#r-ai-003)).
18. **Two levels of extensions:** extensions that render, or render and
    edit; the Markdown API of VS Code is the reference
    ([R-GEN-012](#r-gen-012)).
19. **A mode to learn Markdown:** the editor shows the Markdown marks under
    the rendered text ([R-GEN-013](#r-gen-013)).
20. **The layout comes from Paper:** Markdown Paper brings the function to
    render and view the Markdown with its layout ([R-GEN-010](#r-gen-010)).
21. **The format bar on selected text:** the buttons of the format bar of
    the Claude document editor ([R-GEN-003](#r-gen-003)).
22. **Licenses per library:** the license of each library is decided one
    by one; the license of the editor can change when a library needs it
    ([R-GEN-011](#r-gen-011)).
23. **VS Code version:** the editor can require a newer VS Code version
    than the extensions require today, when that makes the editor simpler
    ([R-GEN-004](#r-gen-004)).
24. **Which files open in the editor:** a setting chooses which Markdown
    files open in the editor in VS Code ([R-GEN-004](#r-gen-004)).

## Open questions

1. Whether Notes also uses the editor for the main view of a file in VS
   Code, and which Markdown files open in it when the user did not change
   the setting.
2. How the editor keeps the text of a file that the user did not change.
3. The split of functions between the editor, Notes and Paper: standard
   footnotes; captions, links to figures and tables, and listings; values of
   the front matter in the text; the view "Front Matter" of Paper.
4. How the file stores what a GFM table cannot store: cell colors, column
   widths, a table without a header row, lists in cells, and dropdowns.
5. The file of the schema of a layout and the field `fields` of
   `layout.json`; the mode of the form for a file without a schema.
6. The fonts of the text in VS Code.
7. The name of the npm package and the contribution point of the plugins.
8. How the pages of the layout view of Paper switch with the editing view.
9. How the editor shows the changes that the AI proposes.
10. Where the memory of the AI is stored (in the repository of the document,
    or for each user), and whether the AI writes it without asking.
11. Whether the mode to learn Markdown shows all marks or only the marks at
    the cursor, and whether the user can edit the marks.
12. How the file writes underlined and colored text, which Markdown does not
    have.

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
