// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the text of the pages (docs/rendering.md, R-LAYOUT-001, R-LAYOUT-004): the footnotes, the numbers of
// the headings, the special sections and the parts, the generated lists, the captions of figures, tables and listings,
// the links to them, and the rule in a renderer with other plugins. The tests come from the tests of the layout code of
// nimblescape Markdown Paper, without the notes of Markdown Notes and the links of listings, which are plugins.

import { describe, expect, test } from 'vitest';
import type { RenderPlugin } from '@nimblescape/markdownrender';
import { type Layout, termsFor } from './format';
import { hyphenatorOf, softHyphen } from './hyphenate';
import { createLayoutRenderer, emptyFound, layoutEnvKey, type LayoutText, renderText } from './text';
import { layoutHtml } from './tokens';

/**
 * layoutOf returns a layout for the tests.
 * @param changes - The fields that differ from the defaults.
 */
const layoutOf = (changes: Partial<Layout> = {}): Layout => ({
  id: 'test',
  folder: 'file:///layouts/test/',
  name: 'Test',
  language: 'de-AT',
  stylesheets: [],
  before: [],
  after: [],
  fields: {},
  numbered: true,
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
  ...changes,
});

/**
 * renderBody returns the text of a document in a layout.
 * @param markdown - The text.
 * @param layout - The layout.
 * @param hyphenate - The hyphenation, if any.
 * @param plugins - The plugins of the renderer.
 */
const renderBody = (markdown: string, layout: Layout, hyphenate?: (text: string) => string, plugins: RenderPlugin[] = []): LayoutText =>
  renderText(createLayoutRenderer({ plugins }), markdown, layout, hyphenate);

describe('footnotes', () => {
  test('a footnote goes to the place of its reference, and the end of the text has no list of footnotes', () => {
    const body = renderBody('# Teil\n\nThree ways.[^ways]\n\n[^ways]: Planning, writing and checking.\n\nThe next paragraph.\n', layoutOf());
    expect(body.footnotes).toBe(1);
    expect(body.html).toContain('Three ways.<span class="footnote"><span class="footnote-paragraph" id="paper-footnote-1">Planning, writing and checking.</span></span>');
    expect(body.html).not.toContain('footnotes-sep');
    expect(body.html).toContain('<p data-line="6">The next paragraph.</p>');
  });

  test('a second reference of a footnote shows its number as a link to the footnote', () => {
    const body = renderBody('A[^a] B[^b] C[^a]\n\n[^a]: One.\n\n[^b]: Two.\n', layoutOf());
    expect(body.footnotes).toBe(2);
    expect(body.html).toContain('A<span class="footnote"><span class="footnote-paragraph" id="paper-footnote-1">One.</span></span>');
    expect(body.html).toContain('<sup class="footnote-again"><a href="#paper-footnote-1">1</a></sup>');
  });

  test('a link to the outside with its own text gets a footnote with its address, numbered with the footnotes', () => {
    const body = renderBody(
      'See [the site](https://example.org/a?b=1&c=2)[^a], [again](https://example.org/a?b=1&c=2), [example.org](https://example.org), https://example.com, <https://example.net> and [mail](mailto:a@example.org).\n\n[^a]: From [the list](https://example.org/l) of [x.org](https://x.org/).\n',
      layoutOf(),
    );
    expect(body.footnotes).toBe(3);
    expect(body.html).toContain(
      '<a href="https://example.org/a?b=1&amp;c=2">the site</a><span class="footnote link-footnote"><span class="footnote-paragraph" id="paper-footnote-1"><a class="link-address" href="https://example.org/a?b=1&amp;c=2">https://example.org/a?b=1&amp;c=2</a></span></span>',
    );
    // The footnote of the document after the link is the second footnote; its link gets the address after its text.
    expect(body.html).toContain('<span class="footnote"><span class="footnote-paragraph" id="paper-footnote-2">From <a href="https://example.org/l">the list</a> (<span class="link-address">https://example.org/l</span>) of <a href="https://x.org/">x.org</a>.</span></span>');
    expect(body.html).toContain('<a href="https://example.org/a?b=1&amp;c=2">again</a><sup class="footnote-again"><a href="#paper-footnote-1">1</a></sup>');
    // A link that shows its address, a bare address and an autolink get no footnote.
    expect(body.html).toContain('<a href="https://example.org">example.org</a>, <a href="https://example.com">https://example.com</a>, <a href="https://example.net">https://example.net</a>');
    expect(body.html).toContain('<a href="mailto:a@example.org">mail</a><span class="footnote link-footnote"><span class="footnote-paragraph" id="paper-footnote-3"><a class="link-address" href="mailto:a@example.org">a@example.org</a></span></span>.');
  });

  test('a link inside the document gets no footnote', () => {
    const body = renderBody('# Methods\n\nSee [Kapitel 1](#methods) and [Hong (2024)](#hong2024).\n', layoutOf());
    expect(body.footnotes).toBe(0);
    expect(body.html).not.toContain('footnote');
  });

  test('the raw HTML of a footnote is as safe as the raw HTML of the text', () => {
    const body = renderBody('A[^a]\n\n[^a]: <img src=x onerror="alert(1)"> and <b>bold</b>.\n', layoutOf());
    expect(body.html).not.toContain('<img');
    expect(body.html).toContain('<span class="nsmd-raw nsmd-raw-html">&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</span> and <b>bold</b>.');
  });
});

