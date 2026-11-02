<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the source

This document defines the source: the part that holds the text of a file,
the selections in it and the changes to it
([section 3](specification.md#3-architecture) of the specification). The
text of the file is the only truth
([R-ARCH-001](specification.md#r-arch-001)). It is part of the
[specification](specification.md) of nimblescape Markdown and normative in
the same way.

## 1. Text and changes

### R-SRC-001

**Text, selections and changes.** The source must hold the text of a file
and the selections of every editor of the file. It must apply each change as
a text patch with its origin: user, AI or other program. It must read and
save the file through the platform adapter.

### R-SRC-002

**Changes from outside.** A change from outside, for example by Git, a
formatter, an AI agent or another program, must reach every open editor as a
change of the text. An editor must then replace only the parts whose text
changed, and keep the cursor.

## 2. File formats

### R-SRC-003

**Front matter.** The source must recognize a front matter at the start of a
file in YAML (between two lines `---`), in TOML (between two lines `+++`)
and in JSON (an object at the start of the file). A plugin may add a further
format.

*(proposal)* The source must read the data of the front matter, change one
value at a time so that the comments, the order and the quotes of the other
keys stay ([R-FM-005](editor.md#r-fm-005)), and check the data against a
JSON schema ([R-FM-004](editor.md#r-fm-004)), without a view. The form of
the front matter in the editor, the renderer, the layout and the command
line use this code of the package `@nimblescape/markdowntext`.

### R-GEN-006

**The file formats.** The source must keep every part of a file that no
plugin knows, so that a file stays intact. Notes and Paper extend the file
format with their parts through plugins
([plugins and format extensions](plugins.md)). Plugins of the source are,
for example, the formatter of Notes, the check of the front matter against
its schema, and the detection of the format of a file (the comment of the
format of Notes, the layout of Paper).

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
