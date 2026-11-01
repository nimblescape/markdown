<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Specification

This specification defines the libraries of nimblescape Markdown: how they
keep, edit, render, lay out and record text documents, Markdown first, on
several platforms. It is normative. "Must" marks a requirement, "should" a
recommendation, and "may" an option. A requirement marked *(proposal)* is
not decided yet; [section 14](#14-open-questions) lists these open questions
with the proposal for each. Each requirement has an ID as its heading, so
that code, tests and pull requests can link to it, for example
`[R-GEN-001](docs/specification.md#r-gen-001)`. The [plan](#plan) at the end
shows the steps of the build and their state.

## 1. Scope

### R-GEN-001

**General libraries for text documents.** nimblescape Markdown is a set of
general libraries for text documents. Markdown is the first format. The
source, the history and the platforms also work for any other text, for
example source code. The target platforms are VS Code and the web, with the
same code; the command line is a platform for output without a view, for
example `mp build` of nimblescape Markdown Paper. Today the libraries are
one npm package, `@nimblescape/markdown` ([R-ARCH-002](#r-arch-002)).
nimblescape Markdown Notes and nimblescape Markdown Paper are format
extensions: they add their parts through plugins ([section
9](#9-plugins-and-format-extensions)), and they decide where they use the
libraries ([R-GEN-004](#r-gen-004)).

### R-GEN-002

**One view to read and to edit.** The libraries replace the clean editing
view and the visual editor of Markdown Notes and the Markdown preview of VS
Code.

## 2. Terms

| Term | Meaning |
| --- | --- |
| Source | The text of a file, the selections in it, and the changes to it |
| Editor | A part that shows the text in a form that the user changes |
| Renderer | A part that turns the text into content without edit functions |
| Layout | A part that puts rendered content into a layout: styles, templates, pages, PDF |
| History | A part that records every action on a text, saves it, replays it and evaluates it |
| Backend | A plugin of the history that stores the steps of a history and reads them back |
| Platform adapter | The code that connects the libraries to one platform, for example VS Code |
| Plugin | An object that adds functions to one part |
| Format extension | The plugins of one file format for all parts, for example Markdown Notes |
| Step | One recorded action of the history |
| Origin | Who made a change: the user, the AI, or another program |
| Intellectual origin | Work that creates content of its own: ideas, claims and their phrasing, structure, design, new code |
| Mechanics | Work that applies given rules or finds given things: formatting, search, literature research |

## 3. Architecture

| Part | What it does |
| --- | --- |
| Source | Holds the text of a file and the selections. Applies each change as a text patch with its origin, and sends it to the other parts. |
| Editor | Shows the text in a form that the user edits, and turns each edit into a change of the text. |
| Renderer | Turns the text into content without edit functions: HTML, with a view for each kind of token. |
| Layout | Puts the content of the renderer into a layout: styles, title page and templates, numbers, generated lists, pages, PDF. |
| History | Records every action with its origin, saves it through a pluggable backend, replays it, back and forward, and evaluates it. |
| Platform | Connects the libraries to one platform, and decides how each function is shown and used there. |

### R-GEN-015

**Six pluggable parts.** The system must consist of the six parts of the
table above, and each part must take plugins. The functions and their state
must be in the libraries, the same on every platform; no part except the
platform adapter may use an API of a platform directly. The platform adapter
must stay thin: it connects the libraries to the views, commands, settings
and storage of its platform, and it decides how a function is shown and
used. For example, the threads of notes show in the side view of Notes in VS
Code and as icons beside the text on a web page ([R-GEN-014](#r-gen-014)).

### R-ARCH-001

**The text is the only truth.** The text of the file is the single
authoritative state. Every change, by the user in any editor, by the AI or
by another program, must be a change of the text, applied through the
source. The source must send every change to all open editors and renderers
and to the history.

### R-GEN-010

**One rendering.** The rendering code must exist once: the rendered view in
the editor, the pages and the PDF must use the same views of the same
plugins. *(proposal)* The editor is built on the renderer: it shows each
block with the view of the renderer and adds the edit functions; the
renderer and the layout run without the editor.

### R-ARCH-002

*(proposal)* **One npm package for each part:** `@nimblescape/text`
(source), `@nimblescape/editor` (the editor API and the rendered Markdown
editor), `@nimblescape/render` (renderer), `@nimblescape/layout` (layout,
pages, PDF), `@nimblescape/history` (history), and one package for each
platform, `@nimblescape/vscode` and `@nimblescape/web`. Until the API
between the parts reaches version 1, they live in one repository as npm
workspaces.

## 4. Source

### R-SRC-001

**Text, selections and changes.** The source must hold the text of a file
and the selections of every editor of the file. It must apply each change as
a text patch with its origin: user, AI or other program. It must read and
save the file through the platform adapter.

### R-SRC-002

**Changes from outside.** A change from outside, for example by Git, a
formatter, an AI agent or another program, must reach every open editor as a
change of the text. An editor must then replace only the parts whose text
changed, and keep the cursor.

### R-SRC-003

**Front matter.** The source must recognize a front matter at the start of a
file in YAML (between two lines `---`), in TOML (between two lines `+++`)
and in JSON (an object at the start of the file). A plugin may add a further
format.

### R-GEN-006

**The file formats.** The source must keep every part of a file that no
plugin knows, so that a file stays intact. Notes and Paper extend the file
format with their parts through plugins ([section
9](#9-plugins-and-format-extensions)). Plugins of the source are, for
example, the formatter of Notes, the check of the front matter against its
schema, and the detection of the format of a file (the comment of the format
of Notes, the layout of Paper).

## 5. Editor

### 5.1 General

#### R-EDIT-001

**Changes with their origin.** An editor must turn each edit into a change
of the text with its origin: "user" for an edit of the user, "AI" for a
proposed change of the AI that the user accepts. Undo and redo must undo and
redo one step for each action of the user, for example a typed word, a menu
command or a moved row.

#### R-EDIT-002

**Several editors of one file.** Several editors may show one file at the
same time, for example the rendered editor and the text editor beside it. An
edit in one must show at once in the others. Editors are, for example, the
rendered Markdown editor ([5.2](#52-the-rendered-markdown-editor) to
[5.9](#59-threads-beside-the-text)), the text editor of a platform or a code
editor for source code, the form of the front matter
([5.8](#58-front-matter-form)), and the AI ([section 10](#10-ai)), which
proposes changes.

### 5.2 The rendered Markdown editor

#### R-EDIT-003

**Rendered Markdown.** The editor must show Markdown rendered, without
Markdown marks, and the user must edit the rendered text. The editor must
support CommonMark and GFM: headings, emphasis, strikethrough, links,
autolinks, images, lists, task lists, quotes, GitHub alerts (`> [!NOTE]`),
code blocks with syntax colors, tables and thematic breaks; standard
footnotes; the front matter; HTML and comments as raw parts that keep their
text.

#### R-GEN-009

**The engine.** The engine is ProseMirror, through Tiptap 3. The editor must
meet each requirement through the normal API of the engine, without
workarounds. A requirement that the engine cannot meet in this way leads to
a new engine of its own.

### 5.3 The round trip of the Markdown text

#### R-EDIT-004

**Unchanged blocks.** A block that the user did not change must keep its
text byte for byte, with the blank lines around it, the line ends and the
byte order mark of the file. Syntax that no plugin knows, and HTML, must
become raw parts that keep their text.

#### R-EDIT-005

**Changed blocks.** A changed block must be written in the form of the
formatter of Notes: one line for each paragraph, aligned tables, the marks
that the block had (`*` or `_`, the bullet, the fence), and a backslash only
where a character would otherwise start Markdown syntax.

#### R-EDIT-006

**Tests of the round trip.** Tests must show: every example of the
CommonMark specification and every file of the test corpus comes back byte
for byte without a change; written new, each shows the same HTML; a change
of one block changes only the text of that block.

### 5.4 Interaction

#### R-GEN-003

**The interaction of a document editor.** The editor must work as the
document editor of Claude Desktop and of Claude on the web. It must have a
toolbar, an insert menu "+", and slash commands: `/` in the text opens the
same list of items, and typed words filter it. It must have handles to move
blocks, and find and replace. Its code is original: no code and no design
file of the Claude interface is copied.

#### R-EDIT-007

**The format bar.** A format bar must show over selected text, with these
buttons:

| Button | Markdown in the file | From |
| --- | --- | --- |
| Comment | A note on the selected text | Notes |
| Reaction | An answer of a note that is one emoji | Notes |
| Text style | Paragraph, heading 1 to 6 (`#`), quote (`>`), code block | Library |
| Bold | `**text**` | Library |
| Italic | `*text*` | Library |
| Underline | *(open question 15)* | Library |
| Strikethrough | `~~text~~` | Library |
| Code | `` `text` `` | Library |
| Color | *(open question 15)* | Notes |
| List | `-`, `1.`, `- [ ]` | Library |
| Link | `[text](address)` | Library |

A button whose function comes from an extension must show only when that
extension is active. An extension may add buttons, for example "Cite" of
Paper. A button must show as active when the whole selection has its format.
Bold, italic, strikethrough, code and link must have the keys Ctrl+B,
Ctrl+I, Ctrl+Shift+S, Ctrl+E and Ctrl+K (Cmd on macOS).

### 5.5 Tables

#### R-EDIT-008

**Handles and markers.** Over a row, a handle must show at its left edge;
over a column, at its top edge. A click on a handle selects the row or the
column and opens the table menu; a drag moves it. Over the border between
two rows or two columns, a marker "+" must show; a click inserts a row or a
column there. Tab in the last cell adds a row.

#### R-EDIT-009

**The table menu.** The table menu must insert a row above or below and a
column left or right, move, set the width of a column, delete a row, a
column or the table, sort a column, align a column, color cells, switch the
header row, and insert items. Sort must keep the header row, compare numbers
as numbers, and compare text in the order of the language of the document.
Align must write the alignment of the column into the delimiter row of GFM
(`:---`, `:---:`, `---:`).

#### R-EDIT-010

*(proposal)* **What GFM cannot store.** A cell color is a comment at the
start of the cell, `<!--cell red-->`; the widths of the columns are a
comment on the line before the table, `<!-- table: widths=30,70 -->`. Lists
in cells, a dropdown and a table without a header row are not in version 1.

### 5.6 Read-only mode

#### R-GEN-008

**Read-only mode.** A button must switch the editor between editing and
reading. The code that integrates the library decides whether the button is
available at all and in which mode the editor starts, so that it can make
the editor a viewer only, also through a setting of its user. In read-only
mode, the format bar must show only the buttons that do not change the text,
such as Comment of Notes.

### 5.7 Mode to learn Markdown

#### R-GEN-013

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

### 5.8 Front matter form

#### R-FM-001

**Structured editor of the front matter.** The editor must show the front
matter as a form, not as text, for every Markdown file and for every format
of [R-SRC-003](#r-src-003). Notes and Paper add only their own parts.

#### R-FM-002

**Read-only mode of the form.** In the read-only mode, the keys are fixed:
the user changes only values, and only where the schema allows it. The
schema defines what the front matter must hold, which keys the user can
edit, and which values each key allows.

#### R-FM-003

**Edit mode of the form.** In the edit mode, the user also adds and removes
keys and structured values, such as lists and maps, also nested. A button
switches between the modes.

#### R-FM-004

**JSON schemas.** The schema of a front matter is a JSON file. Each layout
has a schema of the front matter of its documents. *(proposal)* The schema
is standard JSON Schema (draft 2020-12) without keywords of its own:
`required`, `title`, `description`, `readOnly`, `enum`, `type`, `pattern`,
`format`, `minimum`, `default`, and the order of `properties`. A validator
without eval checks it, because the page policy of a webview of VS Code
forbids eval.

#### R-FM-005

**An edit changes only its value.** An edit must change only the edited
value: comments, order and quotes of the other keys stay, and each edit is
one step of undo. *(proposal)* The libraries `yaml`,
`@decimalturn/toml-patch` and `jsonc-parser` do this for YAML, TOML and
JSON.

#### R-FM-006

**Inputs of plugins.** A plugin may give the input of a key, for example
Paper for `layout` and `repos`: read-only, and Ctrl+click opens the clone.

### 5.9 Threads beside the text

#### R-GEN-014

**Threads beside the text.** The editor must be able to show an icon beside
each passage that has a thread, for example a note or an AI chat. A click on
the icon opens the thread beside the text. The code that integrates the
library decides whether it uses these icons or a view of its own: in VS
Code, Notes can show the threads in its side view; on a web page, the icons
beside the text show them. The icons are code of this project.

## 6. Renderer

### R-REN-001

**Content without edit functions.** The renderer must turn the text into
content without edit functions: HTML, with a view for each kind of token. It
must use markdown-it 14, the version of the Markdown preview of VS Code,
with footnotes and task lists.

### R-REN-002

**Plugins of the renderer.** A plugin of the renderer must be able to add
syntax with the function `extendMarkdownIt(md)`, as in VS Code, so that a
markdown-it plugin works in VS Code and in the renderer without a change. It
may add styles, and a view for each new kind of token: the HTML of the
markdown-it plugin, or a function `render(source, element)`. Examples:
diagrams of PlantUML and Mermaid, math, GitHub alerts, syntax colors for
source code, and the removal of the notes from the output.

### R-REN-003

*(proposal)* **The renderer without the editor.** The renderer runs without
the editor, so that the command line needs no editor code.

## 7. Layout

### R-LAYOUT-001

**Layouts.** The layout must put the content of the renderer into a layout:
styles, title page and templates, the numbers of headings, figures and
tables, the generated lists (table of contents, lists of figures, tables and
listings, the reference list), pages and PDF. Layouts are content, for
example the layout `plain` and the layouts of PHT. Each layout has a JSON
schema of the front matter of its documents ([R-FM-004](#r-fm-004)).

### R-LAYOUT-002

**The PDF is the view.** The PDF must come from the same rendering as the
view, so that the view and the PDF never differ ([R-GEN-010](#r-gen-010)).

### R-LAYOUT-003

*(proposal)* **Pages.** The page engine is Paged.js. A button switches the
editor between "Edit" and "Pages"; in "Pages", the highlights of the notes
and "Add Note" work, and a double click on a page goes to that place in
"Edit".

## 8. History

### R-AI-004

**A history of every action.** The history must record every action on a
text document, in its order, as a saved history of undo and redo. It must
work for every text document, also for source code, and depend only on the
source. The history must stay after the file is closed.

### R-HIST-001

**Steps.** Each action is one step:

- an edit: typed text grouped as the undo of an editor groups it, for
  example a word or a pause; a command, for example a moved row;
- a selection: the selected text; a move of the cursor without selected text
  is no step;
- a question to the AI: the prompt, the selection and the context that the
  AI got, the provider and the model;
- an answer of the AI: its text and the changes that it proposes;
- the decision of the user on a proposed change: accepted or rejected.

Each step must record its time, its author and its origin: user, AI or other
program. A change of the user to text that the AI wrote is an edit of the
user. An editor or an AI tool that uses the history reports its own edits; a
change by another program gets the origin "other program", and the user may
mark it as an edit of the AI.

### R-HIST-002

**Storage backends.** The history must save its steps through a storage
backend, and the backends must be pluggable. A backend stores the log of the
steps of a document and has one small interface: append steps, read the
steps from a given step on, and list and delete the histories that it holds.
Every backend must store the same steps in the same form, so that a history
can move from one backend to another. The integrating code chooses the
backend for each document, and a setting of the user may choose it. A
backend uses the platform adapter for files and storage, and no platform API
directly. Examples: a file in the repository of the document, which Git
keeps and shares, for example with a supervisor; a local store on the
computer of the user (in VS Code the storage of the extension, on the web
IndexedDB); a server or a database.

### R-HIST-003

**Back and forward.** The user must be able to move back and forward through
the steps. The text and the selection follow, as with undo and redo, and
each position shows the document as it was after that step and the action of
that step: the selection marked, the question and the answer beside the
text, the changes of an edit marked. The history must tell the steps of the
user and the steps of the AI apart, and a view mode must mark the text by
its origin.

### R-HIST-004

**Replay.** Replay must play the steps from the start or from a chosen step,
one after the other. It applies the recorded results and does not ask the AI
again. "Run again" sends a recorded question to the AI as a new question.

### R-HIST-005

**The prompt protocol of Paper.** Markdown Paper uses the history for the
prompt protocol of a paper; `mp build` may add the history, or a list of the
questions to the AI, with the cognitive evaluation
([R-HIST-007](#r-hist-007) to [R-HIST-009](#r-hist-009)), as an appendix of
the PDF.

### R-HIST-006

*(proposal)* **The first backends.** The first backend is a JSON Lines file,
`.nimblescape/history/<path of the file>.jsonl` in the repository of the
document, with one step per line and the change of each edit as a text
patch. A second backend keeps the history in the local store of the
platform. When the user goes back and then acts again, the later steps stay
as a branch.

### R-HIST-007

**Cognitive evaluation.** The history must give a cognitive evaluation of
the protocol: each step that creates or changes content is classified as
intellectual origin or as mechanics, by the work that it does.

- *Intellectual origin:* work that creates content of its own, for example
  an idea, a claim and the phrasing of specific claims, the structure of an
  argument, a design, or new code such as a new function that implements the
  quick sort algorithm.
- *Mechanics:* work that applies given rules or finds given things, without
  content of its own, for example the reference list rewritten in APA 7,
  code formatted, a paper found that supports a given statement, or a
  literature research about "Industrialisierung von Dienstleistungen".

A question to the AI is classified by the work that it asks for; its answer
and the changes that the user accepts carry this class with the origin AI.
Each classification must record its reason, so that a reader can check it.

### R-HIST-008

**Class and origin.** The evaluation must combine the class with the origin
([R-HIST-001](#r-hist-001)): for the user and for the AI, it shows the steps
and the share of the text of each class, for the whole document and for
each section. A view mode must mark the text by its origin and its class.

### R-HIST-009

**The classifier.** The classifier is a plugin of the history and may use an
AI through the provider API ([R-AI-002](#r-ai-002)). *(proposal)* Its rules
are a file with a description and examples of each class: the library
brings default rules with the examples of [R-HIST-007](#r-hist-007), and a
layout of Paper may bring the rules of its institution, for example the
rules of PHT for the use of AI. The classifier classifies each step when the
history records it. A step that holds both classes is split into its parts.
The user may correct a classification with a reason; the correction is a
step of its own, and the protocol shows the classification and the
correction.

## 9. Plugins and format extensions

### R-GEN-005

**Extension through a clean API.** Notes and Paper extend the libraries with
their functions through a documented plugin API. The plugins of each
extension live in the repository of that extension. The libraries hold the
general functions; a plugin adds only the functions of its extension.

### 9.1 Levels of a plugin

#### R-GEN-012

**Extensions that render, or render and edit.** A plugin works at one of two
levels:

- *Render:* a plugin of the renderer ([R-REN-002](#r-ren-002)). The editor
  must keep the text of such a block byte for byte as one unit. The user
  changes it through its source (double click or "Edit source"), and the
  editor then parses this block again.
- *Render and edit:* in addition a plugin of the editor: nodes and marks
  with their views, which token becomes which node or mark, how a changed
  node is written, commands, keys, input rules, items of the menus (insert,
  slash, format bar, block menu, table menu), panels, highlights, the schema
  of the front matter, and the marks for the mode to learn Markdown
  ([R-GEN-013](#r-gen-013)).

A plugin may start with the level "render" and add the level "render and
edit" later, without a change of the file format. The Markdown API of VS
Code (`markdown.markdownItPlugins`, `markdown.previewStyles`,
`markdown.previewScripts`) is the reference of the plugin API.

#### R-PLUGIN-001

**The plugin object.** A plugin is one object: `{ name, apiVersion: 1,
extendMarkdownIt?, styles?, render?, nodes?, marks?, fromMarkdown?,
toMarkdown?, commands?, keys?, menus?, frontMatterSchema?, activate?(editor,
host) }`. `activate` gets the API of the editor and of the platform, and
returns what to dispose.

### 9.2 Markdown Notes

#### R-NOTES-001

**The plugins of Notes.** Notes adds the notes: highlights in colors with
hidden markers, the hidden form, and the comment of the format, hidden. It
adds the threads of the notes ([R-GEN-014](#r-gen-014)), the number of
answers beside a block, "Add Note", and the buttons Comment and Reaction
([R-EDIT-007](#r-edit-007)). It adds its formatter to the source and the
removal of the notes from the output to the renderer. Notes integrates the
AI chat as notes ([R-AI-001](#r-ai-001)).

### 9.3 Markdown Paper

#### R-PAPER-001

**The plugins of Paper.** Paper adds the schema of the front matter of the
layout, and `layout` and `repos` read-only with Ctrl+click to the clone
([R-FM-006](#r-fm-006)). It adds citations: `/cite` with Zotero,
`/research`, the hidden comment of the sources, and the hidden codes of the
special sections. It adds the generated lists, the layouts, the pages and
the PDF through the layout ([section 7](#7-layout)), and the prompt protocol
through the history ([R-HIST-005](#r-hist-005)).

## 10. AI

### R-AI-001

**AI chats are notes.** The AI chat must work as Claude Code does: it knows
the document, the selection, the front matter with its schema, and the
format rules of the active plugins, and it proposes changes that the user
accepts or rejects. Nothing changes the file before the user accepts it, and
each accepted change is one step of undo with the origin "AI". An AI chat is
a thread of a note of Markdown Notes: the AI answers in the thread as one
more author. Notes integrates the chat; the libraries have no chat of their
own.

### R-AI-002

**Pluggable AI.** A provider API must make any AI pluggable. A provider has
a name, its models, and one function that takes the messages, the context
and the tools and returns a stream of events: text, a proposed change, the
end, or an error. The integrating code registers the providers, and the user
picks one. The first and for now only provider is the Claude API, with
streaming and tool use.

### R-AI-005

**The key stays off the page.** The API key must never reach the page. In VS
Code, the extension host makes the call with the key from the secret storage
of VS Code. On the web, the page calls its own server.

### R-AI-003

**Memory.** The AI must use a memory, so that a decision in a chat has the
context of the other decisions and chats. *(proposal)* The memory is a
folder of the repository of the document, `.notes/memory/`, with one
Markdown file for each subject, read and written through the memory tool of
the Claude API; a second tool searches the other notes and chats.

### R-AI-006

*(proposal)* **Tracked changes.** The editor shows each proposed change as a
tracked change: the removed text struck through, the new text marked, with
"Accept" and "Reject".

## 11. Platforms

### 11.1 General

#### R-PLAT-001

**What the adapter gives.** The adapter of a platform must give the parts
what only the platform has: reading and saving files, a local store of data
on the computer of the user, the views, the theme, the signed-in GitHub
user, secrets such as the AI key, commands and settings, opening a link, and
a message channel from a plugin to its extension.

### 11.2 VS Code

#### R-GEN-004

**The extensions decide where they use it.** The libraries are no VS Code
extension of their own. Notes and Paper bundle them and decide where they
use them. Notes uses the editor for each answer of a note in its side view,
and the editor must also be able to edit a whole file in the editor area. A
setting of the extension chooses which Markdown files open in the editor:
`all`, `notesAndPapers` (files with the comment of the format of Notes or
with a layout) or `none`. *(proposal)* The default is `all`. "Reopen Editor
With" of VS Code always offers the text editor.

#### R-VSC-001

*(proposal)* **A custom text editor.** Notes registers the editor as a
custom text editor of VS Code, so that the file stays a normal text
document: save, the dirty mark, hot exit, Git diffs, the timeline and other
extensions work as for the text editor.

#### R-VSC-002

**Text editor and save.** A button must open the text editor of the same
file to the side. Ctrl+S saves the file; the format on save of Notes runs,
and the editor takes over the changed blocks.

#### R-VSC-003

**Rules of the adapter.** The adapter uses no proposed API, supports
Restricted Mode and virtual workspaces, sends no telemetry and has no
network address of its own. It may require a newer VS Code version than
1.125 when that makes the work simpler.

#### R-VSC-004

**The history in every text editor.** A VS Code extension of the history
records the actions in every text editor of VS Code through the stable API,
and shows the history for any file.

### 11.3 Web

#### R-WEB-001

**A page with the editor.** A page creates the editor with its plugins, its
platform adapter and its theme, for example `createEditor(element, {
markdown, extensions, host, theme })`. The page gives an AI provider that
calls its own server ([R-AI-005](#r-ai-005)).

### 11.4 Command line

#### R-CLI-001

**Output without a view.** The command line renders and lays out a document
without a view, for example `mp build` of Paper.

## 12. Theme

### R-THEME-001

**The variables of the theme.** Every color, font and size must come from
CSS variables with the prefix `--nsmd-`. In VS Code, every color must come
from the active color theme: the adapter maps each variable to a variable
`--vscode-*` of the webview. The palette of seven colors (gray, red, orange,
yellow, green, blue, purple) comes from the chart colors of the theme; Notes
adds teal.

### R-THEME-002

**Themes on the web.** On the web, the editor must be themable: the package
has a light and a dark theme, and "auto" follows the system. A page may
change any variable or bring a theme of its own.

### R-THEME-003

*(proposal)* **Fonts in VS Code.** In VS Code, the text uses the font and
size of the settings of the Markdown preview, and code uses the font of the
editor.

## 13. Libraries, licenses and release

### R-GEN-011

**Available libraries first.** The libraries must use existing open-source
libraries wherever one fits. Own code stays for what no library does. The
license of each library is decided one by one. The file `licenses.json`
lists each package that the libraries need at run time with its decided
license, and CI fails for a package or a license that the file does not
list. The notices go with every bundle. The license of the nimblescape
libraries, MIT today, may change when a library needs it. The libraries in
use:

| Library | License | Use |
| --- | --- | --- |
| Tiptap 3 (`@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit` and the `@tiptap/extension-*` packages of the nodes and marks) | MIT | The rendered editor and its extension API |
| ProseMirror, through `@tiptap/pm` | MIT | The engine of the rendered editor ([R-GEN-009](#r-gen-009)) |
| markdown-it, `markdown-it-footnote` | MIT | Parsing and rendering of Markdown |
| `markdown-it-task-lists` | ISC | Task lists |
| `prosemirror-markdown` | MIT | The bridge between the tokens of markdown-it and the document of the editor |
| `string-width` | MIT | The width of the cells of a table |

### R-GEN-007

**Rules of all nimblescape repositories:**

- This specification is a clean summary: each decision becomes a requirement
  here, in the same change, without the texts of the discussion.
- Code and documents use English terms.
- Nothing is published before the release: no version of an npm package on
  npmjs.com, no version of an extension on the Marketplace, no release tag.
  Other repositories install a package from its GitHub repository at a fixed
  commit.
- The npm packages use the same structure, build and release workflow as the
  other nimblescape npm packages.

## 14. Open questions

1. Architecture: are the six parts of [section 3](#3-architecture) the right
   split?
2. Packages: one repository with one npm package for each part until version
   1 of the API ([R-ARCH-002](#r-arch-002), proposal), or one repository for
   each package from the start?
3. Rendering: is the editor built on the renderer ([R-GEN-010](#r-gen-010),
   proposal), instead of "the renderer is the editor in read-only mode"?
4. Layout: does the layout code of Paper move into the layout part?
5. VS Code: does Notes register the editor as a custom text editor for the
   main view of a file ([R-VSC-001](#r-vsc-001), proposal), and is `all` the
   default of the setting ([R-GEN-004](#r-gen-004))?
6. Split of functions: standard footnotes in the libraries (proposal: yes);
   captions with numbers, `/ref` and listings stay in Notes in version 1
   (proposal: yes); the values of the front matter in the text in the
   libraries (proposal: yes); the form of the front matter replaces the view
   "Front Matter" of Paper (proposal: yes).
7. Tables: are the two comments for cell colors and column widths right
   ([R-EDIT-010](#r-edit-010), proposal)? Is a dropdown needed?
8. Schema of a layout: the file `frontmatter.schema.json` in the layout
   folder, named in `layout.json`, replaces the field `fields` (proposal).
   Does a file without a schema open in the edit mode (proposal: yes)?
9. Fonts: the fonts of the settings of the Markdown preview in VS Code
   ([R-THEME-003](#r-theme-003), proposal)?
10. Names: the contribution point `nimblescape.markdown.extensions` and the
    npm names of [R-ARCH-002](#r-arch-002) (proposal)?
11. Pages: the switch between "Edit" and "Pages"
    ([R-LAYOUT-003](#r-layout-003), proposal)?
12. AI: tracked changes for proposed changes ([R-AI-006](#r-ai-006),
    proposal)? The memory in the repository of the document (proposal) or
    for each user? May the AI write the memory without asking (proposal:
    yes, with a setting that makes it ask)?
13. Plugins: does the source of a block of the level "render" open below its
    rendering (proposal) or in its place?
14. Mode to learn Markdown: all marks muted plus the block of the cursor in
    full color (proposal), or only the marks at the cursor? Can the user
    edit the marks directly (proposal: no)?
15. Format bar: underline as `<ins>text</ins>` (proposal) or no underline?
    "Color" as the colors of the highlights of Notes (proposal) or as a
    color of the text in HTML?
16. History: which backend is the default ([R-HIST-002](#r-hist-002)): the
    file in the repository of the document, so that others such as
    supervisors see it through Git (proposal), or the local store on the
    computer of the author? Later steps kept as a branch (proposal) or
    dropped? The form of the file of [R-HIST-006](#r-hist-006) (proposal)?
17. Licenses: `markdown-it-task-lists` (ISC), `entities` (BSD-2-Clause, used
    by markdown-it) and `argparse` (Python-2.0, only in the command line
    program of markdown-it, in no bundle).
18. Cognitive evaluation: only the two classes, with a step that holds both
    split into its parts ([R-HIST-009](#r-hist-009), proposal), or a third
    class "mixed" or a scale? Does the classifier run when a step is
    recorded (proposal) or only when the protocol is evaluated? Default
    rules in the library (proposal) or always the rules of the institution
    in the layout? May the user correct a classification (proposal: yes, as
    a step of its own)?

## Plan

| Step | Content | Requirements | State |
| --- | --- | --- | --- |
| 1 | Setup of the repository: the npm package, an example page for the web, CI with a check of the licenses | [R-GEN-007](#r-gen-007), [R-GEN-011](#r-gen-011) | built |
| 2 | The core on ProseMirror: Markdown into the document of the editor and back, with tests of the round trip | [R-GEN-009](#r-gen-009), [R-SRC-003](#r-src-003), [R-EDIT-004](#r-edit-004) to [R-EDIT-006](#r-edit-006) | built |
| 3 | Rendered editing of CommonMark and GFM: toolbar, format bar, insert menu, slash menu, block handles, find and replace, read-only mode, the mode to learn Markdown | [R-EDIT-003](#r-edit-003), [R-GEN-003](#r-gen-003), [R-EDIT-007](#r-edit-007), [R-GEN-008](#r-gen-008), [R-GEN-013](#r-gen-013) | planned |
| 4 | Tables: handles, markers for new rows and columns, the table menu | [R-EDIT-008](#r-edit-008) to [R-EDIT-010](#r-edit-010) | planned |
| 5 | The form of the front matter with both modes and the JSON schema | [R-FM-001](#r-fm-001) to [R-FM-006](#r-fm-006) | planned |
| 6 | The adapter for the webviews of VS Code and the theme of VS Code | [R-GEN-004](#r-gen-004), [R-VSC-001](#r-vsc-001) to [R-VSC-003](#r-vsc-003), [R-THEME-001](#r-theme-001) | planned |
| 7 | The plugin API, version 1, with both levels of plugins; the icons of threads beside the text | [R-GEN-005](#r-gen-005), [R-GEN-012](#r-gen-012), [R-PLUGIN-001](#r-plugin-001), [R-GEN-014](#r-gen-014) | planned |
| 8 | The plugins of nimblescape Markdown Notes, in its repository; the editor in the Notes side view | [R-NOTES-001](#r-notes-001), [R-GEN-002](#r-gen-002), [R-GEN-004](#r-gen-004) | planned |
| 9 | The plugins of nimblescape Markdown Paper, in its repository; the schema of each layout | [R-PAPER-001](#r-paper-001), [R-FM-004](#r-fm-004) | planned |
| 10 | The provider API, the Claude provider and the proposed changes in the editor; in Notes, the AI chat as notes and the memory; the events for the history | [R-AI-001](#r-ai-001) to [R-AI-006](#r-ai-006), [R-EDIT-001](#r-edit-001) | planned |
| 11 | The release workflow of the npm packages, the same as for the other nimblescape npm packages | [R-GEN-007](#r-gen-007) | planned |

The parts of [section 3](#3-architecture) that the plan does not name yet,
the source, the renderer, the layout and the history with its backends, get
their steps when the open questions 1 to 4 and 16 have answers.

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
