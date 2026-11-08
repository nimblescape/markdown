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
normative in the same way.

## 1. General

### R-GEN-002

**One view to read and to edit.** The libraries replace the visual editor
of Markdown Notes and the Markdown preview of VS Code. The clean editing
view of Markdown Notes stays beside them: it is the text-only editor that
keeps the format of the file, and the view to learn Markdown
([decision 67](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#decisions)
of Markdown Notes).

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
[section 8](#8-threads-beside-the-text)), the text editor of a platform or a
code editor for source code, the form of the front matter
([section 7](#7-front-matter-form)), and the AI ([ai.md](ai.md)), which
proposes changes.

Each editor of a file shares the source of the file
([R-SRC-001](source.md#r-src-001)) and has an ID in it. The rendered
Markdown editor gives each change of the user to the source as a change
with the origin `user` and its ID, and takes each change with another
origin: it parses the new text and replaces only the top-level blocks whose
text or node changed ([R-SRC-002](source.md#r-src-002)), so that the cursor
and the views of the other blocks stay. A change from outside does not
enter Undo of the editor, and Undo keeps the steps of the user. The
rendered editor gives the source its selection as the range of the text of
the top-level blocks that the selection touches, because a place in rendered
text has no exact place in the Markdown text in general.

## 2. The rendered Markdown editor

### R-EDIT-003

**Rendered Markdown.** The editor must show Markdown rendered, without
Markdown marks, and the user must edit the rendered text. The editor must
support CommonMark and GFM: headings, emphasis, strikethrough, links,
autolinks, images, lists, task lists, quotes, GitHub alerts (`> [!NOTE]`),
code blocks with syntax colors, tables and thematic breaks; standard
footnotes; the front matter; HTML and comments as raw parts that keep their
text. The syntax colors of code blocks come from highlight.js through
lowlight, with the common languages of highlight.js, the same as in the
renderer ([R-REN-001](rendering.md#r-ren-001)). A code
block without a language that highlight.js knows has no colors, as on
GitHub. The colors come from six variables `--nsmd-syntax-*` (keyword,
string, constant, title, type, comment), which take the palette of seven
colors of the theme ([R-THEME-001](platforms.md#r-theme-001)), so that they
follow the light and the dark theme and the theme of VS Code.

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
file of the Claude interface is copied. The toolbar holds undo
and redo, the text style and the list of the block of the cursor, the
insert menu, find and replace, and the switch of read-only mode. Ctrl+F opens find and replace; Alt+Up and
Alt+Down move the block of the cursor (Cmd in place of Ctrl on macOS).

The slash commands have the same names and the same results as the slash
commands of the text editor of the platform, for example of the clean
editing view of Markdown Notes
([decision 79](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#decisions)).
The list shows the name of each item at its right, and the typed name finds
the item of that name first:

| Name | Item |
| --- | --- |
| `/text` | Text (paragraph) |
| `/h1` to `/h6` | Heading 1 to 6 |
| `/bullets`, `/numbers`, `/tasks` | Bulleted list, numbered list, task list |
| `/quote`, `/code` | Quote, code block |
| `/table`, `/divider`, `/image` | Table, divider, image |
| `/alert` | The GitHub alerts Note, Tip, Important, Warning and Caution |
| `/footnote` | Footnote |

A plugin adds its own slash commands, and an item of a plugin with the id
of an item of the editor takes its place, for example a table with its
caption ([R-PLUGIN-001](plugins.md#r-plugin-001)). A command on selected
text, for example adding a note, shows only after a slash typed on selected
text: the slash goes after the text, which stays and stays marked while the
list is open, and the command gets the text selected again. The other items
show only without selected text, and the other menus have no commands on
selected text. Without commands on selected text, a slash replaces selected
text as any typed character does.

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
| Underline | `<ins>text</ins>` | Library |
| Strikethrough | `~~text~~` | Library |
| Code | `` `text` `` | Library |
| Color | A highlight of Notes in one of its colors | Notes |
| List | `-`, `1.`, `- [ ]` | Library |
| Link | `[text](address)` | Library |

A button whose function comes from an extension must show only when that
extension is active. An extension may add buttons, for example "Cite" of
Paper. A button of an extension may also show only where it
applies, for example "Research" of Paper only in a paper. A button must show
as active when the whole selection has its format.
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
(`:---`, `:---:`, `---:`). Sort puts numbers before texts and
empty cells last; the language of the document is the key `lang` of the
front matter, else the language that the integrating code gives. Each
command of the table menu is one step of undo.

### R-EDIT-010

**What GFM cannot store.** A cell color is a comment at the start of the
cell, `<!--cell red-->`; the widths of the columns are a
comment on the line before the table, `<!-- table: widths=30,70 -->`, in
percent of the width of the text. The colors are gray, red, orange, yellow,
green, blue and purple. Lists
in cells, a dropdown and a table without a header row are not in version 1.

## 6. Read-only mode, generated parts and rendered changes

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
([R-SRC-002](source.md#r-src-002)). The cursor jumps over a
generated part, and the user deletes it only as a whole, in one step of
undo. A plugin may give a form for the data of a generated part, for
example the page of a citation. Ctrl+click (Cmd+click on macOS) on a
reference goes to its target. A generated part has a gray background, the
token `--nsmd-readonly`, so that the user sees that it is read-only; a part
that holds whole blocks has it on the blocks, and a read-only value of the
form of the front matter ([R-FM-003](#r-fm-003)) has it too, also one that
the input of a plugin shows. On a platform,
the token comes from its theme; in VS Code it is the color of read-only
parts of Markdown Notes, which its text editor that keeps the format of the
file uses for the same parts
([R-TEXT-009](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-text-009)
of Markdown Notes).

A selection that touches a generated part holds the whole
part. The user cannot change the format of a piece of a part. Backspace and
Delete next to a part delete the whole part. Text that the user types at the
edge of a part does not become a piece of the part. Replace leaves a match
that holds a piece of a part. A double click on a part opens its form. A
part can hold whole blocks, for example the code block of a listing: the
cursor then stays in the text before or after it, and Backspace at the start
of the text after it and Delete at the end of the text before it delete the
whole part.

### R-EDIT-012

**Rendered changes.** The editor must show the changes of its text against
another version of the text, for one side of a diff that shows two editors
side by side, the older version on the left and the newer version on the
right (`showChanges`). The diff of VS Code is such a diff
([R-VSC-009](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-vsc-009) of Markdown Notes).

- Each side marks its changes: the left side the removed blocks with a red
  background, the right side the new blocks with a green background, and
  in a changed block the removed or the new words. The editor compares the
  top-level blocks of both sides with the array diff of the library `diff`
  ([R-SRC-002](source.md#r-src-002)); a changed block pairs with the
  similar block of the same kind on the other side, and the editor compares
  the words of such a pair with the word diff. The marks change no text.
- The blocks of both sides line up: where one side has blocks that the
  other side does not have, or a block of one side is higher, the other
  side shows an empty, hatched space of the same height. Both sides scroll
  together: each side gives its heights and its scroll place, and takes
  those of the other side.
- Each new text of a side updates the marks of both sides.
- The editor goes to the previous and to the next change on both sides.

## 7. Front matter form

### R-FM-001

**Structured editor of the front matter.** The editor must show the front
matter as a form, not as text, for every Markdown file and for every format
of [R-SRC-003](source.md#r-src-003). Notes and Paper add only their own
parts. The front matter stays the first block of the file: it
has no handles of a block, no block moves before it, and Backspace does not
remove it; a new text, select all and undo may remove it. A front matter
that does not parse shows its text with the problem, and the user edits the
text. In the read-only mode of the editor ([R-GEN-008](#r-gen-008)), the
form shows the values as text. The integrating code may show the text in place of the form.
The clean editing view of Notes, a text editor, edits the front matter as
text with the same rules: the keys of the schema and the read-only values
stay, only the text after a key changes, and the problems of the schema
show as warnings
([R-TEXT-009](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-text-009)
of Notes).

### R-FM-002

**Read-only mode of the form.** In the read-only mode, the keys are fixed:
the user changes only values, and only where the schema allows it. The
schema defines what the front matter must hold, which keys the user can
edit, and which values each key allows. A file with a schema
opens in the read-only mode. The form shows the keys of the schema in the
order of `properties`, then the other keys of the file. A key of the schema
that the file does not have shows as an empty field; a value in it adds the
key after the key before it in the order of the schema. The user adds and
removes the items of a list that the schema defines. A value that the schema
marks `readOnly` stays read-only in both modes.

### R-FM-003

**Edit mode of the form.** In the edit mode, the user also adds keys and
structured values, such as lists and maps, also nested, and renames and
removes them. A key that the schema names stays in both modes: the user
changes its value, but does not rename or remove it; only the other keys
of the file, also in a map of the schema, get a new name or go. An empty
value keeps its key: a key goes only with the button that removes it. A
button switches between the modes. A file without a schema opens in
the edit mode. A new key gets one of the kinds
text, number, yes or no, list, or group of keys.

### R-FM-004

**JSON schemas.** The schema of a front matter is a JSON file. Each layout
has a schema of the front matter of its documents. The schema
is standard JSON Schema (draft 2020-12) without keywords of its own:
`required`, `title`, `description`, `readOnly`, `enum`, `type`, `pattern`,
`format`, `minimum`, `default`, and the order of `properties`. A validator
without eval checks it, because the page policy of a webview of VS Code
forbids eval. The validator is the library
`@cfworker/json-schema`. A key with an empty value counts as a key without
a value: a required key with an empty value is a problem, and an empty value
of another key is none. Each problem shows at its value with a message in
plain words, and the head of the form counts the problems. The integrating
code gives the schema and can change it, for example after a change of the
layout.

### R-FM-005

**An edit changes only its value.** An edit must change only the edited
value: comments, order and quotes of the other keys stay, and each edit is
one step of undo. For YAML, the library `yaml` gives the
place of each value, and the edit replaces only the lines of that value; a
value inside a flow collection, for example `[a, b]`, changes the text of
that collection. For TOML, the library `@decimalturn/toml-patch` changes the
text. For JSON, the library `jsonc-parser` replaces a value, and own code
inserts and removes keys and items line by line. A new text keeps the
quotes of the text that it replaces. The edits are code of the source
([R-SRC-003](source.md#r-src-003)); the form uses them.

### R-FM-006

**Inputs of plugins.** A plugin may give the input of a key, for example
Paper for `layout` and `repos`: read-only, and Ctrl+click (Cmd+click on
macOS) opens the clone.
The input of a plugin takes the place of the input of the form
in both modes.

### R-FM-007

**Values of the front matter in the text.** The text can hold the value of
a key of the front matter between two hidden markers:

```markdown
This is <wbr><!--{title}-->A paper<!--{/title}--> of <wbr><!--{author.name}-->Hannes Stauss<!--{/author.name}-->.
```

The key of a value under another key is the path of the keys with `.`, for
example `author.name`. The renderer shows only the value, as GitHub does.
The editor hides the markers and shows the value as a generated part
([R-EDIT-011](#r-edit-011)). A formatter writes the current value of the
key between the markers, for example the formatter of Notes, which also
inserts such values with `/ref` ([R-NOTES-001](plugins.md#r-notes-001)).
A start marker and an end marker count only as a pair of the
same key in one line. The value is read-only only when the front matter has
its key; the value of another key is text that the user edits. Ctrl+click
(Cmd+click on macOS) on a read-only value goes to the input of its key in
the form. The text of a value is in one line, a list of texts, numbers or
yes and no is its items, joined by commas, and the path of a key in a map
in a list has the index of the item, for example `authors.0.name`. The
source gives these values (`frontMatterValues`), also for formatters.

## 8. Threads beside the text

### R-GEN-014

**Threads beside the text.** The editor must be able to show an icon beside
each passage that has a thread, for example a note or an AI chat. A click on
the icon opens the thread beside the text. The code that integrates the
library decides whether it uses these icons or a view of its own: in VS
Code, Notes can show the threads in its side view; on a web page, the icons
beside the text show them. The icons are code of this project.

The icons stand at the right of the text, beside the first
line of the passage, with the number of answers. The panel of a thread opens
beside the text at the height of the passage and marks the passage; the
plugin of the thread fills the panel. The close button, Escape and a second
click on the icon close it.

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
