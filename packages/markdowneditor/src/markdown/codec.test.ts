// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the round trip of the Markdown of the editor (docs/editor.md, R-EDIT-004 to R-EDIT-006): every example
// of the CommonMark specification and every file of test/corpus comes back byte for byte when nothing changed; written
// new, each shows the same HTML in markdown-it; a change of one block changes only the text of that block.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { EditorState } from '@tiptap/pm/state';
import spec from 'commonmark-spec';
import { describe, expect, it } from 'vitest';
import { MarkdownCodec } from './codec';

const codec = new MarkdownCodec();

/** examples are the examples of the CommonMark specification, with their tabs, which the specification shows as →. */
const examples = spec.tests.map((example) => ({ ...example, markdown: example.markdown.replace(/→/g, '\t') }));

/** corpus holds the files of test/corpus. */
const corpusFolder = join(__dirname, '../../../../test/corpus');
const corpus = readdirSync(corpusFolder)
  .filter((file) => file.endsWith('.md') && file !== 'README.md')
  .map((file) => ({ file, text: readFileSync(join(corpusFolder, file), 'utf8') }));

/**
 * normalized returns HTML with the white space outside of `<pre>` collapsed and none around tags: a paragraph that the
 * serializer writes on one line has spaces where the file had line breaks, which shows the same.
 */
const normalized = (html: string): string =>
  html
    .split(/(<pre[\s\S]*?<\/pre>)/)
    .map((part, index) => (index % 2 === 1 ? part : part.replace(/\s+/g, ' ').replace(/\s*(<[^>]+>)\s*/g, '$1').trim()))
    .join('');

/** fresh returns the text of a document with each block written new. */
const fresh = (text: string): string => {
  const { doc, source } = codec.parse(text);
  return codec.serialize(doc, source, { verbatim: false });
};

/**
 * knownDifferences are the examples whose HTML changes when the serializer writes them new, with the reason. They are
 * limits of the document model, not of the serializer.
 */
const knownDifferences: Record<number, string> = {
  // A mark of the document cannot hold the same mark, so emphasis in emphasis becomes one emphasis.
  369: 'emphasis in emphasis',
  373: 'emphasis in emphasis',
  389: 'strong emphasis in strong emphasis',
  407: 'emphasis in emphasis',
  408: 'emphasis in emphasis',
  409: 'emphasis in emphasis',
  413: 'strong emphasis in emphasis, written in another nesting',
  417: 'strong emphasis in strong emphasis',
  418: 'emphasis in strong emphasis in emphasis',
  419: 'emphasis in a link in emphasis',
  425: 'strong emphasis in strong emphasis',
  426: 'strong emphasis in strong emphasis',
  427: 'strong emphasis in strong emphasis',
  432: 'strong emphasis in emphasis in strong emphasis',
  461: 'emphasis in emphasis',
  463: 'emphasis in emphasis',
  464: 'strong emphasis in strong emphasis',
  465: 'strong emphasis in strong emphasis',
  466: 'strong emphasis in strong emphasis',
  468: 'strong emphasis in strong emphasis',
  // A mark of the document needs text, so a link without text is lost.
  484: 'link without text',
  487: 'link without text',
  // A paragraph between two HTML blocks ends with the HTML of the next line, which the paragraph writes on its line.
  148: 'HTML that ends a paragraph inside a <pre> of HTML',
};

describe('the text of a file that the user did not change', () => {
  it.each(examples.map((example) => [example.number, example.markdown]))('stays the same: example %i', (_number, markdown) => {
    const { doc, source } = codec.parse(markdown);
    expect(codec.serialize(doc, source)).toBe(markdown);
  });

  it.each(corpus.map(({ file, text }) => [file, text]))('stays the same: %s', (_file, text) => {
    const { doc, source } = codec.parse(text);
    expect(codec.serialize(doc, source)).toBe(text);
  });

  it('keeps the line breaks and the byte order mark of the file', () => {
    const text = '﻿# Title\r\n\r\nText\r\nmore text\r\n';
    const { doc, source } = codec.parse(text);
    expect(codec.serialize(doc, source)).toBe(text);
  });

  it('keeps an empty text and a text of blank lines', () => {
    for (const text of ['', '\n', '\n\n  \n']) {
      const { doc, source } = codec.parse(text);
      expect(codec.serialize(doc, source)).toBe(text);
    }
  });
});

