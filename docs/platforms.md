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

## 2. VS Code

The history extension of VS Code, the base of Markdown Notes and Markdown
Paper, is defined with the history ([R-VSC-004](history.md#r-vsc-004)).

### R-GEN-004

**The extensions decide where they use it.** The libraries are no VS Code
extension of their own. Notes and Paper bundle them and decide where they
use them. Notes uses the editor for each answer of a note in its side view,
and the editor must also be able to edit a whole file in the editor area. A
setting of the extension chooses which Markdown files open in the editor:
`all`, `notesAndPapers` (files with the comment of the format of Notes or
with a layout) or `none`. *(proposal)* The default is `all`. "Reopen Editor
With" of VS Code always offers the text editor.

### R-VSC-001

*(proposal)* **A custom text editor.** Notes registers the editor as a
custom text editor of VS Code, so that the file stays a normal text
document: save, the dirty mark, hot exit, Git diffs, the timeline and other
extensions work as for the text editor.

### R-VSC-002

**Text editor and save.** A button must open the text editor of the same
file to the side. Ctrl+S saves the file; the format on save of Notes runs,
and the editor takes over the changed blocks.

### R-VSC-003

**Rules of the adapter.** The adapter uses no proposed API, supports
Restricted Mode and virtual workspaces, sends no telemetry and has no
network address of its own. It may require a newer VS Code version than
1.125 when that makes the work simpler.

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

### R-THEME-002

**Themes on the web.** On the web, the editor must be themable: the package
has a light and a dark theme, and "auto" follows the system. A page may
change any variable or bring a theme of its own.

### R-THEME-003

*(proposal)* **Fonts in VS Code.** In VS Code, the text uses the font and
size of the settings of the Markdown preview, and code uses the font of the
editor.

## 6. Open questions

1. VS Code: does Notes register the editor as a custom text editor for the
   main view of a file ([R-VSC-001](#r-vsc-001), proposal), and is `all` the
   default of the setting ([R-GEN-004](#r-gen-004))?
2. Fonts: the fonts of the settings of the Markdown preview in VS Code
   ([R-THEME-003](#r-theme-003), proposal)?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