describe('headings', () => {
  test('the headings get numbers to the depth of the layout, and IDs from their text', () => {
    const html = renderBody('# Einleitung\n\n## Frage\n\n### Methode\n\n#### Detail\n\n# Ergebnis\n', layoutOf()).html;
    expect(html).toContain('<h1 id="einleitung" data-line="0"><span class="heading-number">1</span> Einleitung</h1>');
    expect(html).toContain('<span class="heading-number">1.1</span> Frage');
    expect(html).toContain('<span class="heading-number">1.1.1</span> Methode');
    expect(html).toContain('<h4 id="detail" class="unnumbered" data-line="6">Detail</h4>');
    expect(html).toContain('<span class="heading-number">2</span> Ergebnis');
  });

  test('a heading with {-} and the headings below it get no number, and the marker does not show', () => {
    const html = renderBody('# Begriffe {-}\n\n## Glossar\n\n# Einleitung\n', layoutOf()).html;
    expect(html).toContain('<h1 id="begriffe--" class="unnumbered" data-line="0">Begriffe</h1>');
    expect(html).toContain('<h2 id="glossar" class="unnumbered" data-line="2">Glossar</h2>');
    expect(html).toContain('<span class="heading-number">1</span> Einleitung');
  });

  test('a document numbered by hand keeps its numbers, and a layout without numbers gets none', () => {
    expect(renderBody('# 1 Einleitung\n\n# 2 Ergebnis\n', layoutOf()).html).not.toContain('heading-number');
    expect(renderBody('# Einleitung\n', layoutOf({ numbered: false })).html).not.toContain('heading-number');
  });

  test('a pattern of the layout keeps a heading without a number', () => {
    expect(renderBody('# Glossar\n\n# Einleitung\n', layoutOf({ unnumbered: ['^glossar$'] })).html).toContain('<h1 id="glossar" class="unnumbered" data-line="0">Glossar</h1>');
  });

  test('a heading has the ID that GitHub gives it, so that a Markdown link to it works on GitHub and on the pages', () => {
    const body = renderBody('# Teil\n\n# Teil\n\n## Einführung: Ziele & `Code`\n\n# Quellen {BIB}\n', layoutOf());
    expect(body.headings.map((heading) => heading.id)).toEqual(['teil', 'teil-1', 'einführung-ziele--code', 'quellen-bib']);
    expect(body.html).toContain('<h1 id="quellen-bib" class="section-bib unnumbered" data-section="BIB" data-line="6">Quellen</h1>');
  });
});

