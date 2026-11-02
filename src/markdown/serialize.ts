// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The document of the editor back into Markdown text (docs/editor.md, R-EDIT-004, R-EDIT-005): a top-level block
// that the user did not change is the same node as after parsing, and the serializer writes its text from the file byte for
// byte, with the blank lines between such blocks. The MarkdownSerializer of prosemirror-markdown writes a changed or
// new block in the form of the formatter of nimblescape Markdown Notes: each paragraph on one line, a table with
// aligned columns, and the marks of the file where the node records them, for example `__` for bold text.

import type { Mark, Node } from '@tiptap/pm/model';
import { MarkdownSerializer, type MarkdownSerializerState } from 'prosemirror-markdown';
import stringWidth from 'string-width';
import { type EscapeContext, escapeText } from './escape';
import { widthsPattern } from './tableComments';
import type { MarkdownSource } from './parse';

type NodeWriter = (state: MarkdownSerializerState, node: Node, parent: Node, index: number) => void;

/** MarkWriter is how the serializer writes a mark, as prosemirror-markdown takes it. */
interface MarkWriter {
  open: string | ((state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) => string);
  close: string | ((state: MarkdownSerializerState, mark: Mark, parent: Node, index: number) => string);
  mixable?: boolean;
  expelEnclosingWhitespace?: boolean;
  escape?: boolean;
}

/** SerializeOptions change how the serializer writes a document. */
export interface SerializeOptions {
  /** verbatim false writes each block new, also a block that the user did not change; the default is true. */
  verbatim?: boolean;
}

/** Writers are the ways to write the nodes and marks of the extensions of the editor. */
export interface Writers {
  nodes?: Record<string, NodeWriter>;
  marks?: Record<string, MarkWriter>;
}

/**
 * TightListState holds the two members of the state of prosemirror-markdown that its own code for lists uses: whether
 * the current list is tight, and the closing of the block before with a given number of line breaks. The writer of a
 * list item uses them in the same way, so that the blocks of an item of a tight list follow each other without a blank
 * line, which would make the list loose.
 */
interface TightListState {
  inTightList: boolean;
  flushClose(size?: number): void;
}

/** tightOf returns the members of the state of prosemirror-markdown for tight lists. */
const tightOf = (state: MarkdownSerializerState): TightListState => state as unknown as TightListState;

/**
 * writeItem writes the blocks of a list item. An empty paragraph at the start of an item that has more blocks is the
 * paragraph that the schema needs before a block such as a code block, which the file did not have, so it writes
 * nothing.
 */
function writeItem(state: MarkdownSerializerState, item: Node): void {
  item.forEach((child, _offset, index) => {
    if (index === 0 && child.type.name === 'paragraph' && child.childCount === 0 && item.childCount > 1) {
      return;
    }
    if (index > 0 && tightOf(state).inTightList) {
      tightOf(state).flushClose(1);
    }
    state.render(child, item, index);
  });
}

/** alertMarker matches the marker of a GitHub alert at the start of the first paragraph of a block quote. */
const alertMarker = /^(\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])(?: +|$)/i;

/** wordCharacter is a letter or a digit of any script. */
const wordCharacter = /[\p{L}\p{N}]/u;

