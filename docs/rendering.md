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

### R-REN-003

*(proposal)* **The renderer without the editor.** The renderer runs without
the editor, so that the command line needs no editor code.

## 2. Plugins of the renderer

### R-REN-002

**Plugins of the renderer.** A plugin of the renderer must be able to add
syntax with the function `extendMarkdownIt(md)`, as in VS Code, so that a
markdown-it plugin works in VS Code and in the renderer without a change. It
may add styles, and a view for each new kind of token: the HTML of the
markdown-it plugin, or a function `render(source, element)`. Examples:
diagrams of PlantUML and Mermaid, math, GitHub alerts, syntax colors for
source code, and the removal of the notes from the output.

## 3. Layouts

### R-LAYOUT-001

**Layouts.** The layout must put the content of the renderer into a layout:
styles, title page and templates, the numbers of headings, figures and
tables, the generated lists (table of contents, lists of figures, tables and
listings, the reference list), pages and PDF. Layouts are content, for
example the layout `plain` and the layouts of PHT. Each layout has a JSON
schema of the front matter of its documents
([R-FM-004](editor.md#r-fm-004)).

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

1. Layout code: does the layout code of Paper move into the layout part?
2. Pages: the switch between "Edit" and "Pages"
   ([R-LAYOUT-003](#r-layout-003), proposal)?
3. Schema of a layout: the file `frontmatter.schema.json` in the layout
   folder, named in `layout.json`, replaces the field `fields` (proposal)?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
