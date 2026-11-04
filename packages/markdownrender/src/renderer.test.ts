// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the renderer without a page (docs/rendering.md, R-REN-001 to R-REN-003): the HTML of markdown-it 14 for
// CommonMark and the parts of GFM, the front matter and the lines of the blocks, the raw HTML, the GitHub alerts, the
// IDs of the headings, the comments of the tables and the plugins of the renderer. The tests run without a page, as a
// command line runs the renderer.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import spec from 'commonmark-spec';
import type MarkdownIt from 'markdown-it';
import { describe, expect, it } from 'vitest';
import { createMarkdownIt } from './markdownIt';
import { addOutputRules, headingText, prepareOutput, slug } from './output';
import type { RenderPlugin } from './plugins';
import { safeHtml } from './rawHtml';
import { MarkdownRenderer, type RendererOptions } from './renderer';

/** html returns the HTML of a text with a renderer with options. */
const html = (text: string, options: RendererOptions = {}): string => new MarkdownRenderer({ lines: false, ...options }).toHtml(text).html;

describe('the HTML of markdown-it 14', () => {
  it('writes each example of the CommonMark specification as the specification does, except the bare addresses that GFM links', () => {
    const renderer = new MarkdownRenderer({ rawHtml: 'trusted', headingIds: false, lines: false, frontMatter: 'text' });
    const differ = spec.tests
      .filter((example) => {
        const own = renderer.toHtml(example.markdown.replace(/→/g, '\t')).html;
        // The specification writes void elements as XHTML and an empty block quote with a line break.
        const expected = example.html
          .replace(/→/g, '\t')
          .replace(/<(hr|br|img [^>]*?) \/>/g, '<$1>')
          .replace(/<blockquote>\n<\/blockquote>/g, '<blockquote></blockquote>');
        return own !== expected;
      })
      .map((example) => example.number);
    expect(differ).toEqual([602, 608, 611, 612]);
    expect(html('See https://example.com.')).toBe('<p>See <a href="https://example.com">https://example.com</a>.</p>\n');
  });

  it('writes the parts of GFM: tables, strikethrough, task lists and footnotes at the end', () => {
    expect(html('| a | b |\n|:--|--:|\n| 1 | 2 |\n')).toBe(
      '<table>\n<thead>\n<tr>\n<th style="text-align:left">a</th>\n<th style="text-align:right">b</th>\n</tr>\n</thead>\n' +
        '<tbody>\n<tr>\n<td style="text-align:left">1</td>\n<td style="text-align:right">2</td>\n</tr>\n</tbody>\n</table>\n',
    );
    expect(html('~~gone~~')).toBe('<p><s>gone</s></p>\n');
    expect(html('- [ ] open\n- [x] done\n')).toBe(
      '<ul class="contains-task-list">\n' +
        '<li class="task-list-item"><input class="task-list-item-checkbox" disabled="" type="checkbox"> open</li>\n' +
        '<li class="task-list-item"><input class="task-list-item-checkbox" checked="" disabled="" type="checkbox"> done</li>\n</ul>\n',
    );
    const footnotes = html('Text.[^1]\n\n[^1]: The note.\n\nMore.\n');
    expect(footnotes).toMatch(/^<p>Text\.<sup class="footnote-ref"><a href="#fn1" id="fnref1">\[1\]<\/a><\/sup><\/p>\n<p>More\.<\/p>\n<hr class="footnotes-sep">/);
    expect(footnotes).toContain('<li id="fn1" class="footnote-item"><p>The note.');
    // The inline footnotes of markdown-it-footnote are no part of GFM.
    expect(html('Text^[inline].')).toBe('<p>Text^[inline].</p>\n');
  });

  it('keeps the footnotes in their places for the editor', () => {
    const md = createMarkdownIt([], { footnotes: 'inPlace' });
    const types = md.parse('A.[^1]\n\n[^1]: Note.\n\nB.\n', {}).map((token) => token.type);
    expect(types.indexOf('footnote_reference_open')).toBeLessThan(types.lastIndexOf('paragraph_open'));
    expect(types).not.toContain('footnote_block_open');
  });
});

