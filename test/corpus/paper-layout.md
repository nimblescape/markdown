<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# The layout folder

This document specifies version 1.0.0 of the format of a layout of
nimblescape Markdown Paper: a folder that says how the pages of the documents
of a repository look. It is for people and for AI agents that write a layout,
for example from a Word template. Print it with
`npx -y @nimblescape/markdownpaper instructions layout`.

## 1. Place and name

A layout is a folder `layouts/<name>/`, for example `layouts/pht-thesis/`. The
name holds letters, digits, `.`, `-` and `_`. A document names it in its front
matter (`layout: pht-thesis`), and the renderer looks for the folder in the
folder of the document and in each folder above it, up to the folder of the
workspace; then among the built-in layouts. The built-in layout `plain` is the
layout of a document without the field `layout`.

## 2. Files

| File | Content |
| --- | --- |
| `layout.json` | The description of the layout (section 3). Required. |
| `page.css` | The style sheet of the pages: CSS with the rules of CSS Paged Media (section 5). |
| Templates, for example `cover.html` | HTML of the fixed pages, with the fields of the front matter (section 6). |
| `document.md` | The empty paper document: the start of a new document of the layout (section 7). |
| `document.pdf` | The preview: the PDF of the empty paper document (section 7). |
| `fonts/` | Font files with their licenses. |
| `images/` | Images, for example a logo. |
| `source/` | The Word template and its PDF, from which the layout was made (optional; the renderer does not read it). |

A layout holds no script: the page runs only the scripts of the renderer, and
a script element or an event attribute of a template is removed.

## 3. `layout.json`

```json
{
  "format": "nimblescape-layout 1.0.0",
  "instructions": "npx -y @nimblescape/markdownpaper instructions layout",
  "name": "PHT Abschlussarbeit",
  "language": "de-AT",
  "stylesheets": ["page.css"],
  "before": ["cover.html"],
  "after": [],
  "document": "document.md",
  "preview": "document.pdf",
  "fields": {
    "title": { "description": "Der Titel der Arbeit.", "required": true },
    "subtitle": "Ein Untertitel, optional.",
    "author": { "description": "Vorname Nachname.", "required": true },
    "kapitelumbruch": { "description": "nein: Kapitel beginnen auf keiner neuen Seite.", "default": "ja" },
    "variante": { "description": "vorlage: wie die Word-Vorlage; klassisch: wie frühere Arbeiten.", "default": "vorlage", "values": ["vorlage", "klassisch"] }
  },
  "headings": { "numbered": true, "depth": 3, "unnumbered": ["^Anhang"] },
  "contents": { "depth": 3 },
  "hyphenate": true,
  "listings": { "lineNumbers": false },
  "pdfName": "{{matrikelnummer}}_{{author}}_{{type}}",
  "terms": { "BIB": ["Literaturverzeichnis", "Quellen"] }
}
```

