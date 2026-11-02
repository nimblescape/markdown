// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The test of the editor in a page whose policy allows only style elements with a nonce (docs/platforms.md,
// R-PLAT-001): the style elements that the editor adds, the base styles of Tiptap and the styles of the plugins, carry
// the nonce. The test has a file of its own, because the first editor of a page adds the base styles of Tiptap.

import { expect, it } from 'vitest';
import { MarkdownEditor } from './editor';

it('gives the style elements of Tiptap and of the plugins the nonce of the page', () => {
  const editor = new MarkdownEditor(document.createElement('div'), {
    markdown: 'Text\n',
    styleNonce: 'abc',
    plugins: [{ name: 'styled', apiVersion: 1, styles: '.styled { color: red; }' }],
  });
  expect(document.head.querySelector('style[data-tiptap-style]')?.getAttribute('nonce')).toBe('abc');
  expect(document.head.querySelector('style[data-nsmd-plugin="styled"]')?.getAttribute('nonce')).toBe('abc');
  editor.destroy();
});
