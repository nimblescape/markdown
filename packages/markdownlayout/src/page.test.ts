// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the page of a document in its layout (docs/rendering.md, R-LAYOUT-001 to R-LAYOUT-003): the search for
// the layout, its style sheets and templates with the addresses of their files and the fields, the schema of the front
// matter, the policy of the scripts, the script of the layout and the hold of Paged.js. A reader of files in memory
// stands for the disk. The tests come from the tests of the layout code of nimblescape Markdown Paper.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { RenderPlugin } from '@nimblescape/markdownrender';
import { formatText } from './format';
import { baseCss, findLayout, type Host, loadLayout, type Reader, renderPage, rewriteCss, rewriteHtml } from './page';
import { createLayoutRenderer } from './text';

const encoder = new TextEncoder();

/**
 * memoryReader returns a reader of files in memory.
 * @param files - The files by their URLs.
 */
const memoryReader = (files: Record<string, string>): Reader => ({ read: async (url) => (url in files ? encoder.encode(files[url]) : undefined) });

/**
 * hostOf returns a host for the tests.
 * @param files - The files by their URLs.
 * @param changes - The parts of the host that differ.
 */
const hostOf = (files: Record<string, string>, changes: Partial<Host> = {}): Host => ({
  reader: memoryReader(files),
  top: 'file:///repo/',
  resource: (url) => `https://resource/${url.replace(/^[a-z-]+:\/+/, '')}`,
  sources: 'https://resource',
  scripts: [{ src: 'https://resource/paged.polyfill.js' }],
  nonce: 'abc',
  ...changes,
});

/** thesis is a layout of a repository for the tests. */
const thesis = JSON.stringify({
  format: formatText,
  name: 'Thesis',
  language: 'de-AT',
  before: ['cover.html'],
  fields: { title: { description: 'Der Titel.', required: true }, author: { description: 'Der Name.', required: true }, kapitelumbruch: { description: 'ja oder nein', default: 'ja' } },
  pdfName: '{{author}}_{{title}}',
});