| Field | Value | Default |
| --- | --- | --- |
| `format` | `"nimblescape-layout 1.0.0"`, the format and its version. Required. | |
| `$schema` | The JSON schema of `layout.json`, for the editor: `https://raw.githubusercontent.com/nimblescape/markdownpaper-vscode/main/schemas/layout.schema.json`. VS Code uses it for `layouts/<name>/layout.json` without this field. | |
| `instructions` | The command that prints this document, for agents. Informative. | |
| `name` | The name of the layout for people. | the name of the folder |
| `language` | The language of the documents, a tag such as `de-AT` or `en-US`. It decides the hyphenation and the words of section 4. | `en-US` |
| `citationStyle` | The citation style of the citations and the reference list: the built-in style `apa7` (APA Style 7th edition of the Citation Style Language), or a `.csl` file of the layout folder, for example `pht-apa7.csl`. The language of the layout chooses the words of the style, such as `S.` and `Hrsg.`. | `apa7` |
| `stylesheets` | The style sheets, in their order. | `["page.css"]` |
| `before`, `after` | The templates of the fixed pages before and after the text, in their order. | `[]` |
| `document` | The empty paper document, the Markdown file that starts a new document (section 7). The JSON schema requires it. | |
| `preview` | The PDF of the empty paper document, which shows the pages of the layout before a person chooses it (section 7). The JSON schema requires it. | |
| `fields` | The fields of the front matter: each a description, or an object with `description`, `required` (`true` or `false`), `default`, and `values`, the list of names that the author chooses from (see "Parameters" below). | `{}` |
| `headings.numbered` | `false`: the renderer numbers no heading. | `true` |
| `headings.depth` | The deepest level of a numbered heading, 1 to 6. | `3` |
| `headings.unnumbered` | Regular expressions; a heading whose text matches one gets no number, nor do the headings below it. | `[]` |
| `headings.numberedSections` | The codes of the special sections (section 4) whose headings get a number as other chapters do, for example `["BIB"]` for a template that numbers its reference list. | `[]` |
| `contents.depth` | The deepest level of a heading in the table of contents. | `3` |
| `contents.front` | `false`: the table of contents lists no chapter of the front part (`.paper-front`, section 5). | `true` |
| `hyphenate` | `false`: no soft hyphens. | `true` |
| `references.hyphenate` | `true`: the reference list gets soft hyphens as the text does, but not its web addresses. | `false` |
| `listings.lineNumbers` | `true`: the number of each line before the code of a listing, from 1 in each listing. | `false` |
| `pdfName` | The name of the PDF file without `.pdf`, with fields as `{{field}}`; `{{file}}` is the name of the Markdown file. Characters other than letters, digits, `-`, `_` and `.` fall away, a space becomes `-`. | `"{{file}}"` |
| `terms` | Words of the language that this layout changes (section 4). | |
| `origin` | Only in a copy of a layout on GitHub in a project: where it comes from, `layout` (`<owner>/<repository>/<folder>`; an older copy has `github:` before it), `ref` (the branch, tag or commit that the copy follows) and `commit` (the commit of the copied files). A new project writes it; `mp get` and "Update Layout" read it (section 8). A layout repository does not write it. | |

All paths are relative to the layout folder and stay inside it. A higher minor
version of the format adds fields that an older renderer leaves out; a higher
major version is a format that an older renderer does not read.

**Parameters.** A field with `values` is a parameter of the layout: the author
chooses one of its names in the front matter, and the layout keeps to itself
what each name changes. One layout can so hold several variants, for example
the look of a Word template and an older look, without a second layout folder:

```json
"variante": {
  "description": "vorlage: wie die Word-Vorlage; klassisch: wie frühere Arbeiten.",
  "default": "vorlage",
  "values": ["vorlage", "klassisch"]
}
```

The front matter says `variante: klassisch`, and the style sheets read the
choice from the attribute `data-field-variante` on the body, on the text and on
each template section (section 5), for example
`body[data-field-variante="klassisch"] { font-family: "Liberation Serif", serif; }`.
A margin that a variant changes needs a named page:
`main.paper-text[data-field-variante="klassisch"] { page: klassisch; }` and
`@page klassisch { margin-bottom: 22mm; }`. The `default` is one of the
`values`. A value that is not one of them is a warning of the checks, and the
hover of the field and the comment of a new document list the values. The
names are the words of the documents, so a German layout has German names.

## 4. Special sections and words of the language

The heading of a special section has no number, unless `headings.numberedSections`
of the layout names its code; the renderer finds it by its words in the
language of the layout, or by a marker of its code at the end of the heading,
for example `# Quellen und Materialien {BIB}`.

| Code | Section | German words | English words |
| --- | --- | --- | --- |
| `TOC` | Table of contents, a list | Inhaltsverzeichnis, Inhalt | Table of Contents, Contents |
| `LOF` | List of figures, a list | Abbildungsverzeichnis | List of Figures, List of Illustrations |
| `LOT` | List of tables, a list | Tabellenverzeichnis | List of Tables |
| `LOL` | List of listings, a list | Listingverzeichnis, Verzeichnis der Listings | List of Listings |
| `BIB` | Reference list | Literaturverzeichnis, Literatur, Quellenverzeichnis, Quellen, Bibliographie | Bibliography, References, Works Cited |
| `ADT` | Affidavit | Eidesstattliche Erklärung | Affidavit, Statutory Declaration |
| `AST` | Abstract | Abstrakt, Abstract, Kurzfassung, Zusammenfassung | Abstract, Summary |
| `ACC` | Acknowledgments | Danksagung, Dank | Acknowledgments |
| `FWD` | Foreword | Vorwort | Foreword, Preface |
| `APX` | Appendix part, with the appendices A, B, … | Anhang, Anhänge | Appendix, Appendices |

