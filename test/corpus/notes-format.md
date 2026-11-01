<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Format of the notes

This document specifies version 1.0.0 of the format of the notes in Markdown
files, which the VS Code extension nimblescape Markdown Notes reads and
writes. It is for people and for programs, for example AI agents, that read,
change or add notes without the extension. A file that follows it stays plain Markdown:
GitHub shows each note as a footnote at the end of the page, or, in the
hidden form of [section 11](#11-the-hidden-form), hides every note.

The [requirements](requirements.md) define how the extension shows the notes;
this document defines only the text of a file. The words "must" and "must
not" are rules: a program that breaks one writes a file that the extension
or GitHub does not show as intended.

## Example

```markdown
<!-- nimblescape-markdownnotes v1.0.0 spec=https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/format.md
This comment marks a Markdown file with notes of the VS Code extension nimblescape Markdown Notes.
AI agents: read the spec above before you read, change or add a note, and keep this comment as it is.
A note is a footnote with the label "note-" and four small letters or digits, for example [^note-7k2q].
Its reference ends the highlight of the note. Its start marker starts the highlight: <wbr> and an HTML
comment with "[", the label and an optional color name. Every note has one. The definition follows the
block of the highlight: "[^note-7k2q]: **login** · date", a blank line, and the body indented by four
spaces. Each reply is a block quote with its own header. With the word "hidden" in the first line, each
definition is in an HTML comment of its own, the reference is the comment with the label and "]", and the
text of a note escapes each end of a comment with one more backslash before its ">".
-->

# Title

The agents <wbr><!--[note-7k2q green-->change the work of teams[^note-7k2q] in three ways.

[^note-7k2q]: **hannes** · 2026-10-28 10:15+01:00

    Which three ways?

    > **anna** · 2026-10-28 11:02+01:00
    >
    > The ways of the plan.
    >
    > > **hannes** · 2026-10-28 11:30+01:00
    > >
    > > Thanks, then I change the text.

The next paragraph.
```

The note `note-7k2q` belongs to the highlight "change the work of teams",
the text from its start marker to its reference, as a text marker highlights
text on paper. The note is green. Hannes wrote the note, Anna replied to it,
and Hannes replied to Anna.

## 1. The comment of the format

A file with notes starts with a comment that names the format, like a
DOCTYPE. GitHub and the Markdown preview do not show it.

- The first line is exactly `<!-- nimblescape-markdownnotes v1.0.0
  spec=https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/format.md`,
  on one line. `v1.0.0` is the version of this format, and `spec=` is the
  address of this document. A comment with the address
  `https://github.com/nimblescape/nimblescape-markdown-notes/blob/main/docs/format.md`,
  of the repository before its rename on 2026-10-30, is valid too and stays
  as it is: GitHub forwards that address to this document.
- In a file whose notes are in the hidden form
  ([section 11](#11-the-hidden-form)), the first line holds the word
  `hidden` after the version:
  `<!-- nimblescape-markdownnotes v1.0.0 hidden spec=…`. A first line
  without the word means the visible form, the form of sections 3 to 6.
- The lines after it are a short hint in words. They must not hold `-->`,
  because `-->` ends the comment, and they hold no blank line.
- The last line is `-->`.
- The comment is the first line of the file. A file with a front matter keeps
  the front matter as its first block: then the comment starts on the line
  after the line that ends the front matter (`---` or `...` for YAML, `+++`
  for TOML). A blank line follows the comment.
- A file has one such comment. A program that adds the first note of a file
  adds the comment; a program that removes the last note removes it.
- A file without the comment can have notes too, for example an older file:
  the rules below find them.
- A comment whose first line names `nimblescape-markdown-notes`, the name of
  the format before 2026-10-30, counts as a comment of an older version: a
  program that changes a note writes it anew with the current name.

### 1.1 The version of the format

The version is a semantic version, `v` and three numbers MAJOR.MINOR.PATCH:

- **MAJOR** grows with a form of the notes that a program of a lower major
  version would read wrongly. Each major version has its own specification,
  and its comment names that document in `spec=`. A program must not change
  the notes of a file whose major version is higher than its own; it can
  still read the file as Markdown.
- **MINOR** grows with optional elements that a program of a lower minor
  version reads as notes and keeps as they are when it changes the file.
- **PATCH** grows with a change of only the words of the comment or of this
  document.
- After the first release of the extension, each change of the form of the
  notes raises the version.

A program writes the comment anew only when the version that it writes is
higher than the version in the file. When the version in the file is equal or
higher, the program keeps the comment as it is, also when its words differ, so
that two programs of different versions do not change the comment back and
forth. A first line without a version, for example from a version before
1.0.0, counts as lower than every version.

## 2. The label of a note

- The label is `note-` and four small letters or digits, for example
  `note-7k2q`: it matches `^note-[a-z0-9]{4}$`.
- The four characters are random.
- No other footnote of the file has the label, and no other note.
- A footnote with another label, for example `[^1]`, is no note and stays a
  footnote.

## 3. The reference

- The reference `[^note-7k2q]` ends the highlight of the note: it is the end
  marker of the highlight. GitHub shows it as the number of the footnote.
- It stands in the text of a paragraph, a heading, a list item or a table
  cell, after the last character of the highlight.
- It must not stand in a code span, in a code block, in the text of a link
  (it then stands directly after the link) or in the text of a note.
- Each note has one reference.

## 4. The start marker

- Every note has one start marker, `<wbr><!--[note-7k2q-->`, directly before
  the first character of its highlight, in the same block as the reference.
  The highlight is the text from the start marker to the reference, and it
  holds at least one character.
- The start marker is the element `<wbr>` and an HTML comment with `[` and the
  label. GitHub and the Markdown preview show neither of them. `<wbr>` lets the
  marker also stand at the start of a line: there, a comment alone would start
  a block of HTML, which ends the paragraph.
- The comment can name the color of the note after the label and a space:
  `<wbr><!--[note-7k2q green-->`. The colors are `blue`, `green`, `orange`,
  `purple`, `red` and `teal`. A marker without a color has the color `blue`,
  the default, which is never written.
- A reader also accepts a start marker without `<wbr>` that does not stand at
  the start of a line, for example of an older file. The formatter adds the
  `<wbr>`, and adds the start marker of a note without one at the start of the
  text of its block.
- Highlights of different notes can overlap.

## 5. The definition

The definition is the note itself: the first answer and its replies.

- It stands after the outermost block that holds the reference: after the
  paragraph or the heading, after the whole list, after the whole block quote,
  after the table. GitHub shows no footnote that is defined in a block quote.
  The definitions of several notes of one block follow each other in the
  order of their references.
- A blank line stands before and after it.
- Its first line is the label and the header of the first answer:
  `[^note-7k2q]: **hannes** · 2026-10-28 10:15+01:00`.
- A blank line and the body of the first answer follow, each line indented by
  four spaces. A blank line of the body is empty.

### The header of an answer

- The header is `**login** · date`: the GitHub login of the author in bold, a
  space, a middle dot (U+00B7), a space, and the date.
- The login starts with a letter or a digit and has at most 39 letters,
  digits, `-` and `_`.
- The date is the local date and time of the author with the offset of the
  time zone: `YYYY-MM-DD HH:MM+HH:MM`, `YYYY-MM-DD HH:MM-HH:MM`, or
  `YYYY-MM-DD HH:MMZ` for UTC.
- The header of the first answer of a todo note ends with a space, a middle
  dot, a space and the state of the todo: `todo` while it is open, `done`
  when it is completed, for example
  `[^note-7k2q]: **hannes** · 2026-10-29 18:30+01:00 · todo`. The header of a
  reply has no state. A note without a state is no todo.

### The body of an answer

The body is Markdown: paragraphs, headings, lists, code, links, tables and
so on. A block quote whose first line is a header must not stand in a body,
because it starts a reply.

## 6. The replies

The answers of a note are a tree, as in a discussion on Reddit.

- A reply to the note is a block quote in the definition, after the body of
  the first answer: a blank line, then `    > **anna** · date`, a line
  `    >`, and the body with `    > ` before each line; a blank line of the
  body is `    >`.
- A reply to a reply stands in the block quote of the answer that it replies
  to, one level deeper: a line `    >`, then `    > > **hannes** · date`, a
  line `    > >`, and the body with `    > > ` before each line.
- A reply stands after the answer that it replies to and after the earlier
  replies to that answer with their replies, so that the file reads from the
  first answer to the last reply in the order of the tree.

## 7. Rules for a program

A program, for example an AI agent, follows these steps:

- **Read the notes:** find the definitions whose label is a label of a note
  and whose first line has a header; the highlight of each note is the text
  from its start marker to its reference.
- **Add a note:** choose a new label; write the start marker
  `<wbr><!--[note-7k2q-->` before the highlight and the reference after it;
  write the definition after the outermost block of the highlight, with the
  login of the author and the current local time with the offset; add the
  comment of the format when the file has none, or write it anew when its
  version is lower than yours ([1.1](#11-the-version-of-the-format)).
- **Color a note:** write the name of the color after the label in its start
  marker, or remove the name for the default color.
- **Mark a todo:** write ` · todo` at the end of the header of the first
  answer for an open todo, and ` · done` when it is completed; keep the date.
  When the first answer goes, its state goes to the answer that takes its
  place.
- **Answer:** write the reply at its place in the tree, with its own header.
- **Change an answer:** change its body, keep its author, and write the
  current local time with the offset as its date.
- **Delete an answer:** remove its header and body; its replies stay and move
  one level up. Deleting the only answer deletes the note.
- **Delete a note:** remove its definition with one blank line next to it, its
  reference and its start marker, only when the user asks for it.
- **Hidden notes:** in a file whose comment of the format holds the word
  `hidden`, write each note in the hidden form
  ([section 11](#11-the-hidden-form)): the definition in its own comment,
  escaped, and the end marker in place of the reference. Never write a note
  of the visible form into such a file; the formatter would change it.
- Never change a label, never write a start marker without `<wbr>`, never
  write a note without a start marker or a highlight without text, never put a
  definition into a block quote, and never write a note into a code block.
- **Format the file** after a change, as the extension does on save: run
  `markdownnotes format <file>` with Node.js 22 or later.
  `markdownnotes format --check <file>` changes nothing and exits with 1
  when the file is not formatted. The formatter puts
  each paragraph on one line, aligns the tables, gives each start marker its
  `<wbr>`, adds the start marker of a note without one, writes the numbers of
  the captions and of the links to figures and tables
  ([8](#8-figures-tables-and-links-to-them)), and keeps the answers of the
  notes, code blocks and HTML as they are. For now there is no release, so
  the npm package `@nimblescape/markdownnotes` is not on npmjs.com: install
  it from GitHub, with a clone of the repository, as
  [CONTRIBUTING.md](../CONTRIBUTING.md#npm-package) describes. After a
  release, `npx -y @nimblescape/markdownnotes format <file>` runs it without
  an installation.
- **Publish a text without notes:** when the user asks for the text of a
  file without its notes, for example for a website or a PDF, run
  `markdownnotes strip <file>`, which writes it to the standard output, or
  `markdownnotes strip --out <folder> <file>...` for copies. Never delete the
  notes from the file itself for this.
- **Add a figure or a table:** write its caption line before it, for example
  `Figure: Plan of the study`, a blank line and the image; the formatter
  writes the number ([8](#8-figures-tables-and-links-to-them)).
- **Link to a figure or a table:** give it an anchor at the end of its caption
  when it has none, and write a link with a word and a number to it
  ([8](#8-figures-tables-and-links-to-them)).

An AI agent writes as the author the GitHub login of the person that it works
for, or a GitHub login of its own; the author of an answer is always known.

## 8. Figures, tables and links to them

The extension also adds figures, tables and links to them and to sections
([R-XREF-001](requirements.md#r-xref-001)). They are plain Markdown and HTML
and not part of the notes, so the version of the format stays 1.0.0.

```markdown
Figure 1: Plan of the study<a id="fig-plan-study"></a>

![Plan of the study](images/plan.png)

Table 1: Participants by grade<a id="tab-participants-grade"></a>

| Grade | Participants |
| ----- | ------------ |
| 5     | 12           |

As [Table 1](#tab-participants-grade) and [Figure 1](#fig-plan-study) show, …
```

- A figure, a table and a listing of code ([10](#10-listings-of-code)) have a
  caption: a paragraph that starts with a word, a number and a colon, and
  stands directly before the paragraph of the image, before the table, or
  before the comment of the listing, with one blank line between them. The
  words are `Figure` or `Abbildung`, `Table` or `Tabelle`, and `Listing`.
- A figure is an image that stands alone in its paragraph after its caption.
  An image without a caption is no figure.
- The number of a caption is the place of the item among the items of its
  kind in the file, from 1. The formatter writes it anew after each change
  of the order, also into a caption without a number, for example
  `Table 2:` for `Table:`. The word and the text stay. Headings have no
  numbers ([R-GEN-016](requirements.md#r-gen-016)).
- The anchor of a figure or a table stands at the end of its caption:
  `<a id="fig-` or `<a id="tab-`, a name of small letters, digits and
  hyphens, and `"></a>`. The name is unique in the file. An image of the
  older form with the anchor at its end and without a caption still counts
  as a figure; the formatter gives it a caption line with the text of the
  image.
- A file with a generated list, such as the list of figures between
  `<!-- lof -->` and `<!-- /lof -->` (`lot` for tables, `lol` for listings),
  gets an anchor at each caption of that kind from the formatter. Markdown
  Paper writes the entries of the lists.
- A link to a figure or a table has a word and a number as its text, for
  example `[Table 1](#tab-participants-grade)` or
  `[Abbildung 2](#fig-plan-study)`. The number is the place of the figure
  among the figures of the file, or of the table among its tables, from 1;
  the formatter writes it anew after each change of the order. The word is
  free.
- A section is the part of the text under a heading. A link to it names the
  ID that GitHub gives its heading, and has the numbers of the sections
  around it and its own, for example `[Chapter 2.1](#methods)` for
  `### Methods`. The ID is the text of the heading as the page shows it, in
  small letters, without the characters that are no letter, digit, `_`, `-`
  or space, with a `-` for each space; a second heading of the same ID gets
  `-1`, a third one `-2`. The heading has no anchor. The formatter writes
  the number only in a link whose word is "Chapter", "Kapitel", "Section" or
  "Abschnitt". The first level of the numbers is the highest level that more
  than one heading has, or else the highest level of a heading. An anchor of
  the earlier form at the end of the text of a heading,
  `## Methods<a id="sec-methods"></a>`, still names its section
  ([R-XREF-003](requirements.md#r-xref-003)).
- A figure, a table, a listing, a heading, an anchor or a link in a code
  block, in HTML, in the front matter or in the text of a note does not
  count.

## 9. Values of the front matter

A value of the front matter stands in the text between two markers
([R-XREF-004](requirements.md#r-xref-004)):
`<wbr><!--{author.name}-->Hannes Stauss<!--{/author.name}-->`.

- The start marker is `<wbr>`, `<!--{`, the key and `}-->`; the end marker is
  `<!--{/`, the same key and `}-->`. The key of a value under another key is
  the path of the keys with `.`. The value has no marker in it and stands on
  one line.
- The formatter writes the current value of the key between the markers. A
  list is its items joined by `, `, and a block scalar its lines joined by
  spaces.
- A program that changes the value in the text without the front matter
  loses the change with the next format: change the front matter.

## 10. Listings of code

A listing is a fenced code block whose code comes from a source file of the
repository ([R-CODE-001](requirements.md#r-code-001)):

````markdown
Listing 1: [Reading the fields](../src/notes/fields.ts#L12-L30) (fields.ts, L12-L30)<a id="lst-reading-fields"></a>

<!-- listing: ../src/notes/fields.ts#read-fields -->

```typescript
export function readFields(lines: readonly string[]): Map<string, string> {
  …
}
```
````

- The comment of the source stands on its own line directly before the code
  block, with a blank line or none between them: `<!-- listing: `, the path
  of the file relative to the Markdown file with `/` and the escapes of a
  link (`%20` for a space), and ` -->`. Without `#` after the path, the
  listing is the whole file.
- After the path, `#` and a name name a snippet of the file: the lines
  between the comments `markdownnotes: snippet <name>` and
  `markdownnotes: /snippet <name>`, in any comment form of the language, for
  example `// markdownnotes: snippet read-fields`
  ([R-CODE-003](requirements.md#r-code-003)). The name has small letters and
  digits, with `-` between them. The code of a listing leaves out the marks
  of all snippets. A function, a class or a method is a snippet around it:
  the name never names a symbol of the language
  ([R-CODE-005](requirements.md#r-code-005)), and the formatter reports a
  listing whose snippet the file does not have as not found.
- The caption line `Listing 1:` before the comment, with only blank lines
  between them, and the anchor `lst-…` at its end, work as those of a table;
  a link to it is `[Listing 1](#lst-reading-fields)`.
- The text of the caption is free text and a link to the source: the path of
  the comment, and for a snippet `#L`, the first line, `-L` and the last
  line of the snippet in the source file, from 1, from the line after the
  start mark to the line before the end mark, for example
  `../src/notes/fields.ts#L12-L30`, or `#L12` for one line. A whole file has
  no lines.
- After the link, separated by one space, stands the cite of the source in
  parentheses: the name of the file without its folders and with its
  escapes decoded, `, ` and the lines of the link, for example
  `(fields.ts, L12-L30)`, or only the name for a whole file, `(fields.ts)`.
  A reader of a printed page or of a viewer without links sees the source
  in it ([decision 45](requirements.md#decisions)).
- The formatter writes the current code of the source into the code block,
  and the link around the caption with the current lines and the cite after
  it ([R-CODE-002](requirements.md#r-code-002)). A program that changes the
  code in the Markdown file, the lines of the link or the cite loses the
  change with the next format: change the source file. An AI agent that
  adds a listing writes the caption line `Listing: ` with its text, the
  comment and an empty code block, and runs `markdownnotes format`, which
  writes the number, the link, the cite and the code.

### 10.1 Listings of files of other repositories

A paper about a project of more than one repository shows code of each
repository ([R-CODE-006](requirements.md#r-code-006)). The YAML front matter
of the paper names each other repository under `repos` as a GitHub reference
`owner/repo@rev`, and the comment of a listing names the reference and the
path in its repository:

````markdown
---
title: The server of the project
layout: majikmate/markdownpaper-layout-pht/thesis@main
repos:
  server: org/server@v2.1.0
---

Listing 1: [Reading the request](https://github.com/org/server/blob/3f2a…/src/api.ts#L12-L30) (api.ts, L12-L30)<a id="lst-reading-the-request"></a>

<!-- listing: server:src/api.ts#read -->

```typescript
…
```
````

- The name of a reference has letters, digits, `.`, `_` and `-`, from a
  letter or a digit. The rev after `@` alone says how the paper follows the
  repository: a tag, for example `@v2.1.0`, or a commit pins the version; a
  branch, for example `@main`, takes the head of the branch. Without `@rev`,
  the reference takes the default branch. The front matter holds no other
  commit, and the paper needs no lock file. The key `layout` is a reference
  of the same form, with the folder of the layout after the repository.
  The older form with the prefix `github:`, `github:org/server@v2.1.0`, is
  read too.
- The comment of the listing names the reference, `:` and the path of the
  file in its repository, with `/`, without `..`, and with the escapes of a
  link: `<!-- listing: server:src/api.ts#read -->`. A snippet works as in a
  file of the paper repository.
- The command `mp` of nimblescape Markdown Paper clones each reference
  into `.markdownpaper/repos/<name>/` of the project, a folder that Git
  ignores: a reference to a branch on that branch, and a reference to a tag
  or a commit detached at it. The formatter reads the file from the clone in
  the folder of the Markdown file or in the first folder above it that has
  the clone.
- New snippets go only into a clone on a branch, where the author commits
  and pushes them. A clone of a tag or a commit stays at that version: a
  listing uses only the snippets that it has.
- The link of the caption goes to the file on GitHub at the commit of the
  clone when the formatter wrote the code,
  `https://github.com/org/server/blob/<commit>/src/api.ts#L12-L30`, so the
  link shows the code of the code block, also for a reference to a branch.
  The cite after the link stays `(api.ts, L12-L30)`.
- A listing whose reference is not under `repos`, or whose repository is not
  cloned, keeps its code, and the formatter reports it.
- An AI agent and CI run the commands of Markdown Paper with npx: `npx -y
  @nimblescape/markdownpaper get owner/repo@rev --name <name>` writes a
  reference into the front matter and clones it; in a project with more
  than one paper, the path of the Markdown file follows. `npx -y
  @nimblescape/markdownpaper get` clones the missing repositories and pulls
  the branches, before `markdownnotes format` and before the PDF. The agent
  edits no reference and no clone by hand. Until the first release, npx
  installs the packages from their GitHub repositories
  ([decision 48](requirements.md#decisions)).

## 11. The hidden form

GitHub and other viewers show the notes of the visible form as footnotes. In
a file whose notes are hidden from other viewers, every note is in the hidden
form, which every Markdown viewer hides, also GitHub
([R-HIDE-001](requirements.md#r-hide-001)):

````markdown
<!-- nimblescape-markdownnotes v1.0.0 hidden spec=https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/format.md
…
-->

The agents <wbr><!--[note-7k2q green-->change the work of teams<!--note-7k2q]--> in three ways.

<!--
[^note-7k2q]: **hannes** · 2026-10-28 10:15+01:00

    Which three ways? The page has the comment `<!-- plan --\>`.

    > **anna** · 2026-10-28 11:02+01:00
    >
    > The ways of the plan.
-->

The next paragraph.
````

- The first line of the comment of the format holds the word `hidden`
  ([section 1](#1-the-comment-of-the-format)). A file in the hidden form
  always has the comment.
- The start marker is the same as in the visible form
  ([section 4](#4-the-start-marker)).
- The end marker `<!--note-7k2q]-->`, an HTML comment with the label and
  `]`, takes the place of the reference `[^note-7k2q]` and follows the rules
  of [section 3](#3-the-reference). It must not stand at the start of a line,
  where it would start a block of HTML, which ends the paragraph.
- The definition is an HTML comment of its own: a line `<!--`, the
  definition as in sections 5 and 6, and a line `-->`, at the place of the
  definition of the visible form, with a blank line before and after the
  comment. In a block quote or a list item, each line of the comment has the
  prefix of the block quote or the list item.
- **Escape:** an HTML comment ends at the first `-->`, and a browser also
  ends it at `--!>`. Inside the comment of a note, each place where `--` or
  `--!` is followed by any number of backslashes and then `>` gets one more
  backslash before the `>`: `-->` becomes `--\>`, `--!>` becomes `--!\>`,
  and `--\>` becomes `--\\>`. A reader removes one backslash from each such
  place. So the text of a note can hold any text, also HTML with comments.
- A program reads the text of a note of the hidden form as the definition
  between the lines `<!--` and `-->`, without the escape, and writes a
  changed note back with the escape.
- The formatter writes each note in the form of its file: a note of the
  visible form in a file of the hidden form goes into the hidden form, for
  example after a merge, and the other way.
- [example-hidden.md](example-hidden.md) is a file in the hidden form. GitHub
  shows none of its notes, and its paragraphs, list, table and block quote
  stay whole.

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdownnotes-vscode/blob/main/LICENSE).