describe('the text of a file', () => {
  it('leaves out the front matter and its byte order mark, and names the line of each block in the file', () => {
    const text = '﻿---\ntitle: A\n---\n\n# Title\n\nText\nmore\n\n- item\n\n```ts\ncode\n```\n';
    const rendering = new MarkdownRenderer().toHtml(text).html;
    expect(rendering).not.toContain('title: A');
    expect(rendering).toContain('<h1 id="title" data-line="4">Title</h1>');
    expect(rendering).toContain('<p data-line="6">Text\nmore</p>');
    expect(rendering).toContain('<ul data-line="9">\n<li data-line="9">item</li>');
    expect(rendering).toContain('<pre><code data-line="11" class="language-ts">code\n</code></pre>');
    expect(new MarkdownRenderer().toHtml('+++\na = 1\n+++\nText\n').html).toBe('<p data-line="3">Text</p>\n');
  });

  it('reads the first lines as text for a part of a file', () => {
    expect(html('---\ntitle: A\n---\n', { frontMatter: 'text' })).toContain('<h2 id="title-a">title: A</h2>');
  });

  it('keeps the line breaks of a file with CRLF', () => {
    expect(new MarkdownRenderer().toHtml('---\r\na: 1\r\n---\r\n\r\nText\r\n').html).toBe('<p data-line="4">Text</p>\n');
  });
});

describe('raw HTML', () => {
  const text = 'A <ins>b</ins> c<br> <a id="fig-plan"></a> <span style="color:red">d</span> <!-- note -->e\n\n<!-- a comment -->\n\n<details>\n<summary>More</summary>\n\nText\n\n</details>\n\n<div onclick="run()">x</div>\n';

  it('shows comments, plain elements and anchors safely, and other raw HTML as its text, by default', () => {
    expect(html(text)).toBe(
      '<p>A <ins>b</ins> c<br> <a id="fig-plan"></a> ' +
        '<span class="nsmd-raw nsmd-raw-html">&lt;span style=&quot;color:red&quot;&gt;</span>d<span class="nsmd-raw nsmd-raw-html">&lt;/span&gt;</span> e</p>\n' +
        '<details>\n<summary>More</summary>\n<p>Text</p>\n</details>\n' +
        '<pre class="nsmd-raw nsmd-raw-html">&lt;div onclick=&quot;run()&quot;&gt;x&lt;/div&gt;</pre>\n',
    );
    expect(html('<script>alert(1)</script>\n\nText <img src=x onerror="alert(1)">\n')).not.toMatch(/<script|<img/);
  });

  it('shows all raw HTML as its text in the way text, as the editor does', () => {
    const rendering = html(text, { rawHtml: 'text' });
    expect(rendering).toContain('<span class="nsmd-raw nsmd-raw-html">&lt;ins&gt;</span>');
    expect(rendering).toContain('<pre class="nsmd-raw nsmd-raw-html">&lt;!-- a comment --&gt;</pre>');
    // The check boxes of task lists stay check boxes.
    expect(html('- [x] done\n', { rawHtml: 'text' })).toContain('<input class="task-list-item-checkbox" checked="" disabled="" type="checkbox">');
  });

  it('writes raw HTML as the file has it in the way trusted', () => {
    expect(html(text, { rawHtml: 'trusted' })).toContain('<span style="color:red">d</span> <!-- note -->e');
    expect(html(text, { rawHtml: 'trusted' })).toContain('<div onclick="run()">x</div>');
  });

  it('closes the elements that raw HTML leaves open, and shows an end tag without its element as text', () => {
    expect(html('A <b>bold\n\nB </i> c\n\n<div>\n\nText\n')).toBe(
      '<p>A <b>bold</b></p>\n<p>B <span class="nsmd-raw nsmd-raw-html">&lt;/i&gt;</span> c</p>\n<div>\n<p>Text</p>\n</div>',
    );
    expect(html('</div>\n')).toBe('<pre class="nsmd-raw nsmd-raw-html">&lt;/div&gt;</pre>\n');
  });

  it('keeps only comments, text and safe tags', () => {
    expect(safeHtml('<p>a</p><!-- b --><br/>')).toBe('<p>a</p><br/>');
    const open: string[] = [];
    expect(safeHtml('<details><summary>A</summary>', open)).toBe('<details><summary>A</summary>');
    expect(open).toEqual(['details']);
    expect(safeHtml('</p>', open)).toBeUndefined();
    expect(safeHtml('</details>', open)).toBe('</details>');
    expect(open).toEqual([]);
    expect(safeHtml('<a name="x"></a> &amp; text')).toBe('<a name="x"></a> &amp; text');
    expect(safeHtml('<p class="x">a</p>')).toBeUndefined();
    expect(safeHtml('<a href="https://example.com">a</a>')).toBeUndefined();
    expect(safeHtml('<!-- open')).toBeUndefined();
    expect(safeHtml('a < b')).toBeUndefined();
  });
});

