// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// Markdown text into the document of the editor (docs/specification.md, R-GEN-006): markdown-it reads the text, and
// the MarkdownParser of prosemirror-markdown builds the document from its tokens. Each top-level block of the document
// remembers the lines of the file that it comes from, so that the serializer writes a block that the user did not
// change byte for byte (open question 2 of the specification, recommendation A of the discussion document). Lines that
// no block holds and that are not blank, such as the definitions of link references, become raw blocks, and the front
// matter becomes a block of its own, so the blocks and the blank lines between them make up the whole text.

import type { Node, Schema } from '@tiptap/pm/model';
import type MarkdownIt from 'markdown-it';
import Token from 'markdown-it/lib/token.mjs';
import { MarkdownParser, type ParseSpec } from 'prosemirror-markdown';
import { frontMatterOf } from './frontMatter';

/** BlockSource is the text of the file of a top-level block of the document. */
export interface BlockSource {
  /** index is the position of the block among the top-level blocks that the parser made. */
  index: number;
  /** text is the text of the lines of the block, without the line break of its last line. */
  text: string;
}

/** MarkdownSource is what the serializer needs to write the blocks that the user did not change as the file has them. */
export interface MarkdownSource {
  /** blocks maps each top-level block that the parser made to its text. A changed block is another node. */
  blocks: WeakMap<Node, BlockSource>;
  /** count is the number of top-level blocks that the parser made. */
  count: number;
  /** before is the text before the first block: blank lines, each with its line break. */
  before: string;
  /** gaps holds the text between each block and the next one: the line break of the block and the blank lines. */
  gaps: string[];
  /** after is the text after the last block, from the line break of its last line on. */
  after: string;
  /** text is the whole text, with line feeds as line breaks and without a byte order mark. */
  text: string;
  /** lineBreak is the line break of the file. */
  lineBreak: '\n' | '\r\n';
  /** bom is true when the file starts with a byte order mark. */
  bom: boolean;
  /** references holds the normalized labels of the definitions of link references of the file. */
  references: Set<string>;
}

/** ParsedMarkdown is a Markdown text as the document of the editor. */
export interface ParsedMarkdown {
  doc: Node;
  source: MarkdownSource;
}

/** Range is a range of lines of the text, from `start` to `end`, without `end`. */
interface Range {
  start: number;
  end: number;
}

/** isBlank returns true for a line without other characters than spaces and tabs. */
const isBlank = (line: string | undefined): boolean => line === undefined || /^[ \t]*$/.test(line);

/** withoutTrailingNewline returns a text without the line feed at its end. */
const withoutTrailingNewline = (text: string): string => (text.endsWith('\n') ? text.slice(0, -1) : text);

/** alignOf returns the alignment of a cell of a table from the style that markdown-it gives it. */
const alignOf = (token: Token) => ({ align: /text-align:\s*(left|center|right)/.exec(token.attrGet('style') ?? '')?.[1] ?? null });

/**
 * isTight returns true when the list that opens at a position is tight: markdown-it hides the paragraphs of the items
 * of a tight list. A list whose items hold no paragraph, for example only headings, counts as tight.
 */
function isTight(tokens: readonly Token[], index: number): boolean {
  const level = tokens[index].level;
  for (let position = index + 1; position < tokens.length && tokens[position].level > level; position++) {
    const token = tokens[position];
    if (token.type === 'paragraph_open' && token.level === level + 2) {
      return token.hidden;
    }
  }
  return true;
}

/** listAttributes returns the attributes of a bullet list or of a task list. */
const listAttributes = (token: Token, tokens: Token[], index: number) => ({ bullet: token.markup || '-', tight: isTight(tokens, index) });

