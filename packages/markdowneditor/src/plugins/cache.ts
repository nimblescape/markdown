// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// A value of each document of the editor, for example the generated parts of the plugins (docs/editor.md, R-EDIT-011)
// and their threads (R-GEN-014): the editor asks the plugins once for each document, and again after `refresh`, when the
// data of a plugin changed without a change of the document.

import type { Node } from '@tiptap/pm/model';

/** DocCache holds a value for each document. */
export class DocCache<T> {
  private version = 0;
  private readonly entries = new WeakMap<Node, { version: number; value: T }>();

  /** @param compute - Returns the value of a document. */
  constructor(private readonly compute: (doc: Node) => T) {}

  /** get returns the value of a document. */
  get(doc: Node): T {
    const entry = this.entries.get(doc);
    if (entry?.version === this.version) {
      return entry.value;
    }
    const value = this.compute(doc);
    this.entries.set(doc, { version: this.version, value });
    return value;
  }

  /** refresh forgets the values, so that the next `get` asks again. */
  refresh(): void {
    this.version++;
  }
}
