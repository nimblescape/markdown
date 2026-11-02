<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the plugins and format extensions

This document defines how plugins extend the parts of nimblescape Markdown,
and the plugins of the format extensions nimblescape Markdown Notes and
nimblescape Markdown Paper. It is part of the
[specification](specification.md) of nimblescape Markdown and normative in
the same way. [Section 5](#5-open-questions) lists its open questions.

## 1. General

### R-GEN-005

**Extension through a clean API.** Notes and Paper extend the libraries with
their functions through a documented plugin API. The plugins of each
extension live in the repository of that extension. The libraries hold the
general functions; a plugin adds only the functions of its extension.

## 2. Levels of a plugin

### R-GEN-012

**Extensions that render, or render and edit.** A plugin works at one of two
levels:

- *Render:* a plugin of the renderer ([R-REN-002](rendering.md#r-ren-002)).
  The editor must keep the text of such a block byte for byte as one unit.
  The user changes it through its source (double click or "Edit source"),
  and the editor then parses this block again.
- *Render and edit:* in addition a plugin of the editor: nodes and marks
  with their views, which token becomes which node or mark, how a changed
  node is written, commands, keys, input rules, items of the menus (insert,
  slash, format bar, block menu, table menu), panels, highlights, the schema
  of the front matter, and the marks for the mode to learn Markdown
  ([R-GEN-013](editor.md#r-gen-013)).

A plugin may start with the level "render" and add the level "render and
edit" later, without a change of the file format. The Markdown API of VS
Code (`markdown.markdownItPlugins`, `markdown.previewStyles`,
`markdown.previewScripts`) is the reference of the plugin API.

### R-PLUGIN-001

**The plugin object.** A plugin is one object: `{ name, apiVersion: 1,
extendMarkdownIt?, styles?, render?, nodes?, marks?, fromMarkdown?,
toMarkdown?, commands?, keys?, menus?, frontMatterSchema?, activate?(editor,
host) }`. `activate` gets the API of the editor and of the platform, and
returns what to dispose.

## 3. Markdown Notes

### R-NOTES-001

**The plugins of Notes.** Notes adds the notes: highlights in colors with
hidden markers, the hidden form, and the comment of the format, hidden. It
adds the threads of the notes ([R-GEN-014](editor.md#r-gen-014)), the number
of answers beside a block, "Add Note", and the buttons Comment and Reaction
([R-EDIT-007](editor.md#r-edit-007)). It adds its formatter to the source
and the removal of the notes from the output to the renderer. Notes
integrates the AI chat as notes ([R-AI-001](ai.md#r-ai-001)).

## 4. Markdown Paper

### R-PAPER-001

**The plugins of Paper.** Paper adds the schema of the front matter of the
layout, and `layout` and `repos` read-only with Ctrl+click to the clone
([R-FM-006](editor.md#r-fm-006)). It adds citations: `/cite` with Zotero,
`/research`, the hidden comment of the sources, and the hidden codes of the
special sections. It adds the generated lists, the layouts, the pages and
the PDF through the layout ([R-LAYOUT-001](rendering.md#r-layout-001)), and
the prompt protocol through the history
([R-HIST-005](history.md#r-hist-005)).

## 5. Open questions

1. Split of functions: standard footnotes in the libraries (proposal: yes);
   captions with numbers, `/ref` and listings stay in Notes in version 1
   (proposal: yes); the values of the front matter in the text in the
   libraries (proposal: yes); the form of the front matter replaces the view
   "Front Matter" of Paper (proposal: yes).
2. Level "render": does the source of a block of the level "render" open
   below its rendering (proposal) or in its place ([R-GEN-012](#r-gen-012))?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