/** specs maps the tokens of markdown-it to the nodes and marks of the document. */
const specs: Record<string, ParseSpec> = {
  paragraph: { block: 'paragraph' },
  blockquote: { block: 'blockquote' },
  heading: { block: 'heading', getAttrs: (token) => ({ level: Number(token.tag.slice(1)) }) },
  bullet_list: { block: 'bulletList', getAttrs: listAttributes },
  ordered_list: {
    block: 'orderedList',
    getAttrs: (token, tokens, index) => ({ start: Number(token.attrGet('start') ?? 1), delimiter: token.markup || '.', tight: isTight(tokens, index) }),
  },
  list_item: { block: 'listItem' },
  task_list: { block: 'taskList', getAttrs: listAttributes },
  task_item: { block: 'taskItem', getAttrs: (token) => ({ checked: Boolean((token.meta as { checked?: boolean } | null)?.checked) }) },
  code_block: { block: 'codeBlock', noCloseToken: true, getAttrs: () => ({ fence: '', info: '', language: null }) },
  fence: {
    block: 'codeBlock',
    noCloseToken: true,
    getAttrs: (token) => ({ fence: token.markup, info: token.info, language: token.info.trim().split(/\s+/)[0] || null }),
  },
  hr: { node: 'horizontalRule', getAttrs: (token) => ({ markup: token.markup }) },
  html_block: { node: 'htmlBlock', getAttrs: (token) => ({ html: withoutTrailingNewline(token.content) }) },
  table: { block: 'table' },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: 'tableRow' },
  th: { block: 'tableHeader', getAttrs: alignOf },
  td: { block: 'tableCell', getAttrs: alignOf },
  footnote_reference: { block: 'footnoteDefinition', getAttrs: (token) => ({ label: (token.meta as { label: string }).label }) },
  front_matter: { node: 'frontMatter', getAttrs: (token) => token.meta as Record<string, unknown> },
  raw_block: { node: 'rawBlock', getAttrs: (token) => ({ text: token.content }) },
  em: { mark: 'italic', getAttrs: (token) => ({ marker: token.markup }) },
  strong: { mark: 'bold', getAttrs: (token) => ({ marker: token.markup }) },
  s: { mark: 'strike' },
  link: {
    mark: 'link',
    getAttrs: (token) => ({
      href: token.attrGet('href'),
      title: token.attrGet('title') || null,
      form: token.markup === 'linkify' ? 'bare' : token.markup === 'autolink' ? 'autolink' : 'inline',
    }),
  },
  code_inline: { mark: 'code', noCloseToken: true },
  image: { node: 'image', getAttrs: (token) => ({ src: token.attrGet('src'), alt: token.content || null, title: token.attrGet('title') || null }) },
  hardbreak: { node: 'hardBreak' },
  html_inline: { node: 'htmlInline', getAttrs: (token) => ({ html: token.content }) },
  footnote_ref: { node: 'footnoteReference', getAttrs: (token) => ({ label: (token.meta as { label: string }).label }) },
};

/** handled holds the types of the tokens that the parser turns into the document. */
const handled = new Set(['text', 'inline', 'softbreak']);
for (const [type, spec] of Object.entries(specs)) {
  if (spec.noCloseToken || spec.node || type === 'code_inline' || type === 'fence' || type === 'code_block') {
    handled.add(type);
  } else {
    handled.add(`${type}_open`);
    handled.add(`${type}_close`);
  }
}

/** knows returns true when the parser turns each token of a group of tokens, with their children, into the document. */
const knows = (tokens: readonly Token[]): boolean => tokens.every((token) => handled.has(token.type) && knows(token.children ?? []));

/** checkboxOf returns the state of the check box that markdown-it-task-lists puts at the start of an inline token. */
function checkboxOf(inline: Token | undefined): boolean | undefined {
  const first = inline?.children?.[0];
  if (first?.type !== 'html_inline' || !first.content.includes('task-list-item-checkbox')) {
    return undefined;
  }
  return first.content.includes('checked=""');
}

/**
 * prepared returns the tokens of markdown-it in the form that the specs read: the inline content of each cell of a
 * table in a paragraph, because the cells of the document hold blocks, and a bullet list whose items all start with a
 * check box as a task list. In a list with items with and without a check box, the check box stays text.
 */
