<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Writing a document for nimblescape Markdown Paper

These are the rules for a Markdown file that nimblescape Markdown Paper turns
into pages and a PDF. They are for people and for AI agents. Print them with
`npx -y @nimblescape/markdownpaper instructions document`.

## 1. Front matter and layout

The file starts with a front matter: YAML between two lines `---`. The field
`layout` names the layout: the name of a folder `layouts/<name>/` in the
folder of the file or in a folder above it, a built-in layout such as
`plain`, or a layout on GitHub with its reference
`<owner>/<repository>/<folder>@<rev>`, for example
`layout: majikmate/markdownpaper-layout-pht/thesis@main`. Without the field,
the file gets the built-in layout `plain`.

```markdown
---
layout: pht-thesis
title: "Agents in the work of teams"
author: "Hannes Stauss"
date: "30 October 2026"
---
```

- The other fields are the fields of the layout. `layout.json` of the layout
  lists them, each with a description; a required field must have a value,
  and a parameter of the layout, a field with `values`, takes one of its
  names, for example `variante: klassisch`.
  `npx -y @nimblescape/markdownpaper check <file.md>` names each missing
  field.
- The templates of the layout show the fields, for example on the cover page.
  Write the values as they show: the renderer writes nothing into the text of
  a field.
- The field `lang`, for example `lang: de-AT`, changes the language of the
  layout for this file: the hyphenation and the words that the renderer
  writes, such as "Abbildung" or "Figure".
- The paper names each other repository that it uses as a reference with a
  rev: the layout in `layout`, and the repositories of the code of its
  listings in the map `repos`, `<name>: <owner>/<repository>@<rev>`, for
  example `server: org/server@v2.1.0`. A tag or a commit as the rev pins the
  version; a branch, for example `@main`, takes the head of the branch.
  `npx -y @nimblescape/markdownpaper get` clones them into
  `.markdownpaper/repos/<name>/` of the project, which Git ignores; run it
  before `format`, `check` and `build`. The clone of a branch is on that
  branch: add a snippet there only when the author asks for it, and commit
  and push it in the clone. Change nothing in the clone of a tag or a commit:
  it pins the version.
  `get <owner>/<repository>@<rev>` adds a reference to `repos`; without
  `@<rev>` and without a terminal, it takes the default branch and writes it.
  `get -u` moves the references to tags to the newest tags.
- Do not write a cover page into the text: the layout makes it from the
  fields.

## 2. Headings

- `#` is a chapter, `##` a section, `###` a subsection. The renderer numbers
  them as 1, 1.1, 1.1.1 when the layout numbers headings. Do not write the
  numbers. A file whose headings start with numbers, such as `# 1 Einleitung`,
  keeps its numbers, and the renderer adds none.
- A heading with `{-}` at its end gets no number, nor do the headings below
  it: `# Abstract {-}`. The marker does not show.
- The headings of the special sections get no number, nor do the headings
  below them (section 3).
- A heading has the ID that GitHub gives it: its text in small letters,
  without punctuation and with a hyphen for each space, so `## Methoden` is
  `#methoden` and `# Quellen {BIB}` is `#quellen-bib`; a second heading of the
  same text gets `-1`. A plain Markdown link to a heading, as the slash command
  `/ref` of nimblescape Markdown Notes writes it, works on GitHub and on the
  pages: a link whose text is a word and a number, such as
  `[Kapitel 2.1](#methoden)`, shows the number of the heading on the pages; a
  link to an appendix shows its label, "Anhang A". Do not add an anchor to a
  heading; an anchor at its end, `<a id="sec-methods"></a>`, still works as a
  second ID.

## 3. Special sections and generated lists

A special section has a heading without a number. The renderer finds it by
the words of its heading in the language of the layout, or by the code of the
section in curly brackets at the end of the heading, for example
`# Quellen und Materialien {BIB}`. The marker does not show.

| Code | Section | German headings | English headings |
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
| `APX` | Appendix part: `APX-A`, `APX-B`, … for its appendices | Anhang, Anhänge | Appendix, Appendices |

A layout can change the words. The four lists stand in the file, as lists of
links between two hidden markers under their heading. The formatter writes
them and keeps them current; do not change them by hand:

```markdown
# Inhaltsverzeichnis

<!-- toc -->
- [1 Einleitung](#einleitung)
- [1.1 Methoden](#methoden)
<!-- /toc -->

# Abbildungsverzeichnis

<!-- lof -->
- [Abbildung 1: Teilnehmende nach Schulstufe](#fig-teilnehmende)
<!-- /lof -->
```

The markers of the list of tables and of the list of listings are
`<!-- lot -->` and `<!-- lol -->`. The pages show each list with the page of
each entry, and nothing else of its section. The table of contents lists the
headings after its own heading, to the depth of the layout; it does not list
itself. A section without the markers gets the list of the renderer.

## 4. Figures

A paragraph `Figure 1:` directly before an image alone in its paragraph is
the caption of the figure:

```markdown
Figure 1: Die Rollen von Agenten im Team

![Die Rollen von Agenten im Team](images/rollen.png)
```

The page shows "Abbildung 1: Die Rollen von Agenten im Team" above the image,
and the list of figures lists it. The word of the language, `Abbildung 1:`,
works too. The file holds the number of each caption, which the formatter of
nimblescape Markdown Notes writes; the pages keep it. An image alone in its
paragraph without a caption, such as a logo, is a figure without a caption
and without a number. An image within a line of text stays in the line. Write
the path of an image relative to the Markdown file.

An anchor at the end of the caption gives the figure a name for links, as the
slash command `/figure` of nimblescape Markdown Notes writes it; `/ref` writes
a link to it:

```markdown
Figure 1: Der Plan der Studie <a id="fig-plan"></a>

![Der Plan der Studie](images/plan.png)

[Abbildung 1](#fig-plan) zeigt den Plan.
```

The renderer writes the label of the figure as the text of each link to it
whose text is a word and a number, so "Abbildung 1" is always the number on
the page. A link with other words, such as `[den Plan](#fig-plan)`, keeps its
text.

## 5. Tables

A paragraph that starts with `Table 1:` directly before a table is the
caption of the table:

```markdown
Table 1: Teilnehmende nach Schulstufe

| Schulstufe | Anzahl |
| --- | --- |
| 10 | 12 |
```

The page shows "Tabelle 1: Teilnehmende nach Schulstufe" above the table.
The word of the language, for example `Tabelle 1:`, works too. The pages keep
the number of the file; a caption without a number, `Table:`, gets the next
number. A table without such a paragraph has no caption and no number.

An anchor at the end of the caption names the table for links, as the slash
command `/table` of nimblescape Markdown Notes writes it:
`Table 1: Teilnehmende nach Schulstufe <a id="tab-teilnehmende"></a>`. A link
`[Tabelle 1](#tab-teilnehmende)` gets the label of the table, as for figures.
`check` and the page preview warn about a link to `#fig-…`, `#tab-…`,
`#lst-…` or `#sec-…`, or a link whose text is a word and a number, whose
figure, table, listing or heading does not exist.

## 6. Listings

A listing is code of a source file of the repository, as the slash command
`/listing` of nimblescape Markdown Notes writes it: a paragraph `Listing 1:`,
the comment of the source, and a fenced code block. The caption is a link to
the file and the lines of the source (`#L12-L30`, one line `#L12`, no `#L`
for the whole file), followed by the cite of the source, and an anchor
`lst-…` at its end names the listing:

````markdown
Listing 1: [Reading the fields](../src/fields.ts#L12-L30) (fields.ts, L12-L30)<a id="lst-reading-fields"></a>

<!-- listing: ../src/fields.ts#read-fields -->

```typescript
export function readFields(lines: readonly string[]): Map<string, string> {
  …
}
```
````

The page shows "Listing 1: Reading the fields (fields.ts, L12-L30)" above the
code, without the link. A listing of a public repository of `repos` (section
1) has the link to its lines on the cite, and its address in a footnote. A link `[Listing 1](#lst-reading-fields)` gets the
label of the listing. Do not change the code, the link or the cite of a
listing by hand: the formatter of Markdown Notes writes them from the source.

## 7. Footnotes

A footnote is a Markdown footnote. Its text goes to the foot of the page of
its first reference:

```markdown
Die Interviews werden aufgezeichnet.[^1]

[^1]: Die Befragten stimmen der Aufzeichnung schriftlich zu.
```

The renderer numbers the footnotes 1, 2, 3 in the order of their first
references, whatever their labels are. A second reference shows the number of
the footnote again. The definition can stand anywhere in the file; lines
indented by four spaces after it belong to it.

Links in the PDF:

- Write every reference inside the paper as a Markdown link to its target: a
  heading, a figure, a table, a listing (sections 2 and 4 to 6) or a source
  (section 9). The PDF links it in the color of the text, without a mark.
- Write a link to the outside as a Markdown link with its own text, such as
  `[the report of the agency](https://example.org/report.pdf)`, or as the
  bare address. The PDF shows the text of the link and gives its address in
  a footnote, so that a printed page shows it. Do not write a footnote with
  the address yourself.
- The reference list writes the full address of a source, a DOI as
  `https://doi.org/…`; the format writes it (section 9).

## 8. Reference list and appendix

- A chapter heading `# Literaturverzeichnis` or `# References` (more words in
  section 3) starts the reference list. Its entries get no soft hyphens; the
  layout gives them their indent.
- A chapter heading `# Anhang` or `# Appendix` after the reference list starts
  the appendix part. Each `##` heading in it is one appendix: the renderer
  labels it "Anhang A", "Anhang B" (one appendix only: "Anhang"), and numbers
  its figures, tables and listings A1, A2, B1, as APA 7 does.

```markdown
# Anhang

## Interviewleitfaden

…

## Transkripte

…
```

## 9. Sources and citations

The format writes the text of each citation and the entries of the reference
list from the data of the sources, in the citation style of the layout. Do not
write the text of a citation or of an entry yourself.

1. **Add the source** to the comment `nimblescape-sources` at the end of the
   file, one line of CSL JSON for each source, with the command
   `mp source`:

   ```sh
   mp source paper/paper.md 10.3390/bs9040039 978-3-8252-4753-9 inbox/export.ris
   ```

   ```markdown
   <!-- nimblescape-sources
   {"id":"hong2024","type":"paper-conference","author":[{"family":"Hong","given":"Sirui"}],"issued":{"date-parts":[[2024]]},"title":"MetaGPT"}
   -->
   ```

   - An input is a DOI, an ISBN, a PubMed ID, an arXiv ID, a web address, or
     a file: an export in RIS, BibTeX or CSL JSON from a database or a
     reference manager, a web page that you saved as HTML, or a PDF whose
     metadata names its DOI. The command takes the metadata from doi.org, the
     catalogs of the libraries, PubMed or arXiv, or from the file, gives each
     new source its ID, and does not add a source that the database has
     already.
   - `mp source --search "<title>"` lists up to ten works of
     Crossref with their DOIs. Add the right one by its DOI.
   - For each input, the command prints the ID, where the metadata came from,
     and the fields that the source needs and did not get. Take such a field
     from the source itself, such as the title page of a PDF in `inbox/`, or
     leave it out.
   - A PDF without a DOI in its metadata adds nothing; the command lists the
     DOIs in the file, which can also be the works that the paper cites. Give
     the DOI of its title page.
   - A web page that the network does not reach: open it in the browser,
     save it as HTML in `inbox/`, and give the file.
   - `--id <id>` gives the ID of the one new source, for example of a law;
     `--dry-run` prints the new lines and writes nothing; `--offline` asks no
     service. The exit code is 1 when an input gave no source.
   - When you have the source in hand, such as a PDF in `inbox/`, give words
     of its title with `--title "<words>"`: a record whose title lacks one of
     them adds nothing, because a catalog can give a DOI or an ISBN to another
     work. A record of an ISBN from a year before ISBNs existed adds nothing,
     and a record that only Open Library knows comes with a note: compare its
     title, authors and year with the source itself.
   - **You must not write metadata from memory.** Each field comes from the
     command or from the source. Leave out a field that you cannot take from
     there, and say which source has no metadata yet. Write a line yourself
     only for a source that no input of the command describes, from the
     source itself.
   - The ID of a source: the family name of the first author and the year in
     small letters, without accents and spaces, with "ae", "oe" and "ue" for
     the German umlauts (`hong2024`, a second work `hong2024a`); an
     organization by its full name and the year
     (`worldeconomicforum2025`); a law by its place of publication
     (`bgbl-ii-262-2015`); no year without a date.
   - A law or an ordinance has no DOI: write its line from its text in the
     official legal information system, such as the RIS of Austria
     (ris.bka.gv.at) or EUR-Lex. Its type is `legislation` for a law and
     `regulation` for an ordinance; `title` is its title; `container-title`
     and `number` are the gazette and the number of its first publication as
     the gazette writes them (`"BGBl."` and `"Nr. 134/1963"`, `"BGBl. II"`
     and `"Nr. 262/2015"`, `"ABl. L"` and `"2024/1689"`); `references` is the
     version that the text cites (`"BGBl. II Nr. 303/2012"`), left out for
     the first version; `issued` is the day of that version, or of the law
     without a version, with day, month and year, or only the year when the
     source does not give the day; and `URL` and `accessed`
     name the page of the text. The PHT style writes
     `Lehrplan der Volksschule. BGBl. Nr. 134/1963 in der Fassung BGBl. II Nr. 303/2012 vom 13. September 2012.`
   - Each source stays on one line. Write `>` in a text as `\u003e`.
   - A web page that can change gets the day of the access:
     `"accessed":{"date-parts":[[2026,10,30]]}`; the command adds it.
2. **Cite the source** with a link to its ID where the text states what the
   source says. The text of the link does not matter; the format writes it.
   - In parentheses after the statement: `([Hong et al., 2024, S. 3](#hong2024 "page 3"))`.
   - As a part of the sentence: `[Hong et al. (2024)](#hong2024 "narrative") zeigen …`.
   - Two sources in one pair of parentheses:
     `([Hong et al., 2024](#hong2024); [Shao, 2025](#shao2025))`.
   - Two works of the same authors, with a comma between the links:
     `([Levitt, 1972](#levitt1972), [1976](#levitt1976))`; the format writes
     only the year of the second.
3. **Give the place** in the source in the title of the link, with a CSL term
   and its value: `page 3`, `page 13-14`, `chapter 2`, `section 4.1`,
   `figure 1`, `table 2`, `paragraph 5`, and in a law `section 65` (§ 65),
   `article-locator 4` (Art. 4) or `appendix 1`. Add `narrative` for a
   citation in the sentence: `"narrative page 3"`.
4. **Format the file** (section 12). The format writes the text of each link,
   and the entries of the cited sources under the heading of the reference
   list (section 8); without the section, it adds one before the appendix part.
   An entry starts with the anchor of its source,
   `<a id="hong2024"></a>Hong, S. (2024). …`; the format removes the entry of
   a source that the text no longer cites.
5. **"(RESEARCH)"** in the text asks for the evidence of an argument. The
   argument is the text from the hidden start marker `<wbr><!--[research-->`
   to `(RESEARCH)`, which the author selected; without a start marker, it is
   the sentence before `(RESEARCH)`:

   ```markdown
   <wbr><!--[research-->Feedback changes learning more than praise does (RESEARCH).
   ```

   Find sources that support the argument, add them with `mp
   source`, remove the start marker, and replace `(RESEARCH)` with their
   citations. When no source supports the argument, keep both marks and say
   so.

## 10. Notes of nimblescape Markdown Notes

A footnote whose label is `note-` and four small letters or digits, for
example `[^note-7k2q]`, is a note of the authors (format of
nimblescape Markdown Notes, version 1). The pages leave the notes out: their
references, their start markers `<wbr><!--[note-7k2q-->` and their
definitions. Keep a note as it is unless you are asked to change it.

## 11. What the pages do not show

- HTML comments, for example the comment of the format of the notes and the
  comment of the sources.
- Scripts: a script in the Markdown text or in a template does not run.

## 12. Checks

```sh
npx -y @nimblescape/markdownpaper get
npx -y @nimblescape/markdownpaper format paper/paper.md
npx -y @nimblescape/markdownpaper check paper/paper.md
npx -y @nimblescape/markdownpaper build paper/paper.md
```

`get` clones the repositories that the front matter names, or brings the head
of each branch (section 1).

`format` writes the citations and the reference list (section 9) and the lists
of the special sections (section 3) into the file. `check` names a layout that
does not exist, each missing required field, and the problems of the sources
and the citations.
`build` writes the PDF beside the file; see `instructions render`.
