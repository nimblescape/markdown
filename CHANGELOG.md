# Change log

Each section lists the changes of one released version of the npm packages
of nimblescape Markdown. All packages have the same version. The release
workflow takes the section of a version as the notes of its GitHub release.

## 0.1.0

The first version of the packages.

- `@nimblescape/markdowntext`: the text of a file as the only truth, with
  the changes and their origin, the selections of the editors, the changes
  from outside, and the reading, the edits and the check of a front matter
  in YAML, TOML or JSON.
- `@nimblescape/markdownrender`: the renderer of Markdown with markdown-it,
  as GitHub shows it, with GitHub alerts, footnotes, task lists, the IDs of
  the headings, raw HTML only from a fixed list of safe elements, plugins
  of the renderer, and the way back after a jump in a rendered page.
- `@nimblescape/markdowneditor`: the editor of rendered Markdown, for the web
  and for the webviews of VS Code. Each block that the user does not change
  keeps its text byte for byte. It has a toolbar, a format bar, an insert
  menu, slash commands, block handles, find and replace, tables, a read-only
  mode, a form of the front matter, syntax colors of code blocks, jumps to
  places of the document with Go Back and Go Forward, threads
  beside the text, proposed changes as tracked changes, and version 1 of the
  plugin API.
- `@nimblescape/markdownlayout`: layouts with the schema of their front
  matter, the pages of a document with Paged.js, and the PDF in Node.js; the
  page runs only its own scripts and loads nothing from the internet. No text
  is lost or shows twice at a page break, and a reference to a place in a
  source, such as "S. 18 – 19", stays on one line.
- `@nimblescape/markdownai`: the provider API of an AI, the context of the
  document, the tool of the proposed changes and the loop of a chat, without
  a provider of its own.

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