function prepared(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if ((token.type === 'th_open' || token.type === 'td_open') && tokens[index + 1]?.type === 'inline') {
      out.push(token, new Token('paragraph_open', 'p', 1), tokens[index + 1], new Token('paragraph_close', 'p', -1));
      index++;
      continue;
    }
    out.push(token);
  }
  for (let index = 0; index < out.length; index++) {
    const list = out[index];
    if (list.type !== 'bullet_list_open') {
      continue;
    }
    // The items of the list are the list_item_open tokens one level deeper, up to the close of the list.
    const items: number[] = [];
    let close = index + 1;
    for (; close < out.length && !(out[close].type === 'bullet_list_close' && out[close].level === list.level); close++) {
      if (out[close].type === 'list_item_open' && out[close].level === list.level + 1) {
        items.push(close);
      }
    }
    const checks = items.map((item) => (out[item + 1]?.type === 'paragraph_open' ? checkboxOf(out[item + 2]) : undefined));
    const allTasks = checks.length > 0 && checks.every((check) => check !== undefined);
    items.forEach((item, position) => {
      const inline = out[item + 2];
      if (checks[position] === undefined || !inline.children) {
        return;
      }
      const [checkbox, ...rest] = inline.children;
      if (allTasks) {
        // The text after the check box starts with the space after `[ ]`.
        if (rest[0]?.type === 'text') {
          rest[0].content = rest[0].content.replace(/^ /, '');
        }
        inline.children = rest;
        out[item].type = 'task_item_open';
        out[item].meta = { checked: checks[position] };
      } else {
        const text = new Token('text', '', 0);
        text.content = checkbox.content.includes('checked=""') ? '[x]' : '[ ]';
        inline.children = [text, ...rest];
      }
    });
    if (allTasks) {
      list.type = 'task_list_open';
      out[close].type = 'task_list_close';
      for (let position = index + 1; position < close; position++) {
        if (out[position].type === 'list_item_close' && out[position].level === list.level + 1) {
          out[position].type = 'task_item_close';
        }
      }
    }
  }
  return out;
}

/** Group is a top-level block: its tokens and its lines. */
interface Group extends Range {
  tokens: Token[];
}

/**
 * MarkdownReader turns Markdown text into the document of the editor with the schema of the editor and its
 * markdown-it.
 */
export class MarkdownReader {
  private readonly parser: MarkdownParser;
  private tokens: Token[] = [];

  /**
   * @param schema - The schema of the document.
   * @param md - The markdown-it of the editor.
   * @param extraSpecs - The specs of the tokens of the extensions of the editor.
   */
  constructor(
    schema: Schema,
    private readonly md: MarkdownIt,
    extraSpecs: Record<string, ParseSpec> = {},
  ) {
    // The tokens come from parse, which prepares them; the parser only reads them.
    this.parser = new MarkdownParser(schema, { parse: () => this.tokens } as unknown as MarkdownIt, { ...specs, ...extraSpecs });
  }

