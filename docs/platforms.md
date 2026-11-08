<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the platforms

This document defines what the libraries need from a platform, where the
adapter of each platform is, for VS Code, a web page and the command line
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

**A strict policy of styles.** The editor adds style elements
to the page: the base styles of Tiptap and the styles of the plugins. A page
whose policy allows only style elements with a nonce gives this nonce to the
editor (`styleNonce`), so that its policy needs no `'unsafe-inline'` for
these styles, for example the side view of Notes.

**The adapter is a part of the product.** The libraries have no package for
a platform ([R-ARCH-002](specification.md#r-arch-002)). The adapter of a
platform is a part of the product that uses the editor on that platform.

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
With" of VS Code always offers the text editor. A Markdown file has three
views in the place of its editor: "Text Editor", "Markdown Preview" and
"Markdown Editor", which is this editor, also for a paper document with the
plugins of Paper. The list of the editors of VS Code shows only these three,
and the title of each view has a button for each of the two other views
([R-PREV-006](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-prev-006)
of Notes).

The adapter of VS Code is a part of Markdown Notes, which registers the
editor as a custom text editor of VS Code. Its requirements are in the
requirements of Notes: the custom text editor, the text editor to the side,
the rules of the adapter, the page and the document, Undo and the keys, the
views "Edit" and "Pages", the plugins of other extensions, the rendered
changes in the diff of VS Code, the extensions of the Markdown preview, the
theme and the fonts of VS Code
([R-VSC-001](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-vsc-001) to
[R-VSC-012](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-vsc-012) of Notes). The
libraries give what such an adapter needs: the source of the page
([R-EDIT-002](editor.md#r-edit-002)), the plugin API with the API of the
platform ([R-PLUGIN-001](plugins.md#r-plugin-001)), the plugins of other
bundles ([R-PLUGIN-002](plugins.md#r-plugin-002)), the rendered changes of
the editor ([R-EDIT-012](editor.md#r-edit-012)), the pages of the layout
([R-LAYOUT-003](rendering.md#r-layout-003)) and the variables of the theme
([R-THEME-001](#r-theme-001)).

## 3. Web

### R-WEB-001

**A page with the editor.** A page creates the editor with its plugins, its
platform adapter and its theme, for example `createEditor(element, {
markdown, extensions, host, theme })`. The page gives an AI provider that
calls its own server ([R-AI-005](ai.md#r-ai-005)).

A page gives a markdown-it plugin to the editor as a plugin of the level
"render" with `extendMarkdownIt`
([R-PLUGIN-001](plugins.md#r-plugin-001)), also without a change of the
markdown-it plugin.

## 4. Command line

### R-CLI-001

**Output without a view.** The command line renders and lays out a document
without a view, for example `mp build` of Paper.

## 5. Theme

### R-THEME-001

**The variables of the theme.** Every color, font and size must come from
CSS variables with the prefix `--nsmd-`. A platform maps these variables to
its own theme, for example the adapter of VS Code of Notes to the active
color theme of VS Code ([R-VSC-011](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-vsc-011)
of Notes).

The palette of seven colors (gray, red, orange, yellow, green,
blue, purple) is the variables `--nsmd-color-gray` to
`--nsmd-color-purple`; the colors of the alerts come from it. The style
sheet of the editor holds the styles of rendered content of the renderer
([R-GEN-010](specification.md#r-gen-010)), for the editor and for a
rendering of the renderer (the class `nsmd-document`). A theme may give the
selected text its own color with `--nsmd-selection-foreground`, as the
themes of high contrast of VS Code do; without it, the selected text keeps
its color.

### R-THEME-002

**Themes on the web.** On the web, the editor must be themable: the package
has a light and a dark theme, and "auto" follows the system. A page may
change any variable or bring a theme of its own.

## 6. Open questions

This document has no open questions.

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