`terms` of `layout.json` replaces the words of a code (a list of texts) and
the words `figure`, `table`, `listing` and `appendix` (a text), which the
renderer writes before the number of a figure, of a table, of a listing and
before the letter of an appendix.

## 5. The style sheet

The pages are HTML, and Paged.js makes the pages from the rules of CSS Paged
Media: `@page` with `size` and `margin`, the margin boxes such as
`@bottom-right` for the header and the footer, `counter(page)`,
`target-counter`, named pages, `break-before`, and `@footnote`. The renderer
gives the style sheet these parts:

| Selector | Part |
| --- | --- |
| `body.paper` with `data-layout` and `data-field-<field>` | The page, with each field of the front matter as an attribute: `body[data-field-draft="ja"] { color: #555; }`. `main.paper-text` and each template section have the same `data-field-<field>` attributes. Paged.js applies `break-before`, `break-after` and `page` to the content without its body, so a rule of a break or of a named page that depends on a field starts at the text or at the template section, not at `body`: `main.paper-text[data-field-kapitelumbruch="nein"] h1 { break-before: auto; }`. |
| `--field-<field>` | Each field as a CSS variable with a string, for the margin boxes: `@bottom-left { content: var(--field-author); }`. |
| `.paper-template-<name>` | The section of a template, for example `.paper-template-cover`; give it `break-after: page` for a page of its own. |
| `main.paper-text` | The text. |
| `.paper-part.paper-front`, `.paper-part.paper-body`, `.paper-part.paper-appendix` | The parts of the text, each from a chapter (`#`) on: the front part, the chapters of the front matter (`ADT`, `AST`, `ACC`, `FWD`, `TOC`, `LOF`, `LOT`, `LOL`) before the first other chapter; the body with the chapters; the appendix part from its heading on. Give a part a named page for its own footer or page numbers: `main.paper-text .paper-front { page: front; }`, `.paper-body { counter-reset: page 1; }`, and in `@page appendix` the footer `counter(page, upper-roman)`. A special section of the front part gets no number. |
| `h1` to `h6`, `.heading-number` | The headings and their numbers. |
| `.section-toc`, `.section-bib`, … | The heading of a special section, with `data-section` = its code. |
| `nav.contents`, `.contents-level-1` to `-6`, `.contents-number`, `.contents-text`, `.contents-front`, `.contents-appendix` | The table of contents; the renderer adds the page of each entry as `a::after`. An entry of the front part or of the appendix part has the class of its part, for example for the page in other numbers: `nav li.contents-appendix a::after { content: target-counter(attr(href), page, upper-roman); }`. |
| `nav.list-of-figures`, `nav.list-of-tables`, `nav.list-of-listings`, `.caption-entry` | The list of figures, of tables and of listings. |
| `figure.figure`, `figcaption`, `.caption-label`, `.caption-separator`, `.caption-text` | A figure and its caption, which comes before the image. |
| `p.table-caption` | The caption of a table, directly before the table. |
| `p.listing-caption`, `.caption-source`, `pre.listing`, `.line-number` | The caption of a listing before its code, the cite of its source after the caption, such as "(fields.ts, L12-L30)", the code, and the number of each line, an element without text whose number `::before { content: attr(data-number); }` shows. |
| `.footnote`, `.footnote-paragraph`, `::footnote-call`, `::footnote-marker`, `@footnote` | The footnotes at the foot of the page. Paged.js copies the classes of a footnote to its call in the text, the element `[data-footnote-call]` with the number as `::after`: a rule for the text of the footnote names `.footnote:not([data-footnote-call])`, so that the number in the text keeps the size of its text and gets no `::before`. |
| `sup.footnote-again`, `.link-footnote`, `.link-address` | A second reference to a footnote, a link to the footnote. The footnote with the address of a link to the outside, whose text is the link `a.link-address`; in a footnote, the address after the text of a link. The style sheet of the renderer gives every link `a` the color of the text without a mark, and lets a long address break at the end of a line. |
| `.markdown-alert`, `.markdown-alert-note` (also `-tip`, `-important`, `-warning`, `-caution`), `.markdown-alert-title` | An alert of GitHub, a block quote with `[!NOTE]` or another mark in its first line, as GitHub writes it: a `div` with the title, such as "Note", and the text. A layout draws it as a box, for example the box of a hint of a Word template, and can hide its title. An ordinary block quote stays a `blockquote`. |
| `section.references` | The reference list. Its entries are the paragraphs directly in the section, `.references > p`; a rule for the entries names them so, because a hint in the section, such as an alert of GitHub under the heading, has paragraphs too. |
| `h1.section-apx`, `h2.appendix`, `.appendix-label` | The appendix part, an appendix, and its label. |
| `.no-hyphens` | A part without soft hyphens. |