describe('a text written new', () => {
  it.each(examples.filter((example) => !(example.number in knownDifferences)).map((example) => [example.number, example.markdown]))(
    'shows the same HTML: example %i',
    (_number, markdown) => {
      expect(normalized(codec.md.render(fresh(markdown)))).toBe(normalized(codec.md.render(markdown)));
    },
  );

  it.each(corpus.map(({ file, text }) => [file, text]))('shows the same HTML: %s', (_file, text) => {
    expect(normalized(codec.md.render(fresh(text)))).toBe(normalized(codec.md.render(text)));
  });

  it('writes each paragraph on one line and keeps the marks of the file', () => {
    expect(fresh('Some __strong__ and _emphasis_\ntext with `code`.\n')).toBe('Some __strong__ and _emphasis_ text with `code`.\n');
  });

  it('keeps the bullets and the delimiters of the lists of the file', () => {
    expect(fresh('* a\n* b\n\n1) c\n2) d\n')).toBe('* a\n* b\n\n1) c\n2) d\n');
  });

  it('writes a table with aligned columns', () => {
    expect(fresh('| a | bb |\n|:-:|--:|\n| ccc | d |\n')).toBe('|  a  |  bb |\n| :-: | --: |\n| ccc |   d |\n');
  });

  it('keeps the marker of a GitHub alert on a line of its own', () => {
    expect(fresh('> [!NOTE]\n> Text\n> on two lines.\n')).toBe('> [!NOTE]\n> Text on two lines.\n');
    expect(fresh('> [!WARNING]\n')).toBe('> [!WARNING]\n');
  });

  it('escapes only what would start Markdown syntax', () => {
    const { doc, source } = codec.parse('Plain text.\n');
    const state = EditorState.create({ doc });
    const tr = state.tr.insertText('2 * 3 = 6, a_b, [x] and # one', 1, 12);
    expect(codec.serialize(tr.doc, source)).toBe('2 \\* 3 = 6, a_b, [x] and # one\n');
  });
});

describe('underline', () => {
  /** underlinedTexts returns the texts of a document with the mark of underline. */
  const underlinedTexts = (text: string): string[] => {
    const found: string[] = [];
    codec.parse(text).doc.descendants((node) => {
      if (node.isText && node.marks.some((mark) => mark.type.name === 'underline')) {
        found.push(node.text ?? '');
      }
    });
    return found;
  };

  it('reads <ins>text</ins> as underlined text and writes it back', () => {
    expect(underlinedTexts('A <ins>b **c**</ins> d\n')).toEqual(['b ', 'c']);
    expect(fresh('A <ins>b **c**</ins> d\n')).toBe('A <ins>b **c**</ins> d\n');
  });

  it('keeps an <ins> without its pair, or across another mark, as HTML', () => {
    expect(underlinedTexts('A <ins>b\n')).toEqual([]);
    expect(underlinedTexts('**a <ins>b** c</ins>\n')).toEqual([]);
    expect(fresh('**a <ins>b** c</ins>\n')).toBe('**a <ins>b** c</ins>\n');
  });
});

describe('a change of one block', () => {
  it('changes only the text of that block', () => {
    const text = '# Title\n\nFirst   paragraph,\nwith two lines.\n\n\n| a |  b |\n|---|---|\n| 1 |  2 |\n\nLast *paragraph*.\n';
    const { doc, source } = codec.parse(text);
    const state = EditorState.create({ doc });
    // The position 1 is the start of the text of the first block, the heading.
    const tr = state.tr.insertText('New ', 1);
    expect(codec.serialize(tr.doc, source)).toBe(text.replace('# Title', '# New Title'));
  });

  it('writes a new block between the blocks with a blank line', () => {
    const text = 'One.\n\nTwo.\n';
    const { doc, source } = codec.parse(text);
    const state = EditorState.create({ doc });
    const paragraph = doc.type.schema.nodes.paragraph.create(null, doc.type.schema.text('New.'));
    const tr = state.tr.insert(doc.child(0).nodeSize, paragraph);
    expect(codec.serialize(tr.doc, source)).toBe('One.\n\nNew.\n\nTwo.\n');
  });

  it('keeps the blocks around a deleted block', () => {
    const text = 'One.\n\nTwo.\n\n\nThree.\n';
    const { doc, source } = codec.parse(text);
    const state = EditorState.create({ doc });
    const start = doc.child(0).nodeSize;
    const tr = state.tr.delete(start, start + doc.child(1).nodeSize);
    expect(codec.serialize(tr.doc, source)).toBe('One.\n\nThree.\n');
  });
});

describe('the front matter', () => {
  it.each([
    ['yaml', '---\ntitle: A\n---\n\nText.\n'],
    ['toml', '+++\ntitle = "A"\n+++\n\nText.\n'],
    ['json', '{\n  "title": "A"\n}\n\nText.\n'],
  ])('is a block of its own in %s', (format, text) => {
    const { doc } = codec.parse(text);
    expect(doc.child(0).type.name).toBe('frontMatter');
    expect(doc.child(0).attrs.format).toBe(format);
    expect(doc.child(1).textContent).toBe('Text.');
  });
});
