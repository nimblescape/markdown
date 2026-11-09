// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the places in the text of the pages where a line must not break (docs/rendering.md, R-LAYOUT-001): a
// reference to a place in a source, such as "S. 18 – 19", and a range of numbers with a dash stay on one line.

import { describe, expect, test } from 'vitest';
import { keepReferences, nowrapClass } from './nowrap';
import { baseCss } from './page';
import { createLayoutRenderer, renderText } from './text';
import { termsFor } from './format';

/** kept returns a text in the element of keepReferences. */
const kept = (text: string): string => `<span class="${nowrapClass}">${text}</span>`;

describe('a reference to a place in a source stays on one line', () => {
  test('a page and a range of pages with ordinary spaces, as an author types them', () => {
    expect(keepReferences('<p>Das Nutzen behandeln sie gesondert (S. 18 \u2013 19). Bestandteile (S. 2).</p>')).toBe(
      `<p>Das Nutzen behandeln sie gesondert (${kept('S. 18 \u2013 19')}). Bestandteile (${kept('S. 2')}).</p>`,
    );
  });

  test('a citation with no-break spaces, whose dash would allow a break after it', () => {
    const html = '<p><a href="#becker2020" title="narrative page 373-374">M. Becker (2020, S.\u00a0373\u00a0\u2013\u00a0374)</a>. Je nach</p>';
    expect(keepReferences(html)).toBe(`<p><a href="#becker2020" title="narrative page 373-374">M. Becker (2020, ${kept('S.\u00a0373\u00a0\u2013\u00a0374')})</a>. Je nach</p>`);
  });

  test('the other places of a source in German and in English, and a range of numbers without a place', () => {
    expect(keepReferences('<p>Kap. 2, Abschn. 4.1, § 8 lit. r, pp. 3\u20136, p. 12a, Vol. 3 and 2015 \u2013 2023.</p>')).toBe(
      `<p>${kept('Kap. 2')}, ${kept('Abschn. 4.1')}, ${kept('§ 8')} lit. r, ${kept('pp. 3\u20136')}, ${kept('p. 12a')}, ${kept('Vol. 3')} and ${kept('2015 \u2013 2023')}.</p>`,
    );
  });

  test('numbers without a place or a dash, words that end like a place, and a hyphen between numbers stay as they are', () => {
    const html = '<p>Im Jahr 2025 nutzten 30 % der Unternehmen, 1.993 Befragte, Haus. 3 Fragen, ISBN 978-3-658-46847-7, am 8. November.</p>';
    expect(keepReferences(html)).toBe(html);
  });

  test('the text of code, of attributes, of comments and of the tokens of plugins stays as it is', () => {
    const html =
      '<p title="S. 3 \u2013 4"><!-- S. 1 --><code>S. 3 \u2013 4</code></p><pre><code>p. 3</code></pre><div class="mermaid">S. 5</div><div class="nsmd-render" data-nsmd-render="0">S. 6</div>';
    expect(keepReferences(html)).toBe(html);
  });

  test('the base style sheet keeps the text of the element on one line, and the text of a document gets it', () => {
    expect(baseCss).toContain(`.${nowrapClass} {\n  white-space: nowrap;\n}`);
    const layout = {
      id: 'test',
      folder: 'file:///layouts/test/',
      name: 'Test',
      language: 'de-AT',
      stylesheets: [],
      before: [],
      after: [],
      fields: {},
      numbered: false,
      depth: 3,
      unnumbered: [],
      numberedSections: [],
      contentsDepth: 3,
      contentsFront: true,
      hyphenate: false,
      references: { hyphenate: false },
      listings: { lineNumbers: false },
      pdfName: '{{file}}',
      terms: termsFor('de-AT'),
    };
    expect(renderText(createLayoutRenderer(), 'Anforderungen (S. 371 \u2013 373).\n', layout).html).toContain(`Anforderungen (${kept('S. 371 \u2013 373')}).`);
  });
});
