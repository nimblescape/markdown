<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the renderer

This document defines the renderer: the part that turns the text into
content without edit functions ([section 3](specification.md#3-architecture)
of the specification). It is part of the [specification](specification.md)
of nimblescape Markdown and normative in the same way.

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

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
