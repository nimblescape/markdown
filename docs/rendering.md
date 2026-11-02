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

*(proposal)* The layout part is the package `@nimblescape/markdownlayout`. A
layout is a folder with `layout.json` in the layout folder format
`nimblescape-layout` of Markdown Paper, version 1.1.0: its style sheets, the
templates of its fixed pages, its fields, its language and its rules for
headings, contents, hyphens, listings and the name of the PDF. Version 1.1.0
adds the field `frontMatterSchema`, the file of the JSON schema of the front
matter in the layout folder; the layout gets its fields from the schema when
`layout.json` gives none, and a layout without the file gets the schema of
its fields. The package reads the layouts of the format 1.0.0 of Paper
without a change. A document names its layout with the field `layout` of
its front matter: the folder `layouts/<name>/` in the folder of the document
or in a folder above it, up to the top folder of the search; a layout that
the integrating code finds, for a name with `/`, for example a layout on
GitHub in its clone; else a built-in layout. A document without the field,
or with a layout that does not exist, gets the built-in layout `plain`,
which the package holds. The fields of the front matter in YAML, TOML or
JSON fill the templates, and the field `lang` gives the layout its language.
The page of a document is one HTML page with the style sheets of the layout,
the fields as CSS variables and attributes, the filled templates, the text
and the scripts; it lets only its own scripts run, and a template holds no
script.

### R-LAYOUT-004

**The layout code of Paper.** The layout part must hold the layout code of
Markdown Paper: Paper adds only its own parts to the layout, through its
plugins ([R-PAPER-001](plugins.md#r-paper-001)).

*(proposal)* The layout is a plugin of the renderer
([R-REN-002](#r-ren-002)) whose rule works only in a rendering with a
layout, so that the same renderer renders a text with and without a layout.
In a rendering with a layout, each footnote goes to the foot of the page of
its first reference, and a link to the outside with its own text gets its
address in a footnote; the headings get numbers to the depth of the layout,
except the special sections (table of contents, lists of figures, tables
and listings, reference list, declaration, abstract, acknowledgements,
foreword, appendix), which the words of the language or a marker such as
`{BIB}` name; the document has a front part, a body and an appendix part;
the captions of figures, tables and listings keep the numbers of the file
and get the next number otherwise, with the letter of the appendix in the
appendix part; the special section of a list shows the list; a link whose
text is a word and a number gets the label of its target; and the text gets
soft hyphens by the language of the layout. The headings keep the IDs that
GitHub gives them. The classes, the IDs and the event `paper-rendered` are
those of the layout folder format of Paper, so that the layouts of Paper
work without a change. The removal of the notes is a plugin of Markdown
Notes, and the cite of the source of a listing with its link is a plugin of
Paper, which writes the cite after the caption.

## 4. Pages and PDF

### R-LAYOUT-002

**The PDF is the view.** The PDF must come from the same rendering as the
view, so that the view and the PDF never differ
([R-GEN-010](specification.md#r-gen-010)).

*(proposal)* **The PDF.** The entry point `@nimblescape/markdownlayout/pdf`
makes the PDF in Node.js, for example on the command line and in the
extension host of VS Code on the desktop. The page of the PDF is the page of
the view of the pages, with the files of the disk: an installed browser
without a window (Google Chrome, Chromium, Microsoft Edge or Brave) loads
it, Paged.js makes the pages, and the browser prints them in the size of the
pages of the layout. The integrating code can name the program of the
browser, else the environment variable `NIMBLESCAPE_BROWSER` names it;
without a browser, the error says where to get Google Chrome. The layout
part downloads no browser. The PDF then loses the marks of the soft hyphens,
so that search and copy find whole words, and gets the title, the author,
the subtitle as its subject and the language of the layout in its metadata.
The code is the PDF code of nimblescape Markdown Paper.

*(proposal)* **The functions of the plugins in the PDF.** In the page of the
PDF, no integrating code fills the placeholders of the plugins, as the view
of the pages does. So the page holds the data of its placeholders as JSON,
and a script of the page registers the functions of the plugins
(`registerRenders`); the integrating code bundles this script with the same
plugins as its renderer. After the page has loaded, the script of the layout
fills the placeholders as the renderer does, and then Paged.js makes the
pages. In the page, a function of a plugin gets a copy of the data of its
token, with the methods `attrIndex` and `attrGet`.

### R-LAYOUT-003

*(proposal)* **Pages.** The page engine is Paged.js. A button switches the
editor between "Edit" and "Pages"; in "Pages", the highlights of the notes
and "Add Note" work, and a double click on a page goes to that place in
"Edit".

*(proposal)* The view of the pages shows the page of the document in a
frame, so that the style sheets of the layout change only the frame. The
page holds Paged.js until the functions of the plugins have shown their
tokens in the frame; Paged.js then starts when the page has not changed for
200 ms, at the latest 10 s after the page loaded. On a screen, the pages
stand on a grey background with a gap between them; the PDF has no screen
styles.

## 5. Open questions

1. Pages: the switch between "Edit" and "Pages"
   ([R-LAYOUT-003](#r-layout-003), proposal)?
2. Schema of a layout: the file of the schema in the layout folder, for
   example `frontmatter.schema.json`, named in the field
   `frontMatterSchema` of `layout.json`, gives the fields when `layout.json`
   has none (format 1.1.0, [R-LAYOUT-001](#r-layout-001), proposal)?
3. Raw HTML in a rendering: the safe way with a fixed list of elements by
   default ([R-REN-001](#r-ren-001), proposal), or a sanitizer library, whose
   license needs a decision ([R-GEN-011](specification.md#r-gen-011))?
4. The functions of the plugins in the PDF: a script of the page that the
   integrating code bundles with the same plugins as its renderer, whose
   functions get a copy of the data of their tokens
   ([R-LAYOUT-002](#r-layout-002), proposal)?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