describe('special sections', () => {
  test('the special sections of the language get no number and their code, also by a marker of their code', () => {
    const markdown = ['# Eidesstattliche Erklärung', '# Abstract', '# Danksagung', '# Vorwort', '# Inhaltsverzeichnis', '# Einleitung', '# Quellen und Materialien {BIB}', '# Anhang', '## Leitfaden', ''].join('\n\n');
    const body = renderBody(markdown, layoutOf());
    expect(body.headings.map((heading) => [heading.text, heading.number, heading.section])).toEqual([
      ['Eidesstattliche Erklärung', '', 'ADT'],
      ['Abstract', '', 'AST'],
      ['Danksagung', '', 'ACC'],
      ['Vorwort', '', 'FWD'],
      ['Inhaltsverzeichnis', '', 'TOC'],
      ['Einleitung', '1', undefined],
      ['Quellen und Materialien', '', 'BIB'],
      ['Anhang', '', 'APX'],
      ['Leitfaden', 'Anhang', 'APX-A'],
    ]);
    expect(body.html).toContain('class="section-bib unnumbered" data-section="BIB" data-line="12">Quellen und Materialien</h1>');
  });

  test('a special section of headings.numberedSections gets a number as other chapters do', () => {
    const body = renderBody('# Einleitung\n\n# Quellen\n\n## Gesetze\n\n# Literatur {BIB}\n', layoutOf({ numberedSections: ['BIB'] }));
    expect(body.headings.map((heading) => [heading.text, heading.number, heading.section])).toEqual([
      ['Einleitung', '1', undefined],
      ['Quellen', '2', 'BIB'],
      ['Gesetze', '2.1', undefined],
      ['Literatur', '3', 'BIB'],
    ]);
    expect(body.html).toContain('<h1 id="quellen" class="section-bib" data-section="BIB" data-line="2"><span class="heading-number">2</span> Quellen</h1>');
  });

  test('the front matter, the body and the appendix part are each in an element, and a special section of the front part gets no number', () => {
    const markdown = ['# Abstract', 'A.', '# Inhaltsverzeichnis', '# Abbildungsverzeichnis', '# Einleitung', 'B.', '# Abbildungsverzeichnis {LOF}', '# Literaturverzeichnis', 'C.', '# Anhang', '## Leitfaden', 'D.', ''].join('\n\n');
    const body = renderBody(markdown, layoutOf({ numberedSections: ['LOF', 'BIB'] }));
    expect(body.headings.map((heading) => [heading.text, heading.number, heading.section])).toEqual([
      ['Abstract', '', 'AST'],
      ['Inhaltsverzeichnis', '', 'TOC'],
      ['Abbildungsverzeichnis', '', 'LOF'],
      ['Einleitung', '1', undefined],
      ['Abbildungsverzeichnis', '2', 'LOF'],
      ['Literaturverzeichnis', '3', 'BIB'],
      ['Anhang', '', 'APX'],
      ['Leitfaden', 'Anhang', 'APX-A'],
    ]);
    expect(body.html.startsWith('<div class="paper-part paper-front">\n<h1 ')).toBe(true);
    expect(body.html).toMatch(/<\/nav>\n<\/div>\n<div class="paper-part paper-body">\n<h1 id="einleitung" data-line="\d+">/);
    expect(body.html).toMatch(/<\/section>\n<\/div>\n<div class="paper-part paper-appendix">\n<h1 id="anhang"/);
    expect(body.html.endsWith('<p data-line="22">D.</p>\n</div>\n')).toBe(true);
    expect(body.html.match(/<div class="paper-part/g)).toHaveLength(3);
    expect(body.html.match(/<\/div>/g)).toHaveLength(3);
  });

  test('a document of chapters alone has the body part, and the text before its first chapter is in no part', () => {
    const html = renderBody('Vorab.\n\n# Einleitung\n\nText.\n', layoutOf()).html;
    expect(html.trim()).toBe('<p data-line="0">Vorab.</p>\n<div class="paper-part paper-body">\n<h1 id="einleitung" data-line="2"><span class="heading-number">1</span> Einleitung</h1>\n<p data-line="4">Text.</p>\n</div>');
  });

  test('English words count in an English layout', () => {
    const body = renderBody('# Table of Contents\n\n# Introduction\n\n# References\n', layoutOf({ language: 'en-US', terms: termsFor('en-US') }));
    expect(body.headings.map((heading) => heading.section)).toEqual(['TOC', undefined, 'BIB']);
  });

  test('the table of contents lists every heading but its own, with the numbers and the links to the pages', () => {
    const html = renderBody('# Abstract\n\n# Inhaltsverzeichnis\n\nOld text.\n\n# Einleitung\n\n## Frage\n', layoutOf()).html;
    expect(html).not.toContain('Old text');
    expect(html).toContain('<nav class="contents no-hyphens"><ol>');
    expect(html).toContain('<li class="contents-level-1 unnumbered contents-front"><a href="#abstract"><span class="contents-text">Abstract</span></a></li>');
    expect(html).not.toContain('href="#inhaltsverzeichnis"');
    expect(html).toContain('<li class="contents-level-2"><a href="#frage"><span class="contents-number">1.1</span><span class="contents-text">Frage</span></a></li>');
  });

  test('the reference list gets no soft hyphens', () => {
    const hyphenate = hyphenatorOf('de-AT');
    const html = renderBody('# Einleitung\n\nWirtschaftspädagogik\n\n# Literaturverzeichnis\n\nWirtschaftspädagogik\n', layoutOf({ hyphenate: true }), hyphenate).html;
    const [text, references] = html.split('<section class="references no-hyphens">');
    expect(text).toContain(softHyphen);
    expect(references).not.toContain(softHyphen);
  });

  test('the reference list gets soft hyphens with references.hyphenate, but not its web addresses', () => {
    const hyphenate = hyphenatorOf('de-AT');
    const markdown = '# Literaturverzeichnis\n\nWirtschaftspädagogik. [https://example.org/wirtschaftspaedagogik](https://example.org/wirtschaftspaedagogik)\n';
    const html = renderBody(markdown, layoutOf({ hyphenate: true, references: { hyphenate: true } }), hyphenate).html;
    expect(html).toContain('<section class="references">');
    expect(html).toContain(`Wirt${softHyphen}schafts${softHyphen}päd${softHyphen}ago${softHyphen}gik.`);
    expect(html).toContain('>https://example.org/wirtschaftspaedagogik</a>');
  });
});

describe('lists of the special sections', () => {
  test('a special section shows the list of the file between its markers, with the elements of the list of the layout', () => {
    const markdown = [
      '# Inhaltsverzeichnis',
      '',
      '<!-- toc -->',
      '- [1 Einleitung](#einleitung)',
      '- [1.1 Methoden](#methoden)',
      '- [Literaturverzeichnis](#literaturverzeichnis)',
      '- [Anhang A: Daten](#daten)',
      '- [2 Weg](#weg)',
      '<!-- /toc -->',
      '',
      '# Verzeichnis der Listings',
      '',
      '<!-- lol -->',
      '- [Listing 1: Lesen](#lst-lesen)',
      '<!-- /lol -->',
      '',
      '# Abbildungsverzeichnis',
      '',
      'Kein Eintrag.',
      '',
      '# Einleitung',
      '',
      '## Methoden',
      '',
      'Listing 1: Lesen <a id="lst-lesen"></a>',
      '',
      '```ts',
      'a();',
      '```',
      '',
      'Figure 1: Bild',
      '',
      '![Bild](b.png)',
      '',
      '# Literaturverzeichnis',
      '',
      '# Anhang',
      '',
      '## Daten',
      '',
      '## Mehr',
      '',
    ].join('\n');
    const body = renderBody(markdown, layoutOf());
    expect(body.html).toContain(
      '<nav class="contents no-hyphens"><ol>\n' +
        '<li class="contents-level-1"><a href="#einleitung"><span class="contents-number">1</span><span class="contents-text">Einleitung</span></a></li>\n' +
        '<li class="contents-level-2"><a href="#methoden"><span class="contents-number">1.1</span><span class="contents-text">Methoden</span></a></li>\n' +
        '<li class="contents-level-1 unnumbered"><a href="#literaturverzeichnis"><span class="contents-text">Literaturverzeichnis</span></a></li>\n' +
        '<li class="contents-level-2 appendix contents-appendix"><a href="#daten"><span class="contents-text"><span class="appendix-label">Anhang A</span><span class="appendix-separator">: </span>Daten</span></a></li>\n' +
        '<li class="contents-level-1"><a href="#weg"><span class="contents-number">2</span><span class="contents-text">Weg</span></a></li>\n</ol></nav>',
    );
    expect(body.html).toContain(
      '<nav class="list-of-listings no-hyphens"><ol>\n<li><a href="#lst-lesen"><span class="caption-entry"><span class="caption-label">Listing 1</span>' +
        '<span class="caption-separator">: </span><span class="caption-text">Lesen</span></span></a></li>\n</ol></nav>',
    );
    // A section without the markers gets the list of the layout, and the rest of a section does not show.
    expect(body.html).toContain('<nav class="list-of-figures no-hyphens"><ol>\n<li><a href="#figure-1">');
    expect(body.html).not.toContain('Kein Eintrag');
    expect(body.html).not.toContain('<!--');
    expect(body.problems).toEqual([{ severity: 'warning', message: 'The entry #weg of the TOC names no heading, figure, table or listing of the file.', line: 7 }]);
  });

  test('finds the heading of an entry whose target has letters outside ASCII', () => {
    const markdown = ['# Inhaltsverzeichnis', '', '<!-- toc -->', '- [Eidesstattliche Erklärung](#eidesstattliche-erklärung)', '<!-- /toc -->', '', '# Eidesstattliche Erklärung', ''].join('\n');
    const body = renderBody(markdown, layoutOf());
    expect(body.problems).toEqual([]);
    // The page of the entry needs the ID without escapes in the link.
    expect(body.html).toContain('<a href="#eidesstattliche-erklärung">');
  });
});

describe('figures and tables', () => {
  test('a paragraph "Figure 1:" directly before an image alone in its paragraph is the caption of the figure, above the image, listed in the list of figures', () => {
    const markdown = '# Abbildungsverzeichnis\n\n# Teil\n\nFigure 1: Die Rollen\n\n![Rollen im Team](rollen.png)\n\nText ![Icon](icon.png) im Satz.\n\n![Das Logo](logo.png)\n';
    const body = renderBody(markdown, layoutOf());
    expect(body.figures).toEqual([{ id: 'figure-1', label: 'Abbildung 1', text: 'Die Rollen', line: 4 }]);
    expect(body.html).toContain(
      '<figure class="figure" id="figure-1" data-line="4"><figcaption><span class="caption-label">Abbildung 1</span><span class="caption-separator">: </span>' +
        '<span class="caption-text">Die Rollen</span></figcaption><img src="rollen.png" alt="Rollen im Team"></figure>\n<p data-line="8">',
    );
    expect(body.html).toContain('<p data-line="8">Text <img src="icon.png" alt="Icon"> im Satz.</p>');
    // An image without a caption line is a figure without a caption and without a number.
    expect(body.html).toContain('<figure class="figure" data-line="10"><img src="logo.png" alt="Das Logo"></figure>');
    expect(body.html).toContain('<nav class="list-of-figures no-hyphens"><ol>\n<li><a href="#figure-1"><span class="caption-entry"><span class="caption-label">Abbildung 1</span>');
  });

  test('a paragraph "Table 1:" directly before a table is its caption with the number of the file, listed in the list of tables', () => {
    const markdown = '# Tabellenverzeichnis\n\n# Teil\n\nTable: Teilnehmende\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nTabelle 7: Zweite\n\n| c |\n| - |\n| 3 |\n\nTable: no table follows\n';
    const body = renderBody(markdown, layoutOf());
    // The number of the file stays; a caption without a number gets the next number.
    expect(body.tables.map((table) => [table.label, table.text])).toEqual([
      ['Tabelle 1', 'Teilnehmende'],
      ['Tabelle 7', 'Zweite'],
    ]);
    expect(body.html).toContain('<p id="table-1" class="caption table-caption" data-line="4"><span class="caption-label">Tabelle 1</span><span class="caption-separator">: </span><span class="caption-text">Teilnehmende</span></p>');
    expect(body.html).toContain('<p data-line="16">Table: no table follows</p>');
    expect(body.html).toContain('<nav class="list-of-tables no-hyphens">');
  });

  test('the caption of a table can stand before the comment of the widths of its columns', () => {
    const body = renderBody('Table: Breiten\n\n<!-- table: widths=30,70 -->\n| a | b |\n| - | - |\n| 1 | 2 |\n', layoutOf());
    expect(body.tables.map((table) => table.label)).toEqual(['Tabelle 1']);
    expect(body.html).toContain('<table class="nsmd-table-fixed" data-line="3">\n<colgroup><col style="width: 30%"><col style="width: 70%"></colgroup>');
  });

  test('the appendices are A, B, and their figures and tables are numbered A1, B1', () => {
    const markdown = '# Teil\n\nFigure: Eins\n\n![Eins](1.png)\n\n# Anhang\n\n## Leitfaden\n\nFigure: Zwei\n\n![Zwei](2.png)\n\n## Transkript\n\nTable: Kodes\n\n| a |\n| - |\n| 1 |\n';
    const body = renderBody(markdown, layoutOf());
    expect(body.figures.map((figure) => figure.label)).toEqual(['Abbildung 1', 'Abbildung A1']);
    expect(body.tables.map((table) => table.label)).toEqual(['Tabelle B1']);
    expect(body.headings.filter((heading) => heading.appendix).map((heading) => heading.number)).toEqual(['Anhang A', 'Anhang B']);
    expect(body.html).toContain('<h2 id="leitfaden" class="appendix" data-section="APX-A" data-line="8"><span class="appendix-label">Anhang A</span> Leitfaden</h2>');
  });

  test('the caption of a table gets no soft hyphens', () => {
    const body = renderBody('Table: Wirtschaftspädagogik\n\n| a |\n| - |\n| 1 |\n', layoutOf({ hyphenate: true }), hyphenatorOf('de-AT'));
    expect(body.html).toContain('<span class="caption-text">Wirtschaftspädagogik</span>');
  });
});

describe('alerts of GitHub in the pages', () => {
  test('a block quote with the mark of an alert in its first line becomes the element of the alert, as GitHub writes it', () => {
    const markdown = '# Teil\n\n> [!NOTE]\n> Bitte achten Sie auf den *Bezug* zur Schule.\n\n[Ihr Text]\n\n> [!warning]\n>\n> Erster Absatz.\n>\n> Zweiter Absatz.\n\n> Ein Zitat.\n';
    const html = renderBody(markdown, layoutOf()).html;
    expect(html).toContain(
      '<div class="markdown-alert markdown-alert-note" data-line="2">\n<p class="markdown-alert-title">Note</p>\n<p data-line="3">Bitte achten Sie auf den <em>Bezug</em> zur Schule.</p>\n</div>',
    );
    expect(html).toContain('<p data-line="5">[Ihr Text]</p>');
    expect(html).toContain('<div class="markdown-alert markdown-alert-warning" data-line="7">\n<p class="markdown-alert-title">Warning</p>\n<p data-line="9">Erster Absatz.</p>\n<p data-line="11">Zweiter Absatz.</p>\n</div>');
    expect(html).toContain('<blockquote data-line="13">\n<p data-line="13">Ein Zitat.</p>\n</blockquote>');
  });
});

describe('links to figures, tables and headings', () => {
  test('the anchor of a figure or a table names it, and a link to it gets its label', () => {
    const markdown = [
      'Siehe [Table 1](#tab-noten), [Figure 2](#fig-plan) und [den Plan](#fig-plan).',
      '',
      'Figure 1: Der Plan <a id="fig-plan"></a>',
      '',
      '![Plan der Studie](plan.png)',
      '',
      'Abbildung: Der Ablauf',
      '',
      '![Ablauf](ablauf.png) <a id="fig-ablauf"></a>',
      '',
      'Table: Noten <a id="tab-noten"></a>',
      '',
      '| a |',
      '| - |',
      '| 1 |',
      '',
      '# Anhang',
      '',
      '## Daten',
      '',
      'Table: Rohdaten',
      '<a id="tab-roh"></a>',
      '',
      '| b |',
      '| - |',
      '| 2 |',
      '',
      'Wie [Tabelle 9](#tab-roh) zeigt; [Table 3](#tab-fehlt); [Figure 5](#fig-ablauf).',
      '',
    ].join('\n');
    const body = renderBody(markdown, layoutOf());
    // The anchor of a figure stands at the end of its caption or of its image.
    expect(body.figures).toEqual([
      { id: 'fig-plan', label: 'Abbildung 1', text: 'Der Plan', line: 2 },
      { id: 'fig-ablauf', label: 'Abbildung 2', text: 'Der Ablauf', line: 6 },
    ]);
    expect(body.tables.map((table) => [table.id, table.label, table.text])).toEqual([
      ['tab-noten', 'Tabelle 1', 'Noten'],
      ['tab-roh', 'Tabelle A1', 'Rohdaten'],
    ]);
    expect(body.html).toContain('<a href="#tab-noten">Tabelle 1</a>, <a href="#fig-plan">Abbildung 1</a> und <a href="#fig-plan">den Plan</a>');
    expect(body.html).toContain(
      '<figure class="figure" id="fig-plan" data-line="2"><figcaption><span class="caption-label">Abbildung 1</span><span class="caption-separator">: </span>' +
        '<span class="caption-text">Der Plan</span></figcaption><img src="plan.png" alt="Plan der Studie"></figure>',
    );
    expect(body.html).toContain('<figure class="figure" id="fig-ablauf" data-line="6"><figcaption><span class="caption-label">Abbildung 2</span>');
    expect(body.html).toContain('<img src="ablauf.png" alt="Ablauf"></figure>');
    expect(body.html).toContain('<p id="tab-noten" class="caption table-caption" data-line="10"><span class="caption-label">Tabelle 1</span><span class="caption-separator">: </span><span class="caption-text">Noten</span></p>');
    expect(body.html).toContain('<span class="caption-text">Rohdaten</span></p>');
    expect(body.html).toContain('Wie <a href="#tab-roh">Tabelle A1</a> zeigt; <a href="#tab-fehlt">Table 3</a>; <a href="#fig-ablauf">Abbildung 2</a>.');
    expect(body.html).not.toContain('<a id=');
    expect(body.problems).toEqual([{ severity: 'warning', message: 'The link #tab-fehlt names no figure, table, listing or heading of the file.', line: 27 }]);
  });

  test('a Markdown link to a heading gets the number of the heading or the label of the appendix, also through an anchor at the end of the heading', () => {
    const markdown = [
      '# Inhaltsverzeichnis',
      '',
      '# Einleitung',
      '',
      '## Methoden<a id="sec-methods"></a>',
      '',
      'Siehe [Kapitel 1.4](#methoden), [Chapter 9](#sec-methods), [die Methoden](#methoden), [Anhang C](#leitfaden-), [Anhang D](#sec-data) und [Kapitel 3](#literaturverzeichnis-bib-).',
      '',
      '# Literaturverzeichnis {BIB} <a id="sec-toc"></a>',
      '',
      '# Anhang',
      '',
      '## Leitfaden <a id="sec-guide"></a>',
      '',
      '## Daten<a id="sec-data"></a>',
      '',
      '[Kapitel 5](#sec-weg), [Kapitel 6](#leitfaden)',
      '',
    ].join('\n');
    const body = renderBody(markdown, layoutOf());
    expect(body.html).toContain('<h2 id="methoden" data-line="4"><span class="heading-number">1.1</span> Methoden<a id="sec-methods"></a></h2>');
    expect(body.html).toContain(
      '<a href="#methoden">Kapitel 1.1</a>, <a href="#sec-methods">Chapter 1.1</a>, <a href="#methoden">die Methoden</a>, <a href="#leitfaden-">Anhang A</a>, ' +
        '<a href="#sec-data">Anhang B</a> und <a href="#literaturverzeichnis-bib-">Kapitel 3</a>',
    );
    expect(body.headings.find((heading) => heading.anchor === 'sec-toc')).toMatchObject({ id: 'literaturverzeichnis-bib-', text: 'Literaturverzeichnis', section: 'BIB' });
    expect(body.html).toContain('<a href="#methoden"><span class="contents-number">1.1</span><span class="contents-text">Methoden</span></a>');
    // GitHub keeps the space before the anchor in the ID, so `#leitfaden` names no heading.
    expect(body.problems).toEqual([
      { severity: 'warning', message: 'The link #sec-weg names no figure, table, listing or heading of the file.', line: 16 },
      { severity: 'warning', message: 'The link #leitfaden names no figure, table, listing or heading of the file.', line: 16 },
    ]);
  });
});

describe('listings', () => {
  /** listings is a file with a listing of a snippet, a listing of a whole file, and a caption without code. */
  const listings = [
    'Wie [Listing 9](#lst-reading-fields) zeigt.',
    '',
    'Listing 1: Reading the fields<a id="lst-reading-fields"></a>',
    '',
    '<!-- listing: ../src/fields.ts#read-fields -->',
    '',
    '```typescript',
    'export function readFields() {',
    '  return 1;',
    '}',
    '```',
    '',
    'Listing 2: Die ganze Datei',
    '<!-- listing: ../src/my%20server.ts -->',
    '```ts',
    'const a = 1;',
    '```',
    '',
    'Listing: kein Code folgt',
    '',
    '[Listing 3](#lst-fehlt)',
    '',
  ].join('\n');

  test('a paragraph "Listing 1:" before the code block, or before a comment before it, is its caption', () => {
    const body = renderBody(listings, layoutOf(), hyphenatorOf('de-AT'));
    expect(body.listings).toEqual([
      { id: 'lst-reading-fields', label: 'Listing 1', text: 'Reading the fields', line: 2 },
      { id: 'listing-2', label: 'Listing 2', text: 'Die ganze Datei', line: 12 },
    ]);
    expect(body.html).toContain(
      '<p id="lst-reading-fields" class="caption listing-caption" data-line="2"><span class="caption-label">Listing 1</span><span class="caption-separator">: </span>' +
        '<span class="caption-text">Reading the fields</span></p>',
    );
    expect(body.html).toContain(
      '<pre class="listing"><code data-line="6" class="language-typescript"><span class="hljs-keyword">export</span> <span class="hljs-keyword">function</span> ' +
        '<span class="hljs-title function_">readFields</span>(<span class="hljs-params"></span>) {\n  <span class="hljs-keyword">return</span> <span class="hljs-number">1</span>;\n}\n</code></pre>',
    );
    expect(body.html).toContain('<span class="caption-text">Die ganze Datei</span></p>');
    expect(body.html).toContain(`<p data-line="18">Lis${softHyphen}ting: kein Code folgt</p>`);
    expect(body.html).toContain('Wie <a href="#lst-reading-fields">Listing 1</a> zeigt.');
    expect(body.html).not.toContain('<a id=');
    expect(body.problems).toEqual([{ severity: 'warning', message: 'The link #lst-fehlt names no figure, table, listing or heading of the file.', line: 20 }]);
  });

  test('a listing keeps the number of its caption in the file', () => {
    const body = renderBody('Listing 4: Vier\n\n```ts\na();\n```\n\nListing: Fünf\n\n```ts\nb();\n```\n', layoutOf());
    expect(body.listings.map((listing) => [listing.id, listing.label])).toEqual([
      ['listing-4', 'Listing 4'],
      ['listing-5', 'Listing 5'],
    ]);
  });

  test('the cite of the source that a plugin writes after the caption stays after it, and the list of listings leaves it out', () => {
    // A plugin of the renderer, such as the plugin of Markdown Paper, writes the cite of the source of a listing.
    const cite: RenderPlugin = {
      name: 'cite',
      apiVersion: 1,
      extendMarkdownIt: (md) => {
        md.core.ruler.push('cite', (state) => {
          for (const token of state.tokens) {
            const children = token.type === 'inline' ? token.children : null;
            const index = children?.findIndex((child) => child.type === 'text' && child.content.endsWith(' (server, L1-L2)')) ?? -1;
            if (children && index >= 0) {
              children[index].content = children[index].content.slice(0, -' (server, L1-L2)'.length);
              children.splice(index + 1, 0, layoutHtml(state, '<span class="caption-source"> (server, L1-L2)</span>'));
            }
          }
        });
      },
    };
    const body = renderBody('# Verzeichnis der Listings\n\n# Teil\n\nListing 1: Der Server (server, L1-L2)\n\n```python\nrun()\n```\n', layoutOf(), undefined, [cite]);
    expect(body.html).toContain('<span class="caption-text">Der Server</span><span class="caption-source"> (server, L1-L2)</span></p>');
    expect(body.listings.map((listing) => listing.text)).toEqual(['Der Server']);
    expect(body.html).toContain('<span class="caption-text">Der Server</span></span></a></li>');
  });

  test('the layout puts the number of each line from 1 before the code of each listing, and not before other code', () => {
    const markdown = `${listings}\n\`\`\`ts\nother();\n\`\`\`\n`;
    const html = renderBody(markdown, layoutOf({ listings: { lineNumbers: true } })).html;
    expect(html).toContain(
      '<code data-line="6" class="language-typescript"><span class="line-number" data-number="1" aria-hidden="true"></span>' +
        '<span class="hljs-keyword">export</span> <span class="hljs-keyword">function</span> <span class="hljs-title function_">readFields</span>(<span class="hljs-params"></span>) {\n' +
        '<span class="line-number" data-number="2" aria-hidden="true"></span>  <span class="hljs-keyword">return</span> <span class="hljs-number">1</span>;\n' +
        '<span class="line-number" data-number="3" aria-hidden="true"></span>}\n</code>',
    );
    expect(html).toContain(
      '<pre class="listing"><code data-line="14" class="language-ts"><span class="line-number" data-number="1" aria-hidden="true"></span>' +
        '<span class="hljs-keyword">const</span> a = <span class="hljs-number">1</span>;\n</code></pre>',
    );
    expect(html).toContain('<pre><code data-line="22" class="language-ts"><span class="hljs-title function_">other</span>();\n</code></pre>');
  });

  test('the number of a line of a listing stands in no element of a syntax color, also in a comment of several lines', () => {
    const html = renderBody('Listing 1: Ein Kommentar\n\n```ts\n/* one\ntwo */\nx();\n```\n', layoutOf({ listings: { lineNumbers: true } })).html;
    expect(html).toContain(
      '<span class="line-number" data-number="1" aria-hidden="true"></span><span class="hljs-comment">/* one</span>\n' +
        '<span class="line-number" data-number="2" aria-hidden="true"></span><span class="hljs-comment">two */</span>\n' +
        '<span class="line-number" data-number="3" aria-hidden="true"></span><span class="hljs-title function_">x</span>();\n</code>',
    );
  });

  test('the listings of the appendices are numbered A1, and the captions get no soft hyphens', () => {
    const markdown = '# Teil\n\nListing: Wirtschaftspädagogik\n\n```ts\na();\n```\n\n# Anhang\n\n## Code\n\nListing: Unterrichtsplanung\n\n```ts\nb();\n```\n';
    const body = renderBody(markdown, layoutOf({ hyphenate: true }), hyphenatorOf('de-AT'));
    expect(body.listings.map((listing) => [listing.id, listing.label])).toEqual([
      ['listing-1', 'Listing 1'],
      ['listing-a1', 'Listing A1'],
    ]);
    expect(body.html).toContain('<span class="caption-text">Wirtschaftspädagogik</span>');
    expect(body.html).toContain('<span class="caption-text">Unterrichtsplanung</span>');
  });
});

test('each block names its line in the file', () => {
  const html = renderBody('\n\n# Teil\n\nText\n\n- Punkt\n', layoutOf()).html;
  expect(html).toContain('<h1 id="teil" data-line="2"');
  expect(html).toContain('<p data-line="4">Text</p>');
  expect(html).toContain('<ul data-line="6">');
});

describe('the layout in a renderer with other plugins', () => {
  /** diagram is a plugin that shows the fenced code blocks `diagram` with a function in the page. */
  const diagram: RenderPlugin = { name: 'diagram', apiVersion: 1, render: { 'fence:diagram': (source, element) => void (element.textContent = source) } };

  test('the placeholders of the functions of plugins get no soft hyphens, and the text does', () => {
    const markdown = '# Einleitung\n\n```diagram\nWirtschaftspädagogik --> Unterrichtsplanung\n```\n\nWirtschaftspädagogik ist ein Fach.\n';
    const body = renderBody(markdown, layoutOf({ hyphenate: true }), hyphenatorOf('de-AT'), [diagram]);
    expect(body.html).toContain('<div class="nsmd-render" data-nsmd-render="0"><pre><code data-line="2" class="language-diagram">Wirtschaftspädagogik --&gt; Unterrichtsplanung\n</code></pre>\n</div>');
    expect(body.slots.map((slot) => slot.kind)).toEqual(['fence:diagram']);
    expect(body.html).toContain(`Wirt${softHyphen}schafts`);
    expect(body.html).toContain('<span class="heading-number">1</span> Einleitung');
  });

  test('without the layout in the environment, the same renderer renders the text without the layout: no numbers, footnotes at the end', () => {
    const renderer = createLayoutRenderer();
    const plain = renderer.toHtml('# Notizen\n\nText[^1]\n\n[^1]: Eine Fußnote.\n').html;
    expect(plain).toContain('<h1 id="notizen" data-line="0">Notizen</h1>');
    expect(plain).toContain('class="footnotes"');
    const found = emptyFound();
    const html = renderer.toHtml('# Teil\n\nText[^1]\n\n[^1]: Eine Fußnote.\n', { [layoutEnvKey]: { layout: layoutOf(), found } }).html;
    expect(found.headings.map((heading) => heading.number)).toEqual(['1']);
    expect(html).toContain('<span class="footnote"');
  });
});