/** longestRun returns the length of the longest run of a character in a text. */
function longestRun(text: string, character: string): number {
  let longest = 0;
  let run = 0;
  for (const each of text) {
    run = each === character ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return longest;
}

/** codeFence returns the backticks around an inline code span with a text. */
function codeTicks(text: string): string {
  return '`'.repeat(longestRun(text, '`') + 1);
}

/** textAround returns the text of the inline node before and after a range of inline nodes of a parent. */
function textAround(parent: Node, from: number, to: number): { before: string; after: string } {
  const previous = from > 0 ? parent.child(from - 1) : undefined;
  const next = to < parent.childCount ? parent.child(to) : undefined;
  return { before: previous?.isText ? (previous.text ?? '') : '', after: next?.isText ? (next.text ?? '') : '' };
}

/** markEnd returns the index after the last inline node of a run of nodes of a parent with a mark, from an index. */
function markEnd(mark: Mark, parent: Node, index: number): number {
  let end = index;
  while (end < parent.childCount && mark.isInSet(parent.child(end).marks)) {
    end++;
  }
  return end;
}

/**
 * delimiterOf returns the marker of emphasis or strong emphasis for a mark: the marker of the file, except an
 * underscore inside a word, where it starts no emphasis.
 */
function delimiterOf(mark: Mark, parent: Node, index: number, fallback: string): string {
  const marker = (mark.attrs.marker as string | undefined) || fallback;
  if (!marker.startsWith('_')) {
    return marker;
  }
  let start = index;
  while (start > 0 && mark.isInSet(parent.child(start - 1).marks)) {
    start--;
  }
  const { before, after } = textAround(parent, start, markEnd(mark, parent, start));
  const inWord = wordCharacter.test(before.slice(-1)) || wordCharacter.test(after.slice(0, 1));
  return inWord ? fallback.replace(/_/g, '*') : marker;
}

/** linkTextOf returns the text of the run of inline nodes with a link mark that starts at an index. */
function linkTextOf(mark: Mark, parent: Node, index: number): { text: string; plain: boolean } {
  const end = markEnd(mark, parent, index);
  let text = '';
  let plain = true;
  for (let position = index; position < end; position++) {
    const child = parent.child(position);
    plain &&= child.isText && child.marks.length === 1;
    text += child.text ?? '';
  }
  return { text, plain };
}

/** linkFormOf returns how the serializer writes a link: as the file did when that still fits the text, else inline. */
function linkFormOf(mark: Mark, parent: Node, index: number): 'inline' | 'autolink' | 'bare' {
  const href = mark.attrs.href as string;
  const { text, plain } = linkTextOf(mark, parent, index);
  const matches = plain && (text === href || `mailto:${text}` === href || `http://${text}` === href);
  const form = mark.attrs.form as string;
  if (form === 'bare' && matches) {
    return 'bare';
  }
  if (matches && /^[A-Za-z][A-Za-z\d+.-]{1,31}:[^\s<>]*$/.test(href)) {
    return text === href || `mailto:${text}` === href ? 'autolink' : 'inline';
  }
  return 'inline';
}

/**
 * altText returns the description of an image for its brackets: the text of the file when its brackets pair up, which
 * keeps the Markdown of a description such as `*a* [b]`, else the text with each bracket escaped.
 */
function altText(alt: string): string {
  let depth = 0;
  for (let index = 0; index < alt.length && depth >= 0; index++) {
    if (alt[index] === '\\') {
      index++;
    } else if (alt[index] === '[') {
      depth++;
    } else if (alt[index] === ']') {
      depth--;
    }
  }
  return depth === 0 ? alt : alt.replace(/[[\]]/g, '\\$&');
}

/** destination returns the destination of a link or an image, in angle brackets when it has spaces. */
function destination(href: string): string {
  return /[\s<>]/.test(href) ? `<${href.replace(/[<>]/g, (character) => encodeURIComponent(character))}>` : href.replace(/[()]/g, '\\$&');
}

/** titleOf returns the title of a link or an image in quotes, with a space before it, or nothing. */
const titleOf = (title: unknown): string => (typeof title === 'string' && title ? ` "${title.replace(/"/g, '\\"')}"` : '');

/** cellWidth returns the width that a text editor shows for the text of a cell of a table. */
const cellWidth = (text: string): number => stringWidth(text);

/** padded returns the text of a cell of a table with the spaces that fill its column, after the alignment. */
function padded(text: string, width: number, alignment: string | null): string {
  const fill = Math.max(0, width - cellWidth(text));
  if (alignment === 'right') {
    return `${' '.repeat(fill)}${text}`;
  }
  if (alignment === 'center') {
    const before = Math.floor(fill / 2);
    return `${' '.repeat(before)}${text}${' '.repeat(fill - before)}`;
  }
  return `${text}${' '.repeat(fill)}`;
}

/** delimiter returns the cell of the delimiter row of a column of a table, at least three characters wide. */
function delimiter(width: number, alignment: string | null): string {
  switch (alignment) {
    case 'left':
      return `:${'-'.repeat(width - 1)}`;
    case 'right':
      return `${'-'.repeat(width - 1)}:`;
    case 'center':
      return `:${'-'.repeat(width - 2)}:`;
    default:
      return '-'.repeat(width);
  }
}

/**
 * MarkdownWriter writes the document of the editor as Markdown text.
 */
export class MarkdownWriter {
  private readonly serializer: MarkdownSerializer;
  private context: Pick<EscapeContext, 'references'> = { references: new Set() };
  private readonly autolinks = new WeakSet<MarkdownSerializerState>();

  /**
   * @param normalize - The normalization of the labels of link references of the markdown-it of the editor.
   * @param writers - The ways to write the nodes and marks of the extensions of the editor.
   */
  constructor(
    private readonly normalize: (label: string) => string,
    writers: Writers = {},
  ) {
    const nodes: Record<string, NodeWriter> = {
      paragraph: (state, node, parent, index) => {
        // The marker of a GitHub alert, `> [!NOTE]`, stays on a line of its own, as GitHub needs it.
        const first = node.firstChild;
        const alert = parent?.type.name === 'blockquote' && index === 0 && first?.isText && first.marks.length === 0 ? alertMarker.exec(first.text ?? '') : null;
        if (alert) {
          state.write(alert[1]);
          if (node.content.size > alert[0].length) {
            state.ensureNewLine();
            state.renderInline(node.cut(alert[0].length));
          }
        } else {
          state.renderInline(node);
        }
        state.closeBlock(node);
      },
      heading: (state, node) => {
        state.write(`${'#'.repeat(node.attrs.level as number)} `);
        state.renderInline(node, false);
        state.closeBlock(node);
      },
      blockquote: (state, node) => state.wrapBlock('> ', null, node, () => state.renderContent(node)),
      bulletList: (state, node) => state.renderList(node, '  ', () => `${(node.attrs.bullet as string) || '-'} `),
      taskList: (state, node) => state.renderList(node, '  ', () => `${(node.attrs.bullet as string) || '-'} `),
      orderedList: (state, node) => {
        const start = (node.attrs.start as number | null) ?? 1;
        const delimiterCharacter = (node.attrs.delimiter as string) || '.';
        const widest = String(start + node.childCount - 1).length;
        state.renderList(node, ' '.repeat(widest + 2), (index) => {
          const number = String(start + index);
          return `${number}${delimiterCharacter}${' '.repeat(widest - number.length + 1)}`;
        });
      },
      listItem: (state, node) => writeItem(state, node),
      taskItem: (state, node) => {
        state.write(node.attrs.checked ? '[x] ' : '[ ] ');
        writeItem(state, node);
      },
      codeBlock: (state, node) => {
        const text = node.textContent;
        const fenceAttribute = (node.attrs.fence as string) || '```';
        const character = fenceAttribute[0] === '~' ? '~' : '`';
        const longest = Math.max(0, ...text.split('\n').map((line) => (new RegExp(`^ {0,3}(\\${character}+)`).exec(line)?.[1].length ?? 0)));
        const fence = character.repeat(Math.max(fenceAttribute.length, 3, longest + 1));
        const language = (node.attrs.language as string | null) ?? '';
        const info = (node.attrs.info as string) || '';
        const infoText = info.trim().split(/\s+/)[0] === language ? info : language;
        state.write(`${fence}${infoText}\n`);
        if (text !== '') {
          state.text(text, false);
          state.ensureNewLine();
        }
        state.write(fence);
        state.closeBlock(node);
      },
      horizontalRule: (state, node) => {
        state.write((node.attrs.markup as string) || '---');
        state.closeBlock(node);
      },
      hardBreak: (state, node, parent, index) => {
        for (let position = index + 1; position < parent.childCount; position++) {
          if (parent.child(position).type !== node.type) {
            state.write('\\\n');
            return;
          }
        }
      },
      text: (state, node, parent, index) => {
        if (this.autolinks.has(state)) {
          state.text(node.text ?? '', false);
          return;
        }
        const previous = index > 0 ? parent.child(index - 1) : undefined;
        const atLineStart = (index === 0 && parent.isTextblock && parent.type.name !== 'heading') || previous?.type.name === 'hardBreak';
        let text = escapeText(node.text ?? '', {
          atLineStart,
          inLink: node.marks.some((mark) => mark.type.name === 'link'),
          references: this.context.references,
          normalize: this.normalize,
        });
        // A run of `#` at the end of a heading would be read as its closing sequence.
        if (parent.type.name === 'heading' && index === parent.childCount - 1) {
          text = text.replace(/(^|[ \t])(#+)([ \t]*)$/, '$1\\$2$3');
        }
        state.text(text, false);
      },
      image: (state, node) => {
        const alt = altText((node.attrs.alt as string | null) ?? '');
        state.write(`![${alt}](${destination((node.attrs.src as string) ?? '')}${titleOf(node.attrs.title)})`);
      },
      table: (state, node) => {
        this.writeTable(state, node);
      },
      frontMatter: (state, node) => {
        state.text(node.attrs.text as string, false);
        state.closeBlock(node);
      },
      htmlBlock: (state, node) => {
        state.text(node.attrs.html as string, false);
        state.closeBlock(node);
      },
      rawBlock: (state, node) => {
        state.text(node.attrs.text as string, false);
        state.closeBlock(node);
      },
      footnoteDefinition: (state, node) =>
        state.wrapBlock('    ', `[^${node.attrs.label as string}]: `, node, () => state.renderContent(node)),
      htmlInline: (state, node) => {
        state.text(node.attrs.html as string, false);
      },
      footnoteReference: (state, node) => {
        state.write(`[^${node.attrs.label as string}]`);
      },
      ...writers.nodes,
    };
    const marks: Record<string, MarkWriter> = {
      italic: {
        open: (_state, mark, parent, index) => delimiterOf(mark, parent, index, '*'),
        close: (_state, mark, parent, index) => delimiterOf(mark, parent, index - 1, '*'),
        mixable: true,
        expelEnclosingWhitespace: true,
      },
      bold: {
        open: (_state, mark, parent, index) => delimiterOf(mark, parent, index, '**'),
        close: (_state, mark, parent, index) => delimiterOf(mark, parent, index - 1, '**'),
        mixable: true,
        expelEnclosingWhitespace: true,
      },
      strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
      // Markdown has no underline; GitHub shows `<ins>` underlined (R-EDIT-007).
      underline: { open: '<ins>', close: '</ins>', mixable: true },
      code: {
        open: (_state, _mark, parent, index) => {
          const text = parent.child(index).text ?? '';
          return `${codeTicks(text)}${/^`|^ .*[^ ]/.test(text) || text.startsWith('`') ? ' ' : ''}`;
        },
        close: (_state, _mark, parent, index) => {
          const text = parent.child(index - 1).text ?? '';
          return `${/`$|[^ ].* $/.test(text) || text.endsWith('`') ? ' ' : ''}${codeTicks(text)}`;
        },
        escape: false,
      },
      link: {
        open: (state, mark, parent, index) => {
          const form = linkFormOf(mark, parent, index);
          if (form !== 'inline') {
            this.autolinks.add(state);
          }
          return form === 'autolink' ? '<' : form === 'bare' ? '' : '[';
        },
        close: (state, mark, parent, index) => {
          this.autolinks.delete(state);
          let start = index - 1;
          while (start > 0 && mark.isInSet(parent.child(start - 1).marks)) {
            start--;
          }
          const form = linkFormOf(mark, parent, start);
          if (form === 'autolink') {
            return '>';
          }
          if (form === 'bare') {
            return '';
          }
          return `](${destination(mark.attrs.href as string)}${titleOf(mark.attrs.title)})`;
        },
        mixable: true,
      },
      ...writers.marks,
    };
    this.serializer = new MarkdownSerializer(nodes as never, marks as never, { hardBreakNodeName: 'hardBreak', strict: true });
  }

  /**
   * blockText returns the Markdown text of a top-level block, written new.
   * @param doc - The document, for its type.
   * @param block - The block.
   */
  private blockText(doc: Node, block: Node): string {
    return this.serializer.serialize(doc.type.create(null, block));
  }

  /**
   * inlineText returns the Markdown text of the content of a cell of a table on one line.
   * @param doc - A document, for its type.
   * @param cell - The cell.
   */
  private cellText(doc: Node, cell: Node): string {
    const parts: string[] = [];
    cell.forEach((block) => {
      parts.push(block.isTextblock ? this.serializer.serialize(doc.type.create(null, block)) : this.serializer.serialize(doc.type.create(null, block)));
    });
    return parts
      .join('<br>')
      .replace(/\\\n/g, '<br>')
      .replace(/\n/g, ' ')
      .replace(/(^|[^\\])\|/g, '$1\\|')
      .replace(/(^|[^\\])\|/g, '$1\\|')
      .trim();
  }

  /**
   * writeTable writes a table as a GFM table with aligned columns: a `|` at the start and at the end of each row, one
   * space on each side of each cell, and each column as wide as its widest cell, at least three characters.
   */
  private writeTable(state: MarkdownSerializerState, table: Node): void {
    const doc = table.type.schema.topNodeType.create(null, table.type.schema.nodes.paragraph.create());
    const rows: string[][] = [];
    const alignments: (string | null)[] = [];
    table.forEach((row, _offset, rowIndex) => {
      const cells: string[] = [];
      row.forEach((cell) => {
        // The color of a cell is a comment at its start (docs/editor.md, R-EDIT-010).
        const color = cell.attrs.background ? `<!--cell ${cell.attrs.background as string}-->` : '';
        const text = this.cellText(doc, cell);
        cells.push(color && text ? `${color} ${text}` : color || text);
        if (rowIndex === 0) {
          alignments.push((cell.attrs.align as string | null) ?? null);
        }
        for (let extra = 1; extra < ((cell.attrs.colspan as number | undefined) ?? 1); extra++) {
          cells.push('');
          if (rowIndex === 0) {
            alignments.push(null);
          }
        }
      });
      rows.push(cells);
    });
    const columns = Math.max(alignments.length, ...rows.map((row) => row.length));
    const widths = Array.from({ length: columns }, (_, column) => Math.max(3, ...rows.map((row) => cellWidth(row[column] ?? ''))));
    const line = (cells: readonly string[]) => `| ${widths.map((width, column) => padded(cells[column] ?? '', width, alignments[column] ?? null)).join(' | ')} |`;
    const lines = [line(rows[0] ?? []), `| ${widths.map((width, column) => delimiter(width, alignments[column] ?? null)).join(' | ')} |`, ...rows.slice(1).map(line)];
    lines.forEach((text, index) => {
      if (index > 0) {
        state.ensureNewLine();
      }
      state.write(text);
    });
    state.closeBlock(table);
  }

  /**
   * serialize returns the Markdown text of a document. With the source of the parsed text, each top-level block that
   * the user did not change keeps its text from the file, and two such blocks that followed each other in the file keep
   * the blank lines between them.
   * @param doc - The document.
   * @param source - The source of the parsed text, or undefined to write each block new.
   * @param options - How to write the document.
   */
  serialize(doc: Node, source?: MarkdownSource, options: SerializeOptions = {}): string {
    this.context = { references: source?.references ?? new Set() };
    const parts: { text: string; index?: number; block: Node }[] = [];
    doc.forEach((block) => {
      const original = options.verbatim === false ? undefined : source?.blocks.get(block);
      if (original) {
        parts.push({ text: original.text, index: original.index, block });
        return;
      }
      const text = this.blockText(doc, block);
      // An empty paragraph, which the editor holds in an empty document, writes no text.
      if (text !== '' || block.type.name !== 'paragraph') {
        parts.push({ text, block });
      }
    });
    // The comment of the widths of the columns stands on the line right before its table (docs/editor.md, R-EDIT-010).
    const gapBefore = (position: number): string =>
      parts[position].block.type.spec.tableRole === 'table' &&
      parts[position - 1].block.type.name === 'htmlBlock' &&
      widthsPattern.test(parts[position - 1].text.trim())
        ? '\n'
        : '\n\n';
    let out: string;
    if (!source) {
      out = parts.length > 0 ? `${parts.map((part, position) => (position > 0 ? gapBefore(position) : '') + part.text).join('')}\n` : '';
      return out;
    }
    if (parts.length === 0) {
      out = source.count === 0 && doc.childCount <= 1 ? source.text : '';
    } else {
      out = parts[0].index === 0 ? source.before : '';
      parts.forEach((part, position) => {
        if (position > 0) {
          const previous = parts[position - 1];
          const adjacent = previous.index !== undefined && part.index === previous.index + 1;
          out += adjacent ? source.gaps[previous.index as number] : gapBefore(position);
        }
        out += part.text;
      });
      const last = parts[parts.length - 1];
      out += last.index === source.count - 1 ? source.after : source.text.endsWith('\n') || source.text === '' ? '\n' : '';
    }
    return `${source.bom ? '﻿' : ''}${source.lineBreak === '\r\n' ? out.replace(/\n/g, '\r\n') : out}`;
  }
}
