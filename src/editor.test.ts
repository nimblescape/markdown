// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the editor in a page: it shows the text, writes back the blocks that the user did not change as the
// file has them, and switches to read-only mode.

import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor } from './editor';

const text = '---\ntitle: A\n---\n\n# Title\n\nFirst   paragraph,\nwith two lines.\n\n* item\n* item\n\n| a | b |\n|--|--|\n| 1 | 2 |\n';

let editor: MarkdownEditor | undefined;
afterEach(() => editor?.destroy());

describe('MarkdownEditor', () => {
  it('writes back the text that the user did not change', () => {
    editor = new MarkdownEditor(document.createElement('div'), { markdown: text });
    expect(editor.getMarkdown()).toBe(text);
  });

  it('renders the blocks of the text', () => {
    const element = document.createElement('div');
    editor = new MarkdownEditor(element, { markdown: text });
    expect(element.querySelector('h1')?.textContent).toBe('Title');
    expect(element.querySelectorAll('ul li')).toHaveLength(2);
    expect(element.querySelector('table td')?.textContent).toBe('1');
    expect(element.querySelector('pre.nsmd-raw-front-matter')?.textContent).toBe('---\ntitle: A\n---');
  });

  it('writes only the changed block new', () => {
    let changes = 0;
    editor = new MarkdownEditor(document.createElement('div'), { markdown: text, onChange: () => changes++ });
    // The front matter is an atom of size 1, so the text of the heading after it starts at the position 2.
    editor.tiptap.chain().setTextSelection(2).insertContent('New ').run();
    expect(editor.getMarkdown()).toBe(text.replace('# Title', '# New Title'));
    expect(changes).toBe(1);
  });

  it('switches to read-only mode', () => {
    editor = new MarkdownEditor(document.createElement('div'), { markdown: text, editable: false });
    expect(editor.isEditable).toBe(false);
    editor.setEditable(true);
    expect(editor.isEditable).toBe(true);
  });
});