A relative `url()` names a file of the layout folder, for example
`url("fonts/LiberationSerif-Regular.ttf")`. Use fonts of the folder for pages
that look the same on every computer. A font whose license does not allow the
copy is replaced by a free font with the same metrics, for example Liberation
Serif for Times New Roman and Liberation Sans for Arial.

## 6. Templates

A template is HTML, for example the cover page, with the fields of the front
matter:

| Form | Effect |
| --- | --- |
| `{{title}}` | The value of the field `title`, with `<`, `>`, `&` and quotes escaped. |
| `{{#subtitle}}…{{/subtitle}}` | The part only when the field has a value. |
| `{{^subtitle}}…{{/subtitle}}` | The part only when the field has no value. |

A field without a value in the front matter has the `default` of
`layout.json`. A relative `src` or `href` names a file of the layout folder,
for example `<img src="images/logo.png" alt="Logo">`. A template has no logic
and no script.

## 7. The empty paper document and the preview

Each layout holds an empty paper document, `document.md`, and its PDF,
`document.pdf`. A new document starts from the empty paper document, and the
PDF shows the pages of the layout in the list of the layouts of a new project.

- The front matter of `document.md` holds the values of the cover page, for
  example the placeholder texts of the Word template, such as
  `title: "Titel eintragen"`. A new document gets them for the fields that the
  person does not give; its field `layout` is not used.
- The text after the front matter explains, with example texts, how to write
  a document of the layout: the text, the headings, the footnotes, a figure, a
  table, a listing, a citation with its source in the database, the special
  sections and the PDF. The texts of the template, such as the text of an
  affidavit, stay as the template has them; instructions of the template that
  only fit Word, such as how to update a table of contents in Word, stay out.
- A hint of the template under a heading, such as a text in a blue box that
  tells the author what the chapter holds, is an alert of GitHub with its text
  word for word: `> [!NOTE]` in one line and `> ` with the text in the next.
  GitHub shows it as a box, and the style sheet draws it as the box of the
  template (`.markdown-alert-note`, section 5).
- A file that `document.md` links to, for example `images/figure.svg` or the
  code of a listing in `code/`, is a file of the layout folder. A new project
  gets it at the same path, and the link in `paper/paper.md` gets `../`.
- The sources of the citations come from doi.org or from the source itself,
  with `mp source`, never from memory.

Write the preview after each change of the layout or of `document.md`:

```sh
npx -y @nimblescape/markdownpaper preview layouts/<name> --write
```

The command makes a project with `document.md` in a temporary folder, runs
the format steps of the paper (the citations, the reference list and the
lists of the special sections) and writes `document.pdf` into the layout
folder. `--write` also writes the formatted `document.md` back. A copy of the
layout, with "New Layout" or in a new project, leaves the preview out.

## 8. A layout on GitHub

A repository on GitHub with the topic `nimblescape-markdownpaper-layout`
holds layouts for everyone who can read it: one layout at its root, or one
folder for each layout, each with its own `layout.json`, up to two folder
levels deep. The name of a folder is the name of its layout. `mp
create` and "New Project" list these layouts, and
`--layout <owner>/<repository>/<folder>@<branch, tag or commit>` chooses one.
`mp create` clones the repository into `.markdownpaper/repos/<repository>/`
of the new project, which Git ignores, and the document names the layout with
this reference in its field `layout`; `mp get` clones it again where it is
missing. A tag or a commit keeps the pages of a project as they are; a branch
follows the layout. Keep one folder for each kind of work, without a version in
its name, for example `thesis/` and `concept/`, and give each release of the
layouts a tag, such as `v1.2.0`, which `mp get -u` finds as the newest one.