  /**
   * parse returns the document of a Markdown text and the source of its blocks.
   * @param input - The text of the file.
   */
  parse(input: string): ParsedMarkdown {
    const bom = input.startsWith('﻿');
    const withoutBom = bom ? input.slice(1) : input;
    const lineBreak = withoutBom.includes('\r\n') ? '\r\n' : '\n';
    const text = withoutBom.replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    const frontMatter = frontMatterOf(lines);
    // markdown-it reads the text with the lines of the front matter blank, so that its line numbers are the lines of
    // the file.
    const body = frontMatter ? [...lines.slice(0, frontMatter.lines).map(() => ''), ...lines.slice(frontMatter.lines)] : lines;
    const env: { references?: Record<string, unknown> } = {};
    const tokens = this.md.parse(body.join('\n'), env);
    const groups: Group[] = [];
    if (frontMatter) {
      groups.push({ start: 0, end: frontMatter.lines, tokens: [] });
    }
    let position = frontMatter?.lines ?? 0;
    for (let index = 0; index < tokens.length; index++) {
      const first = tokens[index];
      let last = index;
      if (first.nesting === 1) {
        for (let depth = 1; depth > 0 && last + 1 < tokens.length; ) {
          last++;
          depth += tokens[last].nesting;
        }
      }
      const group = tokens.slice(index, last + 1);
      index = last;
      const range = this.rangeOf(group, lines, position);
      groups.push({ ...range, tokens: group });
      position = range.end;
    }

    // The lines between the blocks that are not blank become raw blocks, one for each run of such lines.
    const covered: Group[] = [];
    let line = 0;
    const rawUntil = (end: number) => {
      while (line < end) {
        if (isBlank(lines[line])) {
          line++;
          continue;
        }
        const start = line;
        while (line < end && !isBlank(lines[line])) {
          line++;
        }
        covered.push({ start, end: line, tokens: [] });
      }
    };
    for (const group of groups) {
      rawUntil(group.start);
      covered.push(group);
      line = group.end;
    }
    rawUntil(lines.length);

    const all: Token[] = [];
    for (const group of covered) {
      const lineText = lines.slice(group.start, group.end).join('\n');
      if (frontMatter && group.start === 0 && group.end === frontMatter.lines && group.tokens.length === 0) {
        const token = new Token('front_matter', '', 0);
        token.meta = { format: frontMatter.format, text: lineText };
        group.tokens = [token];
      } else if (group.tokens.length === 0 || !knows(group.tokens)) {
        // Text that no block holds, or a block with tokens that no extension turns into the document, stays as text.
        const token = new Token('raw_block', '', 0);
        token.content = lineText;
        group.tokens = [token];
      }
      all.push(...group.tokens);
    }
    this.tokens = prepared(all);
    const doc = this.parser.parse('');
    this.tokens = [];

    const source: MarkdownSource = {
      blocks: new WeakMap(),
      count: covered.length,
      before: '',
      gaps: [],
      after: '',
      text,
      lineBreak,
      bom,
      references: new Set(Object.keys(env.references ?? {})),
    };
    if (covered.length === 0) {
      return { doc, source };
    }
    if (doc.childCount !== covered.length) {
      throw new Error(`The document has ${doc.childCount} blocks, but the text has ${covered.length}.`);
    }
    covered.forEach((group, index) => {
      source.blocks.set(doc.child(index), { index, text: lines.slice(group.start, group.end).join('\n') });
      const next = covered[index + 1];
      if (next) {
        source.gaps.push(`\n${lines.slice(group.end, next.start).map((blank) => `${blank}\n`).join('')}`);
      }
    });
    source.before = lines
      .slice(0, covered[0].start)
      .map((blank) => `${blank}\n`)
      .join('');
    const end = covered[covered.length - 1].end;
    source.after = end < lines.length ? `\n${lines.slice(end).join('\n')}` : '';
    return { doc, source };
  }

  /**
   * rangeOf returns the lines of a top-level block, without blank lines at its end.
   * @param group - The tokens of the block.
   * @param lines - The lines of the text.
   * @param from - The first line after the block before.
   */
  private rangeOf(group: readonly Token[], lines: readonly string[], from: number): Range {
    const first = group[0];
    let start: number;
    let end: number;
    if (first.map) {
      [start, end] = first.map;
    } else {
      // markdown-it-footnote gives the definition of a footnote no lines: it starts at the line of its label and ends
      // with the last block of its text.
      const label = ((first.meta as { label?: string } | null)?.label ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^ {0,3}\\[\\^${label}\\]:`);
      start = from;
      while (start < lines.length && !pattern.test(lines[start])) {
        start++;
      }
      end = Math.max(start + 1, ...group.map((token) => token.map?.[1] ?? 0));
    }
    start = Math.max(start, from);
    while (end > start + 1 && isBlank(lines[end - 1])) {
      end--;
    }
    return { start, end };
  }
}
