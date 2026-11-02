// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the layout folder format (docs/rendering.md, R-LAYOUT-001, R-LAYOUT-004): layout.json with the defaults
// of the format and of the language, the fields and the schema of the front matter, the templates, the name of the PDF,
// the hyphenation and the values of the front matter. The tests come from the tests of the layout code of nimblescape
// Markdown Paper.

import { describe, expect, test } from 'vitest';
import { builtinFile, builtinFolder, builtinLayouts } from './builtin';
import { fieldsOfSchema, formatText, parseLayout, schemaOfFields, termsFor, withLanguage } from './format';
import { fieldValues } from './frontMatter';
import { hyphenateHtml, hyphenatorOf, softHyphen } from './hyphenate';
import { fill, pdfNameOf } from './template';

describe('layout.json', () => {
  test('the defaults of the format and of the language fill the fields that the file leaves out', () => {
    const { layout, problems } = parseLayout(JSON.stringify({ format: formatText }), 'mine', 'file:///repo/layouts/mine/');
    expect(problems).toEqual([]);
    expect(layout).toMatchObject({ id: 'mine', name: 'mine', language: 'en-US', stylesheets: ['page.css'], before: [], numbered: true, depth: 3, numberedSections: [], contentsFront: true, hyphenate: true, references: { hyphenate: false }, pdfName: '{{file}}' });
    expect(layout?.terms.sections.TOC).toContain('Table of Contents');
  });

  test('a file of another format or of another major version is not read, and a newer minor version is a warning', () => {
    expect(parseLayout('{', 'x', 'file:///x/').problems[0].message).toContain('no JSON');
    expect(parseLayout(JSON.stringify({ format: 'other 1.0.0' }), 'x', 'file:///x/').layout).toBeUndefined();
    expect(parseLayout(JSON.stringify({ format: 'nimblescape-layout 2.0.0' }), 'x', 'file:///x/').problems[0].message).toContain('reads the format 1.x');
    expect(parseLayout(JSON.stringify({ format: 'nimblescape-layout 1.4.0' }), 'x', 'file:///x/').problems[0].severity).toBe('warning');
    // The layouts of nimblescape Markdown Paper have the format 1.0.0, which this version reads as it is.
    expect(parseLayout(JSON.stringify({ format: 'nimblescape-layout 1.0.0' }), 'x', 'file:///x/').problems).toEqual([]);
  });

  test('a field can give the values that the author chooses from, and its default is one of them', () => {
    const field = (spec: unknown) => parseLayout(JSON.stringify({ format: formatText, fields: { schrift: spec } }), 'x', 'file:///x/');
    const chosen = field({ description: 'Die Schrift.', default: 'arial', values: ['arial', 'times'] });
    expect(chosen.problems).toEqual([]);
    expect(chosen.layout?.fields.schrift).toEqual({ description: 'Die Schrift.', required: false, default: 'arial', values: ['arial', 'times'] });
    expect(field({ description: 'Die Schrift.', default: 'serif', values: ['arial', 'times'] }).problems[0].message).toBe('The default "serif" of the field "schrift" of the layout "x" is not one of its values: arial, times.');
    const wrong = field({ description: 'Die Schrift.', values: 'arial' });
    expect(wrong.problems[0].message).toBe('The field "schrift" of the layout "x" must give "values" as a list of texts.');
    expect(wrong.layout?.fields.schrift.values).toBeUndefined();
  });

  test('a path outside the folder, a wrong language, a wrong term and a wrong pattern are warnings, and the rest is read', () => {
    const { layout, problems } = parseLayout(JSON.stringify({ format: formatText, before: ['../x.html', 'cover.html'], language: 'deutsch', terms: { BIB: 'Quellen', table: ['Tab.'], other: 'x' }, headings: { unnumbered: ['('] } }), 'x', 'file:///x/');
    expect(layout?.before).toEqual(['cover.html']);
    expect(layout?.language).toBe('en-US');
    expect(layout?.terms.sections.BIB).toEqual(['Quellen']);
    expect(layout?.terms.table).toBe('Tab.');
    expect(layout?.unnumbered).toEqual([]);
    expect(problems.map((problem) => problem.severity)).toEqual(['warning', 'warning', 'warning', 'warning']);
  });

  test('the empty document, the preview and the schema of the front matter name files of the folder', () => {
    expect(parseLayout(JSON.stringify({ format: formatText, document: 'document.md', preview: 'document.pdf', frontMatterSchema: 'schema.json' }), 'x', 'file:///x/')).toMatchObject({
      layout: { document: 'document.md', preview: 'document.pdf', frontMatterSchema: 'schema.json' },
      problems: [],
    });
    const { layout, problems } = parseLayout(JSON.stringify({ format: formatText, document: '../a.md', preview: 3, frontMatterSchema: '/schema.json' }), 'x', 'file:///x/');
    expect(layout?.document).toBeUndefined();
    expect(layout?.preview).toBeUndefined();
    expect(layout?.frontMatterSchema).toBeUndefined();
    expect(problems.map((problem) => problem.message)).toEqual([
      'The field "document" of the layout "x" must name a file of the layout folder.',
      'The field "preview" of the layout "x" must name a file of the layout folder.',
      'The field "frontMatterSchema" of the layout "x" must name a file of the layout folder.',
    ]);
  });

  test('a layout can number special sections, hyphenate the reference list and leave the front part out of the table of contents', () => {
    const { layout, problems } = parseLayout(JSON.stringify({ format: formatText, headings: { numberedSections: ['bib', 'XYZ'] }, references: { hyphenate: true }, contents: { front: false } }), 'x', 'file:///x/');
    expect(layout?.numberedSections).toEqual(['BIB']);
    expect(layout?.references).toEqual({ hyphenate: true });
    expect(layout?.contentsFront).toBe(false);
    expect(problems.map((problem) => problem.message)).toEqual(['The layout "x" has the unknown section "XYZ" in "headings.numberedSections"; the sections are TOC, LOF, LOT, LOL, BIB, ADT, AST, ACC, FWD, APX.']);
  });

  test('the built-in layout plain is a valid layout, and the package holds its files', () => {
    expect(builtinLayouts).toEqual(['plain']);
    const { layout, problems } = parseLayout(builtinFile(`${builtinFolder}plain/layout.json`) ?? '', 'plain', `${builtinFolder}plain/`);
    expect(problems).toEqual([]);
    expect(layout?.fields.title.required).toBe(true);
    for (const file of [...(layout?.stylesheets ?? []), ...(layout?.before ?? [])]) {
      expect(builtinFile(`${builtinFolder}plain/${file}`), file).toBeTypeOf('string');
    }
  });

  test('German and English have their words, and another language the English ones', () => {
    expect(termsFor('de-CH').figure).toBe('Abbildung');
    expect(termsFor('en-GB').sections.APX).toContain('Appendix');
    expect(termsFor('fr').table).toBe('Table');
  });

  test('the field lang of a document gives the layout its language, with the terms of that language', () => {
    const { layout } = parseLayout(JSON.stringify({ format: formatText, language: 'en-US', terms: { figure: 'Fig.' } }), 'x', 'file:///x/');
    expect(withLanguage(layout!, 'de-AT')).toMatchObject({ language: 'de-AT', terms: { figure: 'Abbildung' } });
    // A dialect of the language keeps the terms of the layout, and a value that is no language changes nothing.
    expect(withLanguage(layout!, 'en-GB')).toMatchObject({ language: 'en-GB', terms: { figure: 'Fig.' } });
    expect(withLanguage(layout!, 'Deutsch')).toBe(layout);
  });
});

