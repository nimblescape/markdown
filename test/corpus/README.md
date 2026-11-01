<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Corpus of the round-trip tests

The tests of the Markdown of the editor (`src/markdown/codec.test.ts`) read
each Markdown file of this folder, except this README: the editor must write
each file back byte for byte when nothing changed, and a file that it writes
new must show the same HTML in markdown-it.

| File | Source |
| --- | --- |
| `gfm.md` | Written for these tests: the parts of GFM, footnotes and HTML |
| `front-matter-toml.md`, `front-matter-json.md` | Written for these tests: a front matter in TOML and in JSON |
| `notes-format.md`, `notes-features.md` | `docs/format.md` and `docs/features.md` of [nimblescape/markdownnotes-vscode](https://github.com/nimblescape/markdownnotes-vscode) at commit `4c41a88` (MIT) |
| `paper-document.md`, `paper-layout.md` | `docs/document.md` and `docs/layout.md` of [nimblescape/markdownpaper-vscode](https://github.com/nimblescape/markdownpaper-vscode) at commit `aa2c892` (MIT) |
