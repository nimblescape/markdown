<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the editor

This document defines the editor: the part that shows the text in a form
that the user changes ([section 3](specification.md#3-architecture) of the
specification), and the rendered Markdown editor, its first editor. It is
part of the [specification](specification.md) of nimblescape Markdown and
normative in the same way. [Section 10](#10-open-questions) lists its open
questions.

## 1. General

### R-GEN-002

**One view to read and to edit.** The libraries replace the clean editing
view and the visual editor of Markdown Notes and the Markdown preview of VS
Code.

### R-EDIT-001

**Changes with their origin.** An editor must turn each edit into a change
of the text with its origin: "user" for an edit of the user, "AI" for a
proposed change of the AI that the user accepts. Undo and redo must undo and
redo one step for each action of the user, for example a typed word, a menu
command or a moved row.

### R-EDIT-002

**Several editors of one file.** Several editors may show one file at the
same time, for example the rendered editor and the text editor beside it. An
edit in one must show at once in the others. Editors are, for example, the
rendered Markdown editor ([section 2](#2-the-rendered-markdown-editor) to
[section 9](#9-threads-beside-the-text)), the text editor of a platform or a
code editor for source code, the form of the front matter
([section 8](#8-front-matter-form)), and the AI ([ai.md](ai.md)), which
proposes changes.

## 2. The rendered Markdown editor

### R-EDIT-003

**Rendered Markdown.** The editor must show Markdown rendered, without
Markdown marks, and the user must edit the rendered text. The editor must
support CommonMark and GFM: headings, emphasis, strikethrough, links,
autolinks, images, lists, task lists, quotes, GitHub alerts (`> [!NOTE]`),
code blocks with syntax colors, tables and thematic breaks; standard
footnotes; the front matter; HTML and comments as raw parts that keep their
text.

### R-GEN-009

**The engine.** The engine is ProseMirror, through Tiptap 3. The editor must
meet each requirement through the normal API of the engine, without
workarounds. A requirement that the engine cannot meet in this way leads to
a new engine of its own.

## 3. The round trip of the Markdown text

### R-EDIT-004

**Unchanged blocks.** A block that the user did not change must keep its
text byte for byte, with the blank lines around it, the line ends and the
byte order mark of the file. Syntax that no plugin knows, and HTML, must
become raw parts that keep their text.

### R-EDIT-005

**Changed blocks.** A changed block must be written in the form of the
formatter of Notes: one line for each paragraph, aligned tables, the marks
that the block had (`*` or `_`, the bullet, the fence), and a backslash only
where a character would otherwise start Markdown syntax.

### R-EDIT-006

**Tests of the round trip.** Tests must show: every example of the
CommonMark specification and every file of the test corpus comes back byte
for byte without a change; written new, each shows the same HTML; a change
of one block changes only the text of that block.

## 4. Interaction

### R-GEN-003

**The interaction of a document editor.** The editor must work as the
document editor of Claude Desktop and of Claude on the web. It must have a
toolbar, an insert menu "+", and slash commands: `/` in the text opens the
same list of items, and typed words filter it. It must have handles to move
blocks, and find and replace. Its code is original: no code and no design
file of the Claude interface is copied. *(proposal)* The toolbar holds undo
and redo, the text style and the list of the block of the cursor, the
insert menu, find and replace, and the switches of the mode to learn
Markdown and of read-only mode. Ctrl+F opens find and replace; Alt+Up and
Alt+Down move the block of the cursor (Cmd in place of Ctrl on macOS).

### R-EDIT-007

**The format bar.** A format bar must show over selected text, with these
buttons:

| Button | Markdown in the file | From |
| --- | --- | --- |
| Comment | A note on the selected text | Notes |
| Reaction | An answer of a note that is one emoji | Notes |
| Text style | Paragraph, heading 1 to 6 (`#`), quote (`>`), code block | Library |
| Bold | `**text**` | Library |
| Italic | `*text*` | Library |
| Underline | `<ins>text</ins>` *(proposal, [open question 1](#10-open-questions))* | Library |
| Strikethrough | `~~text~~` | Library |
| Code | `` `text` `` | Library |
| Color | *([open question 1](#10-open-questions))* | Notes |
| List | `-`, `1.`, `- [ ]` | Library |
| Link | `[text](address)` | Library |

A button whose function comes from an extension must show only when that
extension is active. An extension may add buttons, for example "Cite" of
Paper. A button must show as active when the whole selection has its format.
Bold, italic, strikethrough, code and link must have the keys Ctrl+B,
Ctrl+I, Ctrl+Shift+S, Ctrl+E and Ctrl+K (Cmd on macOS).

## 5. Tables

### R-EDIT-008

**Handles and markers.** Over a row, a handle must show at its left edge;
over a column, at its top edge. A click on a handle selects the row or the
column and opens the table menu; a drag moves it. Over the border between
two rows or two columns, a marker "+" must show; a click inserts a row or a
column there. Tab in the last cell adds a row.

### R-EDIT-009

**The table menu.** The table menu must insert a row above or below and a
column left or right, move, set the width of a column, delete a row, a
column or the table, sort a column, align a column, color cells, switch the
header row, and insert items. Sort must keep the header row, compare numbers
as numbers, and compare text in the order of the language of the document.
Align must write the alignment of the column into the delimiter row of GFM
(`:---`, `:---:`, `---:`). *(proposal)* Sort puts numbers before texts and
empty cells last; the language of the document is the key `lang` of the
front matter, else the language that the integrating code gives. Each
command of the table menu is one step of undo.

### R-EDIT-010

*(proposal)* **What GFM cannot store.** A cell color is a comment at the
start of the cell, `<!--cell red-->`; the widths of the columns are a
comment on the line before the table, `<!-- table: widths=30,70 -->`, in
percent of the width of the text. The colors are gray, red, orange, yellow,
green, blue and purple. Lists
in cells, a dropdown and a table without a header row are not in version 1.

## 6. Read-only mode and generated parts

### R-GEN-008

**Read-only mode.** A button must switch the editor between editing and
reading. The code that integrates the library decides whether the button is
available at all and in which mode the editor starts, so that it can make
the editor a viewer only, also through a setting of its user. In read-only
mode, the format bar must show only the buttons that do not change the text,
such as Comment of Notes.

### R-EDIT-011

**Generated parts are read-only.** A part of the text that a plugin
generates must be read-only in the editor. Generated parts are, for
example, the text of a citation, the reference list, the text of a
reference to a section, a figure, a table or a listing, the number in a
caption, the generated lists (table of contents, lists of figures, tables
and listings) and the code of a listing from a source file. The user cannot
type in a generated part, delete a piece of it or paste into it. The user
changes it through what it is generated from, for example the entry of a
source in the database, a caption, a heading or the source file of a
listing, and the plugin then writes the part again. The plugin that
generates a part marks it as read-only through the plugin API
([R-PLUGIN-001](plugins.md#r-plugin-001)). A change from outside, for
example by the formatter, may change a generated part
([R-SRC-002](source.md#r-src-002)). *(proposal)* The cursor jumps over a
generated part, and the user deletes it only as a whole, in one step of
undo. A plugin may give a form for the data of a generated part, for
example the page of a citation. Ctrl+click on a reference goes to its
target.

## 7. Mode to learn Markdown

### R-GEN-013

**A mode to learn Markdown.** When the user switches this mode on, the
editor must show the Markdown marks under the rendered text, for example
`**` around bold text and `#` before a heading. The marks must be the marks
of the file: for a block that the user did not change, the marks that the
file has, for example `__` when the file writes bold with underscores. The
marks must not be part of the text: they do not change the document, the
cursor jumps over them, and copying copies the rendered text. The
integrating code has a setting for the mode, and the user has a toggle. An
extension of the level "render and edit" gives the marks of its own nodes.
*(proposal)* The marks show in a muted color in the whole document and in
full color in the block of the cursor.

## 8. Front matter form

### R-FM-001

**Structured editor of the front matter.** The editor must show the front
matter as a form, not as text, for every Markdown file and for every format
of [R-SRC-003](source.md#r-src-003). Notes and Paper add only their own
parts.

### R-FM-002

**Read-only mode of the form.** In the read-only mode, the keys are fixed:
the user changes only values, and only where the schema allows it. The
schema defines what the front matter must hold, which keys the user can
edit, and which values each key allows.

### R-FM-003

**Edit mode of the form.** In the edit mode, the user also adds and removes
keys and structured values, such as lists and maps, also nested. A button
switches between the modes.

### R-FM-004

**JSON schemas.** The schema of a front matter is a JSON file. Each layout
has a schema of the front matter of its documents. *(proposal)* The schema
is standard JSON Schema (draft 2020-12) without keywords of its own:
`required`, `title`, `description`, `readOnly`, `enum`, `type`, `pattern`,
`format`, `minimum`, `default`, and the order of `properties`. A validator
without eval checks it, because the page policy of a webview of VS Code
forbids eval.

### R-FM-005

**An edit changes only its value.** An edit must change only the edited
value: comments, order and quotes of the other keys stay, and each edit is
one step of undo. *(proposal)* The libraries `yaml`,
`@decimalturn/toml-patch` and `jsonc-parser` do this for YAML, TOML and
JSON.

### R-FM-006

**Inputs of plugins.** A plugin may give the input of a key, for example
Paper for `layout` and `repos`: read-only, and Ctrl+click opens the clone.

## 9. Threads beside the text

### R-GEN-014

**Threads beside the text.** The editor must be able to show an icon beside
each passage that has a thread, for example a note or an AI chat. A click on
the icon opens the thread beside the text. The code that integrates the
library decides whether it uses these icons or a view of its own: in VS
Code, Notes can show the threads in its side view; on a web page, the icons
beside the text show them. The icons are code of this project.

## 10. Open questions

1. Format bar: underline as `<ins>text</ins>` (proposal) or no underline?
   "Color" as the colors of the highlights of Notes (proposal) or as a color
   of the text in HTML ([R-EDIT-007](#r-edit-007))?
2. Tables: are the two comments for cell colors and column widths right
   ([R-EDIT-010](#r-edit-010), proposal)? Is a dropdown needed?
3. Mode to learn Markdown: all marks muted plus the block of the cursor in
   full color (proposal), or only the marks at the cursor
   ([R-GEN-013](#r-gen-013))? Can the user edit the marks directly
   (proposal: no)?
4. Front matter form ([R-FM-003](#r-fm-003)): does a file without a schema
   open in the edit mode (proposal: yes)?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