describe('the schema of the front matter', () => {
  test('a layout without the file of a schema has the schema of its fields, with the field layout', () => {
    const { layout } = parseLayout(JSON.stringify({ format: formatText, name: 'Thesis', fields: { title: { description: 'Der Titel.', required: true }, font: { description: 'Die Schrift.', default: 'arial', values: ['arial', 'times'] } } }), 'x', 'file:///x/');
    expect(schemaOfFields(layout!)).toEqual({
      type: 'object',
      properties: {
        layout: { type: 'string', title: 'Layout', description: 'The layout of the document: Thesis.' },
        title: { type: 'string', description: 'Der Titel.' },
        font: { type: 'string', description: 'Die Schrift.', default: 'arial', enum: ['arial', 'times'] },
      },
      required: ['title'],
    });
  });

  test('the fields of a schema: the properties with their descriptions, the required ones, the defaults and the values', () => {
    const fields = fieldsOfSchema({
      type: 'object',
      required: ['title'],
      properties: { layout: { type: 'string' }, title: { type: 'string', description: 'The title.' }, pages: { type: 'integer', default: 10 }, kind: { enum: ['bachelor', 'master'] } },
    });
    expect(fields).toEqual({
      title: { description: 'The title.', required: true },
      pages: { description: '', required: false, default: '10' },
      kind: { description: '', required: false, values: ['bachelor', 'master'] },
    });
  });
});

