<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the layout

This document defines the layout: the part that puts the content of the
renderer into a layout, with styles, templates, pages and PDF
([section 3](specification.md#3-architecture) of the specification). It is
part of the [specification](specification.md) of nimblescape Markdown and
normative in the same way. [Section 3](#3-open-questions) lists its open
questions.

## 1. Layouts

### R-LAYOUT-001

**Layouts.** The layout must put the content of the renderer into a layout:
styles, title page and templates, the numbers of headings, figures and
tables, the generated lists (table of contents, lists of figures, tables and
listings, the reference list), pages and PDF. Layouts are content, for
example the layout `plain` and the layouts of PHT. Each layout has a JSON
schema of the front matter of its documents
([R-FM-004](editor.md#r-fm-004)).

## 2. Pages and PDF

### R-LAYOUT-002

**The PDF is the view.** The PDF must come from the same rendering as the
view, so that the view and the PDF never differ
([R-GEN-010](specification.md#r-gen-010)).

### R-LAYOUT-003

*(proposal)* **Pages.** The page engine is Paged.js. A button switches the
editor between "Edit" and "Pages"; in "Pages", the highlights of the notes
and "Add Note" work, and a double click on a page goes to that place in
"Edit".

## 3. Open questions

1. Layout code: does the layout code of Paper move into the layout part?
2. Pages: the switch between "Edit" and "Pages"
   ([R-LAYOUT-003](#r-layout-003), proposal)?
3. Schema of a layout: the file `frontmatter.schema.json` in the layout
   folder, named in `layout.json`, replaces the field `fields` (proposal)?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
