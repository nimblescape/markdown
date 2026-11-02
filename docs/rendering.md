<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the renderer and the layout

This document defines two of the parts
([section 3](specification.md#3-architecture) of the specification): the
renderer, which turns the text into content without edit functions
([section 1](#1-content-without-edit-functions) and
[section 2](#2-plugins-of-the-renderer)), and the layout, which puts this
content into a layout, with styles, templates, pages and PDF
([section 3](#3-layouts) and [section 4](#4-pages-and-pdf)). It is part of
the [specification](specification.md) of nimblescape Markdown and normative
in the same way. [Section 5](#5-open-questions) lists its open questions.

## 1. Content without edit functions

### R-REN-001

**Content without edit functions.** The renderer must turn the text into
content without edit functions: HTML, with a view for each kind of token. It
must use markdown-it 14, the version of the Markdown preview of VS Code,
with footnotes and task lists.

*(proposal)* The renderer is the package `@nimblescape/markdownrender`. It
writes the HTML that GitHub writes where GitHub has one: a block quote whose
first line is the marker of an alert, such as `> [!NOTE]`, becomes
`<div class="markdown-alert markdown-alert-note">` with the title
`<p class="markdown-alert-title">Note</p>`; each heading gets the ID that
GitHub gives it; task lists and footnotes have the HTML of
markdown-it-task-lists and markdown-it-footnote, with the footnotes at the
end of the text. The front matter is no part of the rendering, and each
block names its line in the file (`data-line`), counted from 0, as in the
Markdown preview of VS Code. The comments of the tables of the editor
([R-EDIT-010](editor.md#r-edit-010)) show as in the editor: the color of a
cell and the widths of the columns. The styles of rendered content
(`content.css`) are the same for a rendering and for the text of the editor
([R-GEN-010](specification.md#r-gen-010)).

*(proposal)* **Raw HTML.** The renderer has no sanitizer. By default, raw
HTML of the file shows safely: comments do not show; the elements of a fixed
list without attributes (for example `ins`, `sub`, `sup`, `kbd`, `br`,
`details` and `summary`), the anchors `<a id="…">` and `<a name="…">`, and
the check boxes of task lists show as HTML; any other raw HTML shows as its
text. An end tag shows as HTML only when it closes the last element that the
raw HTML opened, and the rendering closes the elements that the raw HTML of
a paragraph or of the whole text leaves open. No raw HTML of the file can
run a script or load a resource. The integrating code may choose that raw
HTML shows as its text, as in the editor, or as the file writes it, for a
text that it trusts.

### R-REN-003

**The renderer without the editor.** The renderer must run without the
editor, so that the command line needs no editor code.

*(proposal)* `toHtml(text)` returns the HTML without a page, with the tokens
that plugins show in a page; `render(text, element)` shows the rendering in
an element of a page and runs the functions of the plugins. The package
needs no code of the editor, of Tiptap or of ProseMirror.

## 2. Plugins of the renderer

### R-REN-002

**Plugins of the renderer.** A plugin of the renderer must be able to add
syntax with the function `extendMarkdownIt(md)`, as in VS Code, so that a
markdown-it plugin works in VS Code and in the renderer without a change. It
may add styles, and a view for each new kind of token: the HTML of the
markdown-it plugin, or a function `render(source, element)`. Examples:
diagrams of PlantUML and Mermaid, math, GitHub alerts, syntax colors for
source code, and the removal of the notes from the output.

*(proposal)* A plugin of the renderer is the object `{ name, apiVersion: 1,
extendMarkdownIt?, styles?, render? }`, the level "render" of the plugin
object of the editor ([R-PLUGIN-001](plugins.md#r-plugin-001)), so that the
same object works in the renderer and in the editor. `render` maps the type
of a token, or `fence:<language>` for a fenced code block, to a function
`render(source, element, token)`. In a page, the function shows the token in
an empty element in its place; without a page, the token shows with the
HTML of its rule of markdown-it. The page gets the styles of each plugin
once.

## 3. Layouts

### R-LAYOUT-001

**Layouts.** The layout must put the content of the renderer into a layout:
styles, title page and templates, the numbers of headings, figures and
tables, the generated lists (table of contents, lists of figures, tables and
listings, the reference list), pages and PDF. Layouts are content, for
example the layout `plain` and the layouts of PHT. Each layout has a JSON
schema of the front matter of its documents
([R-FM-004](editor.md#r-fm-004)).

### R-LAYOUT-004

**The layout code of Paper.** The layout part must hold the layout code of
Markdown Paper: Paper adds only its own parts to the layout, through its
plugins ([R-PAPER-001](plugins.md#r-paper-001)).

## 4. Pages and PDF

### R-LAYOUT-002

**The PDF is the view.** The PDF must come from the same rendering as the
view, so that the view and the PDF never differ
([R-GEN-010](specification.md#r-gen-010)).

### R-LAYOUT-003

*(proposal)* **Pages.** The page engine is Paged.js. A button switches the
editor between "Edit" and "Pages"; in "Pages", the highlights of the notes
and "Add Note" work, and a double click on a page goes to that place in
"Edit".

## 5. Open questions

1. Pages: the switch between "Edit" and "Pages"
   ([R-LAYOUT-003](#r-layout-003), proposal)?
2. Schema of a layout: the file `frontmatter.schema.json` in the layout
   folder, named in `layout.json`, replaces the field `fields` (proposal)?
3. Raw HTML in a rendering: the safe way with a fixed list of elements by
   default ([R-REN-001](#r-ren-001), proposal), or a sanitizer library, whose
   license needs a decision ([R-GEN-011](specification.md#r-gen-011))?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