describe('the values of the front matter', () => {
  test('each value as text: a list as its items, a date as its day, and no map', () => {
    expect(fieldValues('---\ntitle: Agenten\nauthor: [Anna, Ben]\ndate: 2026-11-02\npages: 3\ndraft: false\nmeta: { a: 1 }\nempty:\n---\n# Text\n').values).toEqual({
      title: 'Agenten',
      author: 'Anna, Ben',
      date: '2026-11-02',
      pages: '3',
      draft: 'false',
      empty: '',
    });
  });

  test('a front matter in TOML or JSON gives its values too, a file without one gives none, and a broken one an error', () => {
    expect(fieldValues('+++\ntitle = "Agenten"\n+++\n').values).toEqual({ title: 'Agenten' });
    expect(fieldValues('---\n{ "title": "Agenten" }\n---\n').values).toEqual({ title: 'Agenten' });
    expect(fieldValues('# Text\n')).toEqual({ values: {} });
    expect(fieldValues('---\ntitle: [\n---\n').error).toBeTypeOf('string');
  });
});

describe('templates', () => {
  test('fields, escaped, and parts for fields with and without a value', () => {
    expect(fill('<p>{{title}}</p>{{#sub}}<i>{{sub}}</i>{{/sub}}{{^sub}}none{{/sub}}', { title: 'A & <B>' })).toBe('<p>A &amp; &lt;B&gt;</p>none');
    expect(fill('{{#a}}[{{#b}}{{b}}{{/b}}]{{/a}}', { a: '1', b: '2' })).toBe('[2]');
  });

  test('the name of the PDF from the pattern, without empty parts, else from the name of the file', () => {
    expect(pdfNameOf('{{nr}}_{{author}}_{{type}}', { nr: '0025', author: 'Mag. Hannes Stauß', type: '', file: 'paper' })).toBe('0025_Mag.-Hannes-Stauss.pdf');
    expect(pdfNameOf('{{title}}', { title: '', file: 'concept.paper' })).toBe('concept.paper.pdf');
  });
});

describe('hyphenation', () => {
  test('soft hyphens in the words of the text, not in addresses, gender forms, headings, links, code and the placeholders of plugins', () => {
    const hyphenate = hyphenatorOf('de-AT');
    expect(hyphenate).toBeDefined();
    const html = hyphenateHtml(
      '<h1>Wirtschaftspädagogik</h1><p>Wirtschaftspädagogik der Schüler:innen, https://example.com/Wirtschaftspädagogik <a href="x">Wirtschaftspädagogik</a> <code>Wirtschaftspädagogik</code></p><div class="nsmd-render" data-nsmd-render="0">Wirtschaftspädagogik</div>',
      hyphenate!,
    );
    expect(html).toContain('<h1>Wirtschaftspädagogik</h1>');
    expect(html).toContain(`Wirt${softHyphen}schafts`);
    expect(html).toContain('Schü');
    expect(html).toContain(':innen');
    expect(html).toContain(' https://example.com/Wirtschaftspädagogik ');
    expect(html).toContain('<a href="x">Wirtschaftspädagogik</a>');
    expect(html).toContain('<code>Wirtschaftspädagogik</code>');
    expect(html).toContain('<div class="nsmd-render" data-nsmd-render="0">Wirtschaftspädagogik</div>');
  });

  test('words joined by a slash get soft hyphens, paths do not', () => {
    const hyphenate = hyphenatorOf('de-AT')!;
    expect(hyphenate('(zentrale Forschungsfrage/n)')).toBe(`(zen${softHyphen}tra${softHyphen}le For${softHyphen}schungs${softHyphen}fra${softHyphen}ge/n)`);
    for (const path of ['/usr/share/Wirtschaftspädagogik', './Wirtschaftspädagogik', '~/Wirtschaftspädagogik', 'bilder/Wirtschaftspädagogik.png']) {
      expect(hyphenate(path)).toBe(path);
    }
  });

  test('a language without patterns gets no hyphenation', () => {
    expect(hyphenatorOf('ja-JP')).toBeUndefined();
    expect(hyphenatorOf('en-GB')).toBeDefined();
  });
});