describe('the output as GitHub writes it', () => {
  it('writes a block quote with the marker of an alert on its first line as a GitHub alert', () => {
    expect(html('> [!NOTE]\n> The text\n> of the note.\n')).toBe(
      '<div class="markdown-alert markdown-alert-note">\n<p class="markdown-alert-title">Note</p>\n<p>The text\nof the note.</p>\n</div>\n',
    );
    expect(html('> [!warning]\n>\n> Careful.\n')).toBe('<div class="markdown-alert markdown-alert-warning">\n<p class="markdown-alert-title">Warning</p>\n<p>Careful.</p>\n</div>\n');
    expect(html('> [!TIP]\n')).toBe('<div class="markdown-alert markdown-alert-tip">\n<p class="markdown-alert-title">Tip</p>\n</div>\n');
    expect(new MarkdownRenderer().toHtml('> [!CAUTION]\n> Text\n').html).toContain('<p data-line="1">Text</p>');
  });

  it('keeps a block quote whose marker has text on its line, or that has another marker, a quotation', () => {
    expect(html('> [!NOTE] Text\n')).toBe('<blockquote>\n<p>[!NOTE] Text</p>\n</blockquote>\n');
    expect(html('> [!OTHER]\n> Text\n')).toBe('<blockquote>\n<p>[!OTHER]\nText</p>\n</blockquote>\n');
  });

  it('gives each heading the ID that GitHub gives it', () => {
    expect(html('# Über uns!\n\n## Über uns\n\n## Über uns\n\n### `code` and *more*\n\n# Quellen {BIB}\n\n## Leitfaden <a id="x"></a>\n')).toBe(
      '<h1 id="über-uns">Über uns!</h1>\n<h2 id="über-uns-1">Über uns</h2>\n<h2 id="über-uns-2">Über uns</h2>\n' +
        '<h3 id="code-and-more"><code>code</code> and <em>more</em></h3>\n<h1 id="quellen-bib">Quellen {BIB}</h1>\n' +
        '<h2 id="leitfaden-">Leitfaden <a id="x"></a></h2>\n',
    );
    expect(slug('A_b-c 1.2')).toBe('a_b-c-12');
    const md: MarkdownIt = createMarkdownIt();
    expect(headingText(md.parseInline('a ![image](x.png) `b`', {})[0].children ?? [])).toBe('a  b');
    expect(html('# Title\n', { headingIds: false })).toBe('<h1>Title</h1>\n');
  });

  it('keeps the ID that a plugin gave a heading, and the next heading of the same text gets the next ID', () => {
    // A plugin such as the layout gives a heading its ID before it changes the text of the heading.
    const own: RenderPlugin = {
      name: 'own',
      apiVersion: 1,
      extendMarkdownIt: (md) => {
        md.core.ruler.push('own', (state) => {
          const open = state.tokens.find((token) => token.type === 'heading_open');
          open?.attrSet('id', 'teil');
        });
      },
    };
    expect(html('# Part\n\n# Teil\n', { plugins: [own] })).toBe('<h1 id="teil">Part</h1>\n<h1 id="teil-1">Teil</h1>\n');
  });

  it('shows the color of a cell and the widths of the columns from the comments of the table', () => {
    const rendering = html('<!-- table: widths=60,40 -->\n| a | <!--cell red--> b |\n|---|---|\n| <!--cell yellow--> c | d |\n');
    expect(rendering).toBe(
      '<table class="nsmd-table-fixed">\n<colgroup><col style="width: 60%"><col style="width: 40%"></colgroup>\n<thead>\n<tr>\n<th>a</th>\n' +
        '<th data-color="red">b</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td data-color="yellow">c</td>\n<td>d</td>\n</tr>\n</tbody>\n</table>\n',
    );
    // The comment of the widths belongs to the table on the next line only.
    expect(html('<!-- table: widths=60,40 -->\n\n| a |\n|---|\n| b |\n')).not.toContain('colgroup');
  });
});

