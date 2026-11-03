<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the platforms

This document defines the platform adapters, which connect the libraries to
VS Code, to a web page and to the command line
([R-GEN-015](specification.md#r-gen-015)), and the theme. It is part of the
[specification](specification.md) of nimblescape Markdown and normative in
the same way. [Section 6](#6-open-questions) lists its open questions.

## 1. General

### R-PLAT-001

**What the adapter gives.** The adapter of a platform must give the parts
what only the platform has: reading and saving files, a local store of data
on the computer of the user, the views, the theme, the signed-in GitHub
user, secrets such as the AI key, commands and settings, opening a link, and
a message channel from a plugin to its extension.

*(proposal)* **A strict policy of styles.** The editor adds style elements
to the page: the base styles of Tiptap and the styles of the plugins. A page
whose policy allows only style elements with a nonce gives this nonce to the
editor (`styleNonce`), so that its policy needs no `'unsafe-inline'` for
these styles, for example the side view of Notes.

## 2. VS Code

The history extension of VS Code, an extension of its own that records every
file of the workspace in the same way, is defined with the history
([R-VSC-004](history.md#r-vsc-004)).

### R-GEN-004

**The extensions decide where they use it.** The libraries are no VS Code
extension of their own. Notes and Paper bundle them and decide where they
use them. Notes uses the editor for each answer of a note in its side view,
and the editor must also be able to edit a whole file in the editor area. A
setting of the extension chooses which Markdown files open in the editor:
`all`, `notesAndPapers` (files with the comment of the format of Notes or
with a layout) or `none`. The default is `all`. "Reopen Editor
With" of VS Code always offers the text editor.

### R-VSC-001

**A custom text editor.** Notes registers the editor as a
custom text editor of VS Code, so that the file stays a normal text
document: save, the dirty mark, hot exit, Git diffs, the timeline and other
extensions work as for the text editor.

*(proposal)* The package `@nimblescape/markdownvscode` is the adapter. The
function `registerMarkdownEditor` of the extension side registers the editor
for the view type of the extension, with the script of the page that the
extension bundles, the style sheets and a function that decides which
documents open in it ([R-GEN-004](#r-gen-004)); a document that does not
open in it opens in the text editor in the same place. The adapter gets the
API of VS Code as a parameter and uses no API of Node.js, so that it runs in
the extension host of the desktop and of the web. The page of the webview
allows only the script of the extension with a random nonce, the style
sheets and fonts of the extension, and images from the folder of the file,
from https and as data; the base of the page is the folder of the file, so
that an image with a relative path shows. The page keeps its state while its
tab is in the background. On a file system that cannot write, for example
an older version of a file from Git, the editor is read-only. The side of
the page is the entry point `@nimblescape/markdownvscode/webview`: its
function `connectVsCode` gives the source of the document, and the page
creates the editor with it ([R-EDIT-002](editor.md#r-edit-002)). The
connection also gives the API of the platform for the plugins of the editor
([R-PLUGIN-001](plugins.md#r-plugin-001)): the adapter carries the messages
of each plugin between its part on the page and its part in the extension.

### R-VSC-002

**Text editor and save.** A button must open the text editor of the same
file to the side. Ctrl+S saves the file; the format on save of Notes runs,
and the editor takes over the changed blocks.

*(proposal)* The button is in the title of the editor; the extension
contributes it with a command, which the adapter registers. The text editor
opens with the selection of the editor. The page may also open it, for
example from a button of its own.

### R-VSC-003

**Rules of the adapter.** The adapter uses no proposed API, supports
Restricted Mode and virtual workspaces, sends no telemetry and has no
network address of its own. It may require a newer VS Code version than
1.125 when that makes the work simpler.

### R-VSC-005

*(proposal)* **The page and the document.** The document of VS Code holds
the text of the file; the page of the webview holds a source with the same
text. Each message that changes the text gives only the patches against a
version that the other side knows. The page sends one change of the user at
a time; a change that the user makes before the answer waits for it. A
change of the document since the version of a change of the page merges
with it ([R-SRC-002](source.md#r-src-002)). Each change of the document that
the page did not make reaches the editor with the origin `program` and the
name `vscode`, because VS Code does not say who made a change. When the page
misses a message, for example while VS Code cannot give it, the page starts
again from the whole text of the document.

### R-VSC-006

*(proposal)* **Undo and the keys of the editor.** Undo and Redo with the
keys in the editor undo and redo the steps of the editor, as the user made
them. Undo from the menu of VS Code undoes the changes of the document. A
key that the editor handles, for example Ctrl+K for a link or Ctrl+F for
find, starts no key binding of VS Code; every other key, for example Ctrl+S,
reaches VS Code.

### R-VSC-007

*(proposal)* **The views "Edit" and "Pages".** A button in the title of the
editor switches between "Edit" and "Pages"
([R-LAYOUT-003](rendering.md#r-layout-003)). The extension contributes two
commands, one for each view, and the adapter registers them; the context
key `<view type>.pages` is true while the active editor shows the pages, so
that the title shows the button of the other view. The page of the webview
holds the editor and a frame for the pages, and shows one of them. The page
reads the files of the layout through the extension, which reads only files
in the folders from which the page may load files, that is the workspace
folder of the file and the folders of the extension, and sends their bytes
as Base64. The extension names the scripts of the pages, for example
Paged.js, which it bundles. So that the page in the frame gets these files
as `blob:` URLs, the page of the webview may also load its own files with
`fetch` (`connect-src`), and images and fonts may be `blob:` URLs.

### R-VSC-008

**The plugins of other extensions.** An extension contributes plugins of
the editor ([R-PLUGIN-002](plugins.md#r-plugin-002)) in its package.json,
through the contribution point `nimblescape.markdown.extensions`, for
example Paper: `"contributes": { "nimblescape.markdown.extensions": {
"editorScripts": ["dist/editorPlugins.js"] } }`.

*(proposal)* An extension that registers the editor with
the option `contributedPlugins`, for example Notes, gives its page these
scripts of all enabled extensions, in the order of the IDs of the
extensions; a script must be a file `.js` in the folder of its extension.
The page may load these scripts, with the nonce of its policy, and reads no
other file of these folders through the extension. The scripts of an
extension run with the rights that the extension already has in VS Code.
The other part of such a plugin runs in its own extension: the handle of
the registration connects it with `addPlugin(name, connect)` in each open
panel and in each panel that opens later, for example through the API of
Notes for Paper. Until then, the panel keeps at most 100 messages of the
page for the plugins without a listener, and gives them to the first
listener of the plugin.

### R-VSC-009

**Rendered changes.** The changes of a file that opens in the editor, for
example its changes in Git, must show rendered in the editor, in a split
window: the older version on the left, the newer version on the right.

The diff of VS Code shows the editor on both sides, for example for a
changed file in the view "Source Control", in the timeline and with
"Compare with Saved", because the editor is a custom text editor
([R-VSC-001](#r-vsc-001)). VS Code opens a custom text editor in a diff only
when the priority of the editor in the package.json of the extension also
names the diff editor, `"priority": { "textEditor": "default",
"diffEditor": "default" }`, which needs VS Code 1.133 or newer
([R-VSC-003](#r-vsc-003)). Each side is a panel of its own. The left side
is read-only; the right side is editable when its file system can write.
The adapter connects the two panels that VS Code opens together for one
tab of a diff, and the editor of each side gets the text of the other side.

- Each side marks its changes: the left side the removed blocks with a red
  background, the right side the new blocks with a green background, and
  in a changed block the removed or the new words. The editor compares the
  blocks with the line diff of the library `diff`
  ([R-SRC-002](source.md#r-src-002)), and the words of a changed block with
  its word diff.
- The blocks of both sides line up: where one side has blocks that the
  other side does not have, the other side shows an empty space of the same
  height. Both sides scroll together.
- Each change of the right side updates the marks of both sides.
- Buttons in the title of the editor go to the previous and to the next
  change.
- *(proposal)* On the web, a page shows two editors side by side with the
  same functions of the editor.

VS Code has an API for the diffs of custom editors that gives both
documents and both panels at once (`customEditorDiffs`). It is a proposed
API, so the adapter does not use it ([R-VSC-003](#r-vsc-003)); when it is
stable, the adapter uses it in place of the connection of the two panels.

### R-VSC-010

*(proposal)* **The extensions of the Markdown preview.** The editor shows
the syntax that other extensions add to the Markdown preview of VS Code,
without a change of these extensions. Such an extension declares its parts
in its package.json: `markdown.markdownItPlugins`, with a function
`extendMarkdownIt(md)` that its `activate` returns, `markdown.previewStyles`
and `markdown.previewScripts`.

- The adapter finds them in the same way as the Markdown preview of VS
  Code: it reads these declarations of all enabled extensions, activates
  each extension with `markdown.markdownItPlugins`, and calls its
  `extendMarkdownIt` on a markdown-it with the options of the renderer
  ([R-REN-001](rendering.md#r-ren-001)). It leaves out the extensions that
  contribute plugins of the editor ([R-VSC-008](#r-vsc-008)), for example
  Notes and Paper, because their plugins of the editor show their syntax.
- These functions run in the extension host, not in the page. So the
  adapter renders the top-level blocks of the file with them in the
  extension host, and compares the HTML of each block with the HTML of the
  renderer without these plugins. A block whose HTML differs becomes a block
  of the level "render" ([R-GEN-012](plugins.md#r-gen-012)), for example a
  code block `mermaid`, math between `$$` or a container `:::`. Its
  rendering is the HTML of markdown-it with these plugins, and its source
  opens below it. The policy of the page stays the same, so a script inside
  this HTML does not run.
- Only blocks: a paragraph, a heading, a list and a table always stay
  blocks of the editor. A code block stays a code block of the editor, with
  the syntax colors of the editor, when its HTML with these plugins is still
  code (`pre`), for example with other colors; only a code block whose
  language a plugin shows as something else, for example a diagram, becomes
  a block of the level "render". A listing and the other generated parts
  ([R-EDIT-011](editor.md#r-edit-011)) stay read-only parts of their plugin,
  and these plugins never render them.
- The page loads the style sheets of `markdown.previewStyles` and the
  scripts of `markdown.previewScripts` from the folders of their
  extensions, in the same way as the plugins of other extensions; the
  scripts run with the rights that their extension already has in VS Code.
  After each change of the rendering, the page sends the event
  `vscode.markdown.updateContent` on `window`, as the Markdown preview
  does, because the scripts of these extensions, for example of diagrams,
  wait for it.
- A plugin that changes the text inside a paragraph, for example the codes
  of emoji or math between `$`, shows nothing in the editor: the paragraph
  shows the text as it is written. A script that needs other parts of the
  Markdown preview may not work. A setting of the extension turns these
  extensions off in the editor.
- On the web, a page gives a markdown-it plugin to the editor as a plugin
  of the level "render" with `extendMarkdownIt`
  ([R-PLUGIN-001](plugins.md#r-plugin-001)), also without a change of the
  markdown-it plugin.

## 3. Web

### R-WEB-001

**A page with the editor.** A page creates the editor with its plugins, its
platform adapter and its theme, for example `createEditor(element, {
markdown, extensions, host, theme })`. The page gives an AI provider that
calls its own server ([R-AI-005](ai.md#r-ai-005)).

## 4. Command line

### R-CLI-001

**Output without a view.** The command line renders and lays out a document
without a view, for example `mp build` of Paper.

## 5. Theme

### R-THEME-001

**The variables of the theme.** Every color, font and size must come from
CSS variables with the prefix `--nsmd-`. In VS Code, every color must come
from the active color theme: the adapter maps each variable to a variable
`--vscode-*` of the webview. The palette of seven colors (gray, red, orange,
yellow, green, blue, purple) comes from the chart colors of the theme; Notes
adds teal.

*(proposal)* The palette is the variables `--nsmd-color-gray` to
`--nsmd-color-purple`; the colors of the alerts come from it. The style
sheet `vscode.css` of `@nimblescape/markdownvscode` maps the variables, for
the editor and for a rendering of the renderer (the class `nsmd-document`);
the page loads it after the style sheet of the editor. The style sheet of the
editor holds the styles of rendered content of the renderer
([R-GEN-010](specification.md#r-gen-010)). A theme may give the
selected text its own color with `--nsmd-selection-foreground`, as the
themes of high contrast of VS Code do; without it, the selected text keeps
its color.

### R-THEME-002

**Themes on the web.** On the web, the editor must be themable: the package
has a light and a dark theme, and "auto" follows the system. A page may
change any variable or bring a theme of its own.

### R-THEME-003

**Fonts in VS Code.** In VS Code, the text uses the font, the
size and the line height of the settings of the Markdown preview, and code
uses the font of the editor. A change of these settings shows at once.

## 6. Open questions

1. VS Code: the form of the adapter ([R-VSC-001](#r-vsc-001)), the
   changes between the page and the document
   ([R-VSC-005](#r-vsc-005)), Undo and the keys of the editor
   ([R-VSC-006](#r-vsc-006)), the views "Edit" and "Pages"
   ([R-VSC-007](#r-vsc-007)), and the details of the plugins of other
   extensions ([R-VSC-008](#r-vsc-008)), all proposals?
2. Web: two editors side by side for the rendered changes
   ([R-VSC-009](#r-vsc-009), proposal)?
3. VS Code: does the editor show the syntax of the extensions of the
   Markdown preview, as blocks of the level "render"
   ([R-VSC-010](#r-vsc-010), proposal)?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