"New Project" in VS Code copies the layout into `layouts/<folder>/` and writes
the field `origin` into the `layout.json` of its copy (section 3); an author who
changes a layout copies it there too. `mp get` and "Update Layout" in VS Code
update the copy when the branch of `origin` has a newer version: a file that only the
repository changed gets its new version, a file that only the project changed
stays, and a file that both changed stops the update, unless `--force` (or the
confirmation in VS Code) replaces it. The `layout.json` of the copy keeps the
form of the file of the repository, with `origin` at its end, so a comparison
of the two files shows only real changes. A copy made by hand, for example with
`git archive`, gets the field by hand, with the full commit of its files:

```json
"origin": {
  "layout": "majikmate/markdownpaper-layout-pht/concept",
  "ref": "main",
  "commit": "c2907533d7d01329769c76e8f0efa23b48fa3bd1"
}
```

## 9. A layout from a Word template

A person adds the Word template (`.dotx` or `.docx`) to `source/` of the new
layout folder, with a PDF of a filled example when one exists; without a PDF,
print one from the template with LibreOffice
(`soffice --headless --convert-to pdf template.dotx`). Then:

1. Start the folder: `npx -y @nimblescape/markdownpaper new layout layouts/<name> --language de-AT`.
2. Read the template: a `.docx` or `.dotx` file is a ZIP file of XML files.
   - `word/document.xml`: the paper size (`w:pgSz`) and the margins (`w:pgMar`) of each section (`w:sectPr`), in twentieths of a point; 1 mm = 56.7 twips.
   - `word/styles.xml`: the styles Normal, Title, Heading 1 to 3, Quote, Caption, Footnote Text, TOC 1 to 3 and the lists, with font, size (`w:sz`, half points), line spacing (`w:spacing`), space before and after, alignment and indentation.
   - `word/numbering.xml`: the numbers of the headings, for example 1, 1.1, 1.1.1.
   - `word/header*.xml`, `word/footer*.xml`: the header and the footer, with fields such as the page number.
   - `word/media/`, `word/fonts/`: images such as the logo, and embedded fonts.
3. Write `page.css`: `@page` from the paper size and the margins, the margin boxes from the header and the footer, the styles of the text, the headings, the quotes, the captions, the footnotes and the table of contents.
4. Write the cover page as `cover.html` with the fields of the front matter, and the other fixed pages, for example the affidavit, and list them in `before` or `after`.
5. List the fields that the templates and the PDF name use in `fields` of `layout.json`, each with a description for the people and agents who write documents.
6. Copy the fonts into `fonts/` with their license files, and the logo into `images/`.
7. Write the empty paper document `document.md` with every element (headings, lists, a table with its caption, a figure with its caption, a listing, a quote, footnotes, the four lists, a reference list, an appendix) and the texts of the template (section 7), and make its PDF: `npx -y @nimblescape/markdownpaper preview layouts/<name> --write`.
8. Compare the pages with the PDF of the template, page by page as images side by side (for example `pdftoppm -r 60 -png`). Change the CSS and make the PDF again while a page differs, for example in the margins, the line spacing or the footer.
9. Write down in a comment of `page.css` what CSS cannot do as Word does.

What Word does in another way than the browser, measured on PDFs of Word for
the PHT layouts:

- Word puts the text at the top of a line and the added space of a line
  spacing such as 1.15 lines below it; the browser puts half of it above the
  text. Move the text up by that half with `position: relative; top: …`.
- Word uses the larger of the space after a paragraph and the space before
  the next one, as the margins of CSS do; a heading at the top of a page has
  no space before it.
- Word does not kern and makes no ligatures: `font-kerning: none;
  font-variant-ligatures: none`.
- Word shrinks the spaces of a justified line by up to about a fifth to fit
  one more word or syllable: `word-spacing: -0.045em` on the justified
  paragraphs; the renderer gives the last line of a paragraph its natural
  spaces again ([R-REN-012](requirements.md#r-ren-012)).
- A template that numbers its reference list needs
  `"headings": { "numberedSections": ["BIB"] }`, and a template with
  automatic hyphenation `"references": { "hyphenate": true }`.
- The browser puts a line on the whole pixel (1/96 inch) above it; half a
  pixel lower (0.375 pt) puts it on the nearest pixel.

The person reads the pages in the page preview of VS Code and commits the
layout folder.