describe('the output in a markdown-it of another program', () => {
  it('writes the alerts and the widths of the columns with addOutputRules and prepareOutput, as the renderer does', () => {
    const md = createMarkdownIt();
    addOutputRules(md);
    const text = '> [!NOTE]\n> A hint.\n\n<!-- table: widths=30,70 -->\n| A | B |\n| --- | --- |\n| 1 | 2 |\n';
    const tokens = md.parse(text, {});
    prepareOutput(tokens, { headingIds: false, lines: false });
    const html = md.renderer.render(tokens, md.options, {});
    expect(html).toContain('<div class="markdown-alert markdown-alert-note">\n<p class="markdown-alert-title">Note</p>\n<p>A hint.</p>\n</div>');
    expect(html).toContain('<colgroup><col style="width: 30%"><col style="width: 70%"></colgroup>');
    expect(html).not.toContain('data-line');
    expect(new MarkdownRenderer({ lines: false }).toHtml(text).html).toContain(html.slice(0, html.indexOf('</div>')));
  });
});

describe('the plugins of the renderer', () => {
  /** math is a markdown-it plugin with a block `$$…$$` and an HTML rule of its own. */
  const math = (md: MarkdownIt) => {
    md.block.ruler.before('fence', 'math_block', (state, start, _end, silent) => {
      const line = state.src.slice(state.bMarks[start] + state.tShift[start], state.eMarks[start]);
      const found = /^\$\$(.+)\$\$$/.exec(line);
      if (!found) {
        return false;
      }
      if (!silent) {
        const token = state.push('math_block', 'div', 0);
        token.content = found[1];
        token.map = [start, start + 1];
        token.block = true;
      }
      state.line = start + 1;
      return true;
    });
    md.renderer.rules.math_block = (tokens, index) => `<div class="math">${md.utils.escapeHtml(tokens[index].content)}</div>\n`;
  };

  it('adds the syntax of a plugin, and writes a token that the plugin shows in a page with the HTML of its rule', () => {
    const plugin: RenderPlugin = { name: 'math', apiVersion: 1, extendMarkdownIt: math, render: { math_block: () => undefined, 'fence:mermaid': () => undefined } };
    const renderer = new MarkdownRenderer({ plugins: [plugin], lines: false });
    const rendering = renderer.toHtml('$$a<b$$\n\n```mermaid\ngraph TD\n```\n\n```ts\nx\n```\n');
    expect(rendering.html).toBe(
      '<div class="nsmd-render" data-nsmd-render="0"><div class="math">a&lt;b</div>\n</div>\n' +
        '<div class="nsmd-render" data-nsmd-render="1"><pre><code class="language-mermaid">graph TD\n</code></pre>\n</div>\n' +
        '<pre><code class="language-ts">x\n</code></pre>\n',
    );
    expect(rendering.slots.map((slot) => [slot.kind, slot.source])).toEqual([
      ['math_block', 'a<b'],
      ['fence:mermaid', 'graph TD\n'],
    ]);
    // Without a plugin, the syntax of the plugin is text.
    expect(html('$$a<b$$\n')).toBe('<p>$$a&lt;b$$</p>\n');
  });

  it('needs a name of its own and the plugin API version 1', () => {
    const plugin: RenderPlugin = { name: 'one', apiVersion: 1 };
    expect(() => new MarkdownRenderer({ plugins: [plugin, { ...plugin }] })).toThrow(/renderer has two plugins with the name one/);
    expect(() => new MarkdownRenderer({ plugins: [{ name: 'two', apiVersion: 2 as 1 }] })).toThrow(/API version 2/);
    expect(() => new MarkdownRenderer({ plugins: [{ name: 'with space', apiVersion: 1 }] })).toThrow(/name/);
  });

  it('takes the markdown-it of the integrating code, for example the one of an editor', () => {
    const md = createMarkdownIt([math]);
    const renderer = new MarkdownRenderer({ markdownIt: md, lines: false });
    expect(renderer.markdownIt).toBe(md);
    expect(renderer.toHtml('$$x$$\n').html).toBe('<div class="math">x</div>\n');
  });
});

describe('the renderer without the editor', () => {
  it('needs no code of the editor, of Tiptap or of ProseMirror', () => {
    const folder = join(__dirname);
    const sources = readdirSync(folder, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));
    for (const file of sources) {
      expect(readFileSync(join(folder, file), 'utf8'), file).not.toMatch(/from '(@nimblescape\/markdowneditor|@tiptap\/|prosemirror)/);
    }
    const manifest = JSON.parse(readFileSync(join(folder, '../package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(Object.keys(manifest.dependencies).filter((name) => /markdowneditor|tiptap|prosemirror/.test(name))).toEqual([]);
  });
});