describe('the page', () => {
  test('the layout of the repository, its style sheet with the addresses of its files, the template with the fields, and the policy of the scripts', async () => {
    const host = hostOf({
      'file:///repo/layouts/thesis/layout.json': thesis,
      'file:///repo/layouts/thesis/page.css': '@font-face { src: url(fonts/a.ttf); } .x { background: url("https://e.com/b.png"); }',
      'file:///repo/layouts/thesis/cover.html': '<img src="images/logo.png" onload="x()"><h1>{{title}}</h1><script>alert(1)</script>',
    });
    const page = await renderPage(host, createLayoutRenderer(), 'file:///repo/paper/paper.md', '---\nlayout: thesis\ntitle: Agenten\nauthor: Hannes Stauss\n---\n# Teil\n');
    expect(page.problems).toEqual([]);
    expect(page.layout.id).toBe('thesis');
    expect(page.title).toBe('Agenten');
    expect(page.pdfName).toBe('Hannes-Stauss_Agenten.pdf');
    expect(page.html).toContain('url("https://resource/repo/layouts/thesis/fonts/a.ttf")');
    expect(page.html).toContain('url("https://e.com/b.png")');
    expect(page.html).toContain('<style data-paper="layout" data-file="page.css">');
    expect(page.html).toMatch(/<section class="paper-template paper-template-cover" data-template="cover"[^>]*>\n<img src="https:\/\/resource\/repo\/layouts\/thesis\/images\/logo.png"><h1>Agenten<\/h1>\n<\/section>/);
    expect(page.html).not.toContain('alert(1)');
    expect(page.html).toContain(`script-src 'nonce-abc'`);
    expect(page.html).toContain('<base href="https://resource/repo/paper/">');
    expect(page.html).toContain('--field-kapitelumbruch: "ja";');
    // The body, the template sections and the text have the fields as attributes, because Paged.js applies the
    // breaks and the named pages to the content without its body.
    expect(page.html).toMatch(/<body [^>]*data-field-author="Hannes Stauss"/);
    for (const start of ['<section class="paper-template paper-template-cover" ', '<main class="paper-text" ']) {
      const tag = page.html.slice(page.html.indexOf(start)).split('>')[0];
      expect(tag).toContain('data-field-author="Hannes Stauss"');
      expect(tag).toContain('data-field-kapitelumbruch="ja"');
    }
    expect(page.html).toContain('<html lang="de-AT">');
    expect(page.html).toContain('<h1 id="teil" data-line="5"><span class="heading-number">1</span> Teil</h1>');
    expect(page.html).toContain('<script nonce="abc" src="https://resource/paged.polyfill.js"></script>');
    // The script of the layout starts Paged.js when the page is complete; without the option hold, it does not wait
    // for the integrating code.
    expect(page.html).toContain('window.PagedConfig = { auto: true, before: window.paperHandlers.before, after: window.paperHandlers.after };');
    expect(page.html).not.toContain('window.paperHandlers.hold();');
  });

  test('a file without a layout gets the built-in layout plain, and the field lang changes its language', async () => {
    const page = await renderPage(hostOf({}), createLayoutRenderer(), 'file:///repo/notes.md', '---\nlang: de-AT\ntitle: Notizen\n---\n# Abbildungsverzeichnis\n\n# Teil\n\nFigure: Bild\n\n![Bild](b.png)\n');
    expect(page.layout.id).toBe('plain');
    expect(page.layout.folder).toBe('nimblescape-layout:/plain/');
    expect(page.layout.language).toBe('de-AT');
    expect(page.text.figures[0].label).toBe('Abbildung 1');
    expect(page.pdfName).toBe('notes.pdf');
    expect(page.html).toContain('<html lang="de-AT">');
    // The page holds the style sheet and the template of the built-in layout.
    expect(page.html).toContain('<style data-paper="layout" data-file="page.css">');
    expect(page.html).toContain('<section class="paper-template paper-template-title" data-template="title"');
    expect(page.html).toContain('Notizen');
  });

  test('a layout that does not exist is an error, and the page gets the layout plain', async () => {
    const page = await renderPage(hostOf({}), createLayoutRenderer(), 'file:///repo/a.md', '---\nlayout: missing\n---\n');
    expect(page.layout.id).toBe('plain');
    expect(page.problems[0]).toMatchObject({ severity: 'error', file: 'file:///repo/a.md' });
  });

  test('a front matter that cannot be read is a warning, and the page shows the text', async () => {
    const page = await renderPage(hostOf({}), createLayoutRenderer(), 'file:///repo/a.md', '---\ntitle: [\n---\n# Teil\n');
    expect(page.problems[0]).toMatchObject({ severity: 'warning', file: 'file:///repo/a.md', line: 0 });
    expect(page.layout.id).toBe('plain');
    expect(page.html).toContain('Teil</h1>');
  });

  test('the search for a layout goes up to the top folder, and no further', async () => {
    const files = { 'file:///repo/layouts/a/layout.json': JSON.stringify({ format: formatText }), 'file:///layouts/b/layout.json': JSON.stringify({ format: formatText }) };
    expect((await findLayout(hostOf(files), 'file:///repo/x/y/doc.md', 'a')).layout?.folder).toBe('file:///repo/layouts/a/');
    expect((await findLayout(hostOf(files), 'file:///repo/x/y/doc.md', 'b')).layout).toBeUndefined();
    expect((await findLayout(hostOf(files), 'file:///repo/doc.md', '.a')).problems[0].message).toContain('no name of a folder');
    // A layout of the repository comes before a built-in layout of the same name.
    const own = { 'file:///repo/layouts/plain/layout.json': JSON.stringify({ format: formatText, name: 'Own plain' }) };
    expect((await findLayout(hostOf(own), 'file:///repo/doc.md', 'plain')).layout).toMatchObject({ name: 'Own plain', folder: 'file:///repo/layouts/plain/' });
  });

  test('a layout with a slash in its name comes from the integrating code, for example from its clone of a layout on GitHub', async () => {
    const files = { 'file:///repo/.markdownpaper/repos/layouts/thesis/layout.json': JSON.stringify({ format: formatText, name: 'Thesis' }) };
    const host = hostOf(files, {
      findLayout: async (_document, name) =>
        name === 'school/layouts/thesis@v1.0.0' ? { folder: 'file:///repo/.markdownpaper/repos/layouts/thesis' } : { problem: `The layout ${name} is not in the project yet.` },
    });
    expect((await findLayout(host, 'file:///repo/paper/paper.md', 'school/layouts/thesis@v1.0.0')).layout).toMatchObject({ id: 'thesis', name: 'Thesis', folder: 'file:///repo/.markdownpaper/repos/layouts/thesis/' });
    expect((await findLayout(host, 'file:///repo/paper.md', 'school/layouts/concept@main')).problems[0].message).toBe('The layout school/layouts/concept@main is not in the project yet.');
    expect((await findLayout(hostOf(files), 'file:///repo/paper.md', '../a')).problems[0].message).toContain('no program here finds it');
  });

  test('relative addresses only: a style sheet and a template keep the addresses with a scheme, an anchor or a root', () => {
    const resource = (url: string) => `R:${url}`;
    expect(rewriteCss('a{b:url(#x)}c{d:url(/e.png)}f{g:url( h.png )}', 'file:///l/page.css', resource)).toBe('a{b:url(#x)}c{d:url(/e.png)}f{g:url("R:file:///l/h.png")}');
    expect(rewriteHtml('<a href="#x"></a><img src="i.png">', 'file:///l/c.html', resource)).toBe('<a href="#x"></a><img src="R:file:///l/i.png">');
  });

  test('the styles of the plugins come before the styles of the layout, and the option hold keeps Paged.js waiting', async () => {
    const plugin: RenderPlugin = { name: 'diagram', apiVersion: 1, styles: '.diagram { color: green; }', render: { 'fence:diagram': () => undefined } };
    const page = await renderPage(hostOf({}), createLayoutRenderer({ plugins: [plugin] }), 'file:///repo/a.md', '```diagram\nA -> B\n```\n', { hold: true });
    const plugins = page.html.indexOf('<style data-nsmd-plugin="diagram">\n.diagram { color: green; }\n</style>');
    expect(plugins).toBeGreaterThan(0);
    expect(plugins).toBeLessThan(page.html.indexOf('<style data-paper="layout"'));
    expect(page.html).toContain('window.paperHandlers.hold();\nwindow.PagedConfig');
    expect(page.text.slots.map((slot) => slot.kind)).toEqual(['fence:diagram']);
    expect(page.html).toContain('<div class="nsmd-render" data-nsmd-render="0">');
  });

  test('the page shows the syntax colors of the editor: the same classes with the same variables, with the colors of the light theme', async () => {
    const page = await renderPage(hostOf({}), createLayoutRenderer(), 'file:///repo/a.md', '```ts\nconst a = 1;\n```\n');
    expect(page.html).toContain('<span class="hljs-keyword">const</span>');
    const roles = (css: string): Map<string, string> => {
      const found = new Map<string, string>();
      for (const rule of css.matchAll(/pre\s*:is\(([^)]*)\)\s*\{\s*color: var\((--nsmd-syntax-[a-z]+)/g)) {
        for (const name of rule[1].split(',')) {
          found.set(name.trim(), rule[2]);
        }
      }
      return found;
    };
    const editor = roles(readFileSync(join(__dirname, '../../markdownrender/src/styles/content.css'), 'utf8'));
    expect(editor.size).toBeGreaterThan(20);
    expect(roles(baseCss)).toEqual(editor);
    expect(baseCss).toContain('color: var(--nsmd-syntax-keyword, #d1242f);');
  });
});

describe('the schema of the front matter of a layout', () => {
  test('the file of the schema of a layout, which gives the fields when layout.json has none', async () => {
    const schema = { type: 'object', required: ['title'], properties: { title: { type: 'string', description: 'The title.' }, kind: { enum: ['bachelor', 'master'], default: 'bachelor' } } };
    const files = {
      'file:///repo/layouts/thesis/layout.json': JSON.stringify({ format: formatText, before: ['cover.html'], frontMatterSchema: 'schema.json' }),
      'file:///repo/layouts/thesis/schema.json': JSON.stringify(schema),
      'file:///repo/layouts/thesis/page.css': '',
      'file:///repo/layouts/thesis/cover.html': '<p>{{kind}}</p>',
    };
    const loaded = await loadLayout(hostOf(files), 'file:///repo/doc.md', { layout: 'thesis' });
    expect(loaded.problems).toEqual([]);
    expect(loaded.schema).toEqual(schema);
    expect(loaded.layout.fields).toEqual({ title: { description: 'The title.', required: true }, kind: { description: '', required: false, default: 'bachelor', values: ['bachelor', 'master'] } });
    const page = await renderPage(hostOf(files), createLayoutRenderer(), 'file:///repo/doc.md', '---\nlayout: thesis\ntitle: T\n---\n');
    expect(page.schema).toEqual(schema);
    expect(page.html).toContain('<p>bachelor</p>');
  });

  test('a layout without the file of a schema has the schema of its fields, and a schema that is no JSON is a warning', async () => {
    const files = { 'file:///repo/layouts/thesis/layout.json': thesis, 'file:///repo/layouts/broken/layout.json': JSON.stringify({ format: formatText, stylesheets: [], frontMatterSchema: 'schema.json' }), 'file:///repo/layouts/broken/schema.json': '[1' };
    const loaded = await loadLayout(hostOf(files), 'file:///repo/doc.md', { layout: 'thesis' });
    expect(loaded.schema.required).toEqual(['title', 'author']);
    expect(Object.keys(loaded.schema.properties ?? {})).toEqual(['layout', 'title', 'author', 'kapitelumbruch']);
    // The layout thesis names page.css, which the folder does not have.
    expect(loaded.problems.map((problem) => problem.message)).toEqual(['The layout "thesis" names the file page.css, which does not exist.', 'The layout "thesis" names the file cover.html, which does not exist.']);
    const broken = await loadLayout(hostOf(files), 'file:///repo/doc.md', { layout: 'broken' });
    expect(broken.problems[0].message).toContain('The schema schema.json of the layout "broken" is no JSON schema');
    expect(broken.schema.properties?.layout).toBeDefined();
  });
});
