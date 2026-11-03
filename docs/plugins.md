<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the plugins and format extensions

This document defines how plugins extend the parts of nimblescape Markdown,
and the plugins of the format extensions nimblescape Markdown Notes and
nimblescape Markdown Paper. It is part of the
[specification](specification.md) of nimblescape Markdown and normative in
the same way. [Section 5](#5-open-questions) lists its open questions.

## 1. General

### R-GEN-005

**Extension through a clean API.** Notes and Paper extend the libraries with
their functions through a documented plugin API. The plugins of each
extension live in the repository of that extension. The libraries hold the
general functions; a plugin adds only the functions of its extension.

The libraries hold the standard footnotes and the values of the front
matter in the text ([R-FM-007](editor.md#r-fm-007)). The captions with
numbers, `/ref` and the listings stay in Notes in version 1
([R-NOTES-001](#r-notes-001)). The form of the front matter of the editor
([R-FM-001](editor.md#r-fm-001)) takes the place of the view "Front Matter"
of Paper ([R-PAPER-001](#r-paper-001)).

## 2. Levels of a plugin

### R-GEN-012

**Extensions that render, or render and edit.** A plugin works at one of two
levels:

- *Render:* a plugin of the renderer ([R-REN-002](rendering.md#r-ren-002)).
  The editor must keep the text of such a block byte for byte as one unit.
  The user changes it through its source (double click or "Edit source"),
  and the editor then parses this block again.
- *Render and edit:* in addition a plugin of the editor: nodes and marks
  with their views, which token becomes which node or mark, how a changed
  node is written, commands, keys, input rules, items of the menus (insert,
  slash, format bar, block menu, table menu), panels, highlights, the schema
  of the front matter, and the marks for the mode to learn Markdown
  ([R-GEN-013](editor.md#r-gen-013)).

A plugin may start with the level "render" and add the level "render and
edit" later, without a change of the file format. The Markdown API of VS
Code (`markdown.markdownItPlugins`, `markdown.previewStyles`,
`markdown.previewScripts`) is the reference of the plugin API.

A block of the level "render" is a top-level block with a
token that a plugin shows, or with a token that no node of the editor
takes; the editor keeps it as one unit with its text. Its view shows the
rendering: the HTML of markdown-it with the syntax of the plugins, and the
function `render` of a plugin for each kind of token that the plugin shows.
Raw HTML of the file shows as its text in the rendering, as in the rest of
the editor. The editor parses the new text of a block in its place in the
file, so that it may become other blocks, in one step of undo. A block
without a rendering, for example the definitions of link references, and a
block of HTML show their text. A code block that the user writes with a
language that a plugin shows becomes such a unit when the cursor leaves it.
In the mode to learn Markdown, the text of a unit shows below its rendering.

The user switches a block of the level "render" between its rendering and
its source; the two never show at the same time. A double click or the
button "Edit source" shows the source in a field in the place of the
rendering. Leaving the field, Ctrl+Enter (Cmd+Enter on macOS) or the button
"Show rendering" keeps the new text and shows the rendering again; Escape
restores the text and shows the rendering. A block without a rendering
switches between its text and the field in the same way.

### R-PLUGIN-001

**The plugin object.** A plugin is one object: `{ name, apiVersion: 1,
extendMarkdownIt?, styles?, render?, nodes?, marks?, fromMarkdown?,
toMarkdown?, commands?, keys?, menus?, frontMatterSchema?, activate?(editor,
host) }`. `activate` gets the API of the editor and of the platform, and
returns what to dispose.

*(proposal)* Version 1 has these details. The members `name`,
`apiVersion`, `extendMarkdownIt`, `styles` and `render` are the plugin of
the renderer ([R-REN-002](rendering.md#r-ren-002)), so that the same object
works in the renderer and in the editor.

| Member | Content |
| --- | --- |
| `name` | The name of the plugin, of letters, digits, `_` and `-`; two plugins of an editor have different names |
| `apiVersion` | `1`; the editor refuses a plugin of another version |
| `extendMarkdownIt` | A function that adds syntax to the markdown-it of the editor, as in VS Code |
| `styles` | The CSS of the plugin; the editor adds it to the page once |
| `render` | A function `render(source, element, token)` for each kind of token that the plugin shows: the type of a token, or `fence:<language>` for a fenced code block |
| `nodes`, `marks` | The Tiptap extensions of the nodes and marks of the plugin, with their views and input rules |
| `fromMarkdown` | Which token becomes which node or mark |
| `toMarkdown` | How a changed node or mark is written |
| `commands` | Commands by name; the full name of a command is `plugin.command` |
| `keys` | A key for a command of the plugin, for example `Mod-Alt-m` |
| `menus` | The items of the insert menu and of the slash commands, the buttons of the format bar, the items of the block menu and of the table menu |
| `learnMarks` | The marks of the nodes and marks of the plugin in the mode to learn Markdown ([R-GEN-013](editor.md#r-gen-013)) |
| `frontMatterSchema`, `frontMatterInputs` | The schema of the front matter and the inputs of keys ([R-FM-004](editor.md#r-fm-004), [R-FM-006](editor.md#r-fm-006)); the schema of the integrating code comes first |
| `generated` | The generated parts of a document, which are read-only ([R-EDIT-011](editor.md#r-edit-011)) |
| `threads` | The threads of a document and the function that fills the panel of a thread ([R-GEN-014](editor.md#r-gen-014)) |
| `formatRules` | *(proposal)* The format rules of the syntax of the plugin for the AI, a text in Markdown ([R-AI-001](ai.md#r-ai-001)) |
| `activate` | Starts the plugin in an editor |

The API of the editor for the plugins gives the Tiptap editor, the text as
Markdown, the place in the text of the file of a position of the document,
exact inside a block (*(proposal)* at the edge of a mark, outside the mark,
or with the side 1 inside the marks of the text after the position), the commands by their full names, the panel of a thread, and a
refresh of the generated parts and threads after a change of the data of a
plugin. *(proposal)* The refresh also asks the plugins again for the schema
of the front matter, for example after the part of a plugin on the platform
sent the schema of the layout of a paper. *(proposal)* The API of the editor
also takes proposed changes of the text, which the editor shows as tracked
changes ([R-AI-006](ai.md#r-ai-006)). A transaction that takes a change of the text from outside has the
meta `outsideChange`, so that a plugin that guards its parts against the
edits of the user, for example the notes of Notes, lets such a change pass.
A plugin whose syntax changes, for example after new data from its part on
the platform, asks the editor to parse the text again (`reparse`): only the
top-level blocks whose node changes change, outside Undo, and the text stays
the same; a top-level code block that holds the cursor changes only after
the cursor left it, so that typing in it goes on. The API of the platform gives the name of the platform and, for each
plugin, a channel for messages to the other part of the plugin, for example
in the extension of VS Code ([R-VSC-001](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-vsc-001) of Markdown
Notes).

### R-PLUGIN-002

*(proposal)* **The plugins of other bundles.** A page that uses the editor
can load plugins that another bundle holds, for example the plugins of Paper
in the editor of Notes. The bundle of such plugins is a script that holds no
copy of Tiptap, ProseMirror or the libraries: it uses the modules of the
page, because the editor compares their classes. The page gives these
modules and a function to register a plugin on its global
`nimblescapeMarkdown`; the bundle registers each plugin with
`registerPlugin` of `@nimblescape/markdowneditor/bundle`. The plugin of
esbuild `sharedModulesPlugin` of the same entry point builds such a bundle:
each import of `@tiptap/core`, of a module of `@tiptap/pm` (or of the same
package of ProseMirror), of `@nimblescape/markdowneditor` and of
`@nimblescape/markdowntext` reads the module of the page. The page loads the
scripts with `loadPlugins`, one after the other, before it creates the
editor, and gives the editor its own plugins and these. A script that does
not load, and a value that is no plugin of version 1, add no plugin. In VS
Code, the extensions contribute such scripts
([R-VSC-008](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-vsc-008) of Markdown Notes).

## 3. Markdown Notes

### R-NOTES-001

**The plugins of Notes.** Notes adds the notes: highlights in colors with
hidden markers, the hidden form, and the comment of the format, hidden. It
adds the threads of the notes ([R-GEN-014](editor.md#r-gen-014)), the number
of answers beside a block, "Add Note", and the buttons Comment and Reaction
([R-EDIT-007](editor.md#r-edit-007)). It adds its formatter to the source
and the removal of the notes from the output to the renderer. It marks the
parts that it generates as read-only ([R-EDIT-011](editor.md#r-edit-011)):
the numbers in captions, the text of references (`/ref`), and the code and
the cite of listings. It hides the anchors of the captions and the headings
and the comments of the listings. The libraries show the values of the
front matter in the text ([R-FM-007](editor.md#r-fm-007)); Notes inserts
them with `/ref`, and its formatter writes their current values. Notes integrates the AI chat as notes
([R-AI-001](ai.md#r-ai-001)).

## 4. Markdown Paper

### R-PAPER-001

**The plugins of Paper.** Paper adds the schema of the front matter of the
layout, and `layout` and `repos` read-only with Ctrl+click (Cmd+click on
macOS) to the clone
([R-FM-006](editor.md#r-fm-006)). It adds citations: `/cite` with Zotero,
`/research`, the hidden comment of the sources, and the hidden codes of the
special sections. It adds the generated lists, the layouts, the pages and
the PDF through the layout ([R-LAYOUT-001](rendering.md#r-layout-001)), and
the prompt protocol through the history
([R-HIST-005](history.md#r-hist-005)). It marks the parts that it generates
as read-only ([R-EDIT-011](editor.md#r-edit-011)): the text of citations,
the reference list and the generated lists. For a file in the editor, the
form of the front matter of the editor ([R-FM-001](editor.md#r-fm-001))
takes the place of the view "Front Matter" of Paper.

## 5. Open questions

None.

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
