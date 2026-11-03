// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The plugin of the example pages (docs/plugins.md, R-PLUGIN-001), which shows the parts of the plugin API:
//
// - Level "render" (R-GEN-012): a fenced code block with the language `csv` shows as a table. A double click or the
//   button "Edit source" shows its text in the place of the table, and "Show rendering" shows the table again.
// - Generated parts (docs/editor.md, R-EDIT-011): a link whose address starts with `#ref-` stands for a citation that a
//   plugin writes. It is read-only: the cursor jumps over it, and Backspace deletes it as a whole.
// - Threads beside the text (R-GEN-014): each paragraph with the word TODO has a thread; its icon opens the panel.
// - An item of the insert menu and of the slash commands: "CSV table".

import type { MarkdownPlugin } from '@nimblescape/markdowneditor';

/** csvTable shows the lines of a CSV text as a table, with the first line as the header row. */
function csvTable(source: string, target: HTMLElement): void {
  // The element can be in another document than the script, for example in the frame of the pages.
  const document = target.ownerDocument;
  const rows = source
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.split(',').map((cell) => cell.trim()));
  const table = document.createElement('table');
  rows.forEach((cells, index) => {
    const row = table.insertRow();
    for (const cell of cells) {
      const element = document.createElement(index === 0 ? 'th' : 'td');
      element.textContent = cell;
      row.append(element);
    }
  });
  target.replaceChildren(table);
}

/** examplePlugin returns the plugin of the example pages. */
export function examplePlugin(): MarkdownPlugin {
  return {
    name: 'example',
    apiVersion: 1,
    styles: '.nsmd-editor .example-thread { margin: 0; }',
    render: { 'fence:csv': csvTable },
    generated: (doc) => {
      const parts: { from: number; to: number; open: () => void }[] = [];
      doc.descendants((node, pos) => {
        const link = node.isText ? node.marks.find((mark) => mark.type.name === 'link' && String(mark.attrs.href).startsWith('#ref-')) : undefined;
        if (!link) {
          return;
        }
        const last = parts[parts.length - 1];
        if (last && last.to === pos) {
          last.to = pos + node.nodeSize;
        } else {
          parts.push({ from: pos, to: pos + node.nodeSize, open: () => window.alert(`The target of the citation: ${String(link.attrs.href)}`) });
        }
      });
      return parts;
    },
    threads: {
      find: (doc) => {
        const threads: { id: string; from: number; to: number; count: number }[] = [];
        doc.descendants((node, pos) => {
          if (node.type.name === 'paragraph' && node.textContent.includes('TODO')) {
            threads.push({ id: `todo-${pos}`, from: pos + 1, to: pos + node.nodeSize - 1, count: 1 });
          }
          return !node.isTextblock;
        });
        return threads;
      },
      open: (thread, panel) => {
        const text = document.createElement('p');
        text.className = 'example-thread';
        text.textContent = `The thread ${thread.id} of the example plugin: this passage has the word TODO.`;
        panel.replaceChildren(text);
      },
    },
    menus: {
      insert: (editor) => [
        {
          id: 'csvTable',
          label: 'CSV table',
          keywords: ['csv', 'example'],
          run: () => editor.chain().focus().insertContent({ type: 'codeBlock', attrs: { language: 'csv', info: 'csv' }, content: [{ type: 'text', text: 'a,b\n1,2' }] }).run(),
        },
      ],
    },
  };
}
