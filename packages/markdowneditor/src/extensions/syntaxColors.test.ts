// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the syntax colors of code blocks (docs/editor.md, R-EDIT-003): the tokens of a code block with a
// language that highlight.js knows get the classes hljs-*, also for an alias of the language; a code block without a
// language or with an unknown language has no colors; the colors follow an edit; and the text of the file stays the
// same.

import { TextSource } from '@nimblescape/markdowntext';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor } from '../editor';

const editors: MarkdownEditor[] = [];
afterEach(() => {
  editors.forEach((editor) => editor.destroy());
  editors.length = 0;
});

/** open returns a new editor of a text, in an element of the page. */
function open(text: string): { editor: MarkdownEditor; source: TextSource; element: HTMLElement } {
  const element = document.createElement('div');
  document.body.append(element);
  const source = new TextSource(text);
  const editor = new MarkdownEditor(element, { source, id: 'rendered' });
  editors.push(editor);
  return { editor, source, element };
}

/** colored returns the texts of the tokens with the class hljs-* in the code blocks of an element, with their classes. */
function colored(element: HTMLElement): string[] {
  return [...element.querySelectorAll('pre [class*="hljs-"]')].map((token) => `${token.className}:${token.textContent}`);
}

describe('the syntax colors of code blocks', () => {
  it('colors the tokens of a code block with a language', () => {
    const text = '```typescript\nconst answer: number = 42; // the answer\n```\n';
    const { source, element } = open(text);
    const tokens = colored(element);
    expect(tokens).toContain('hljs-keyword:const');
    expect(tokens).toContain('hljs-built_in:number');
    expect(tokens).toContain('hljs-number:42');
    expect(tokens).toContain('hljs-comment:// the answer');
    expect(source.text).toBe(text);
  });

  it('knows the aliases of a language', () => {
    const { element } = open('```ts\nlet a = "text";\n```\n');
    expect(colored(element)).toEqual(expect.arrayContaining(['hljs-keyword:let', 'hljs-string:"text"']));
  });

  it('colors HTML and CSS', () => {
    const { element } = open('```html\n<p class="note">Hi</p>\n```\n\n```css\np { color: red; }\n```\n');
    const tokens = colored(element);
    expect(tokens).toContain('hljs-tag hljs-name:p');
    expect(tokens).toContain('hljs-tag hljs-attr:class');
    expect(tokens).toContain('hljs-selector-tag:p');
  });

  it('gives no colors without a language or with an unknown language', () => {
    const { element } = open('```\nconst answer = 42;\n```\n\n```unknown-language\nconst answer = 42;\n```\n\n    const answer = 42;\n');
    expect(element.querySelectorAll('pre').length).toBe(3);
    expect(colored(element)).toEqual([]);
  });

  it('colors the text after an edit', () => {
    const { editor, source, element } = open('```js\nx\n```\n');
    let end = -1;
    editor.tiptap.state.doc.descendants((node, position) => {
      if (node.type.name === 'codeBlock') {
        end = position + node.nodeSize - 1;
      }
    });
    editor.tiptap.chain().insertContentAt(end, ' = function () {}').run();
    expect(colored(element)).toContain('hljs-keyword:function');
    expect(source.text).toBe('```js\nx = function () {}\n```\n');
  });
});
