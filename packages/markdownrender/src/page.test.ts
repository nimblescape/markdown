// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the renderer in a page (docs/rendering.md, R-REN-002): the functions of the plugins show their tokens
// in the placeholders of the HTML, a token whose function fails shows its text, and the page gets the styles of the
// plugins once.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RenderPlugin } from './plugins';
import { MarkdownRenderer } from './renderer';

afterEach(() => {
  document.body.replaceChildren();
  document.head.querySelectorAll('style[data-nsmd-plugin]').forEach((style) => style.remove());
});

/** target returns a new element of the page. */
function target(): HTMLElement {
  const element = document.createElement('div');
  element.className = 'nsmd-document nsmd-content';
  document.body.append(element);
  return element;
}

describe('the renderer in a page', () => {
  it('shows each token that a plugin shows with the function of the plugin, and removes what the plugin added', () => {
    const removed = vi.fn();
    const plugin: RenderPlugin = {
      name: 'csv',
      apiVersion: 1,
      styles: '.csv { color: green; }',
      render: {
        'fence:csv': (source, element, token) => {
          expect(element.childNodes.length).toBe(0);
          element.textContent = `${token.info}: ${source.trim().split('\n').length} rows`;
          return removed;
        },
      },
    };
    const renderer = new MarkdownRenderer({ plugins: [plugin] });
    const element = target();
    const dispose = renderer.render('# Data\n\n```csv\na,b\n1,2\n```\n', element);
    expect(element.querySelector('h1')?.id).toBe('data');
    expect(element.querySelector('.nsmd-render')?.textContent).toBe('csv: 2 rows');
    expect(document.head.querySelectorAll('style[data-nsmd-plugin="csv"]').length).toBe(1);
    renderer.render('Text', target());
    expect(document.head.querySelectorAll('style[data-nsmd-plugin="csv"]').length).toBe(1);
    dispose();
    expect(removed).toHaveBeenCalledOnce();
  });

  it('shows the text of a token whose function fails', () => {
    const plugin: RenderPlugin = {
      name: 'broken',
      apiVersion: 1,
      render: {
        'fence:broken': () => {
          throw new Error('cannot draw');
        },
      },
    };
    const element = target();
    new MarkdownRenderer({ plugins: [plugin] }).render('```broken\nsome code\n```\n', element);
    const error = element.querySelector('.nsmd-render-error');
    expect(error?.textContent).toBe('some code\n');
    expect(error?.getAttribute('title')).toBe('Error: cannot draw');
  });

  it('fills the placeholders of HTML from toHtml in an element of the page', () => {
    const plugin: RenderPlugin = { name: 'upper', apiVersion: 1, render: { 'fence:upper': (source, element) => void (element.textContent = source.toUpperCase()) } };
    const renderer = new MarkdownRenderer({ plugins: [plugin] });
    const rendering = renderer.toHtml('```upper\nabc\n```\n');
    const element = target();
    element.innerHTML = rendering.html;
    expect(element.querySelector('.nsmd-render code')?.textContent).toBe('abc\n');
    renderer.fill(element, rendering);
    expect(element.querySelector('.nsmd-render')?.textContent).toBe('ABC\n');
  });
});
