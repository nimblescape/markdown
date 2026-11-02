// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The output of the renderer (docs/rendering.md, R-REN-001): the parts of the format that the editor shows without
// plugins show in the rendering in the same way (docs/specification.md, R-GEN-010), and the HTML is the HTML that
// GitHub writes where GitHub has one, so that a layout can draw it:
//
// - A block quote whose first line is the marker of a GitHub alert, such as `> [!NOTE]`, becomes the element of an
//   alert as GitHub writes it: `<div class="markdown-alert markdown-alert-note">` with the title
//   `<p class="markdown-alert-title">Note</p>` and the text of the quote after the marker (docs/editor.md, R-EDIT-003).
// - The comment of the color at the start of a cell of a table, `<!--cell red-->`, becomes `data-color="red"` of the
//   cell; the comment of the widths of the columns on the line right before a table, `<!-- table: widths=30,70 -->`,
//   gives the columns of the table their widths (R-EDIT-010).
// - Each heading gets the ID that GitHub gives it, so that links to a heading work: the text of the heading in small
//   letters, without punctuation, with a hyphen for each space; a second heading with the same ID gets `-1`, a third
//   `-2`.
// - Each block names its line in the file, `data-line`, counted from 0, as in the Markdown preview of VS Code, so that
//   a view can go from a block to its line.
//
// These changes work on the tokens of one rendering, after the parse: the editor reads the text with the same
// markdown-it, and its tokens stay as markdown-it writes them.

import Token from 'markdown-it/lib/token.mjs';

/** AlertKind is the kind of a GitHub alert. */
export type AlertKind = 'note' | 'tip' | 'important' | 'warning' | 'caution';

/** alertTitles are the titles of the kinds of the GitHub alerts, as GitHub writes them. */
export const alertTitles: Readonly<Record<AlertKind, string>> = { note: 'Note', tip: 'Tip', important: 'Important', warning: 'Warning', caution: 'Caution' };

/** alertMarker matches the marker of a GitHub alert, the first line of the first paragraph of a block quote. */
const alertMarker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;

/** cellColorPattern matches the comment of the color of a cell; the group is the name of the color. */
export const cellColorPattern = /^<!--\s*cell\s+([a-z]+)\s*-->$/;

/** widthsPattern matches the comment of the widths of the columns; the group is the list of the widths in percent. */
export const widthsPattern = /^<!--\s*table:\s*widths=(\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)*)\s*-->$/;

/** alertTitleType and columnsType are the types of the tokens of the title of an alert and of the widths of columns. */
export const alertTitleType = 'nsmd_alert_title';
export const columnsType = 'nsmd_columns';

/**
 * slug returns the ID that GitHub gives a heading with a text: the text in small letters, without the characters that
 * are not letters, marks, digits, connectors, spaces or hyphens, with a hyphen for each space.
 * @param text - The text of the heading.
 */
export const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');

/**
 * headingText returns the text of the inline tokens of a heading as GitHub reads it for the ID of the heading: the text
 * and the code, with the spaces as they are, also the space before an HTML element at the end, and without the text of
 * images.
 * @param tokens - The inline tokens of the heading.
 */
export function headingText(tokens: readonly Token[]): string {
  return tokens.map((token) => (token.type === 'text' || token.type === 'code_inline' ? token.content : token.type === 'softbreak' ? ' ' : '')).join('');
}

/** OutputOptions are the parts of the output that a rendering writes. */
export interface OutputOptions {
  /** headingIds gives each heading its ID; the default is true. */
  readonly headingIds?: boolean;
  /** lines gives each block the attribute `data-line`; the default is true. */
  readonly lines?: boolean;
}

/**
 * placeAlerts turns each block quote whose first line is the marker of a GitHub alert into the element of an alert.
 * @param tokens - The tokens of the text.
 */
function placeAlerts(tokens: Token[]): void {
  for (let index = 0; index < tokens.length; index++) {
    const open = tokens[index];
    const inline = tokens[index + 2];
    if (open.type !== 'blockquote_open' || tokens[index + 1]?.type !== 'paragraph_open' || inline?.type !== 'inline') {
      continue;
    }
    const children = inline.children ?? [];
    const first = children[0];
    const marker = first?.type === 'text' ? alertMarker.exec(first.content) : null;
    const lineBreak = children[1];
    if (!marker || (lineBreak && lineBreak.type !== 'softbreak' && lineBreak.type !== 'hardbreak')) {
      continue;
    }
    const kind = marker[1].toLowerCase() as AlertKind;
    const close = tokens.findIndex((token, at) => at > index && token.type === 'blockquote_close' && token.level === open.level);
    open.type = 'alert_open';
    open.tag = 'div';
    open.attrJoin('class', `markdown-alert markdown-alert-${kind}`);
    tokens[close].type = 'alert_close';
    tokens[close].tag = 'div';
    if (lineBreak) {
      // The marker is the first line of the paragraph: the text after its line break stays.
      inline.children = children.slice(2);
      inline.content = inline.content.slice(inline.content.indexOf('\n') + 1);
      const paragraph = tokens[index + 1];
      if (paragraph.map) {
        paragraph.map = [paragraph.map[0] + 1, paragraph.map[1]];
      }
    } else {
      tokens.splice(index + 1, 3);
    }
    const title = new Token(alertTitleType, 'p', 0);
    title.block = true;
    title.meta = { kind };
    tokens.splice(index + 1, 0, title);
  }
}

/**
 * placeTableComments gives the cells the colors of their comments and the tables the widths of their columns.
 * @param tokens - The tokens of the text.
 */
function placeTableComments(tokens: Token[]): void {
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === 'th_open' || token.type === 'td_open') {
      const children = tokens[index + 1]?.children;
      const color = children?.[0]?.type === 'html_inline' ? cellColorPattern.exec(children[0].content) : null;
      if (children && color) {
        token.attrSet('data-color', color[1]);
        children.shift();
        if (children[0]?.type === 'text') {
          children[0].content = children[0].content.trimStart();
        }
      }
    } else if (token.type === 'html_block' && tokens[index + 1]?.type === 'table_open' && token.map && token.map[1] === tokens[index + 1].map?.[0]) {
      const widths = widthsPattern.exec(token.content.trim());
      if (widths) {
        const table = tokens[index + 1];
        table.attrJoin('class', 'nsmd-table-fixed');
        const columns = new Token(columnsType, 'colgroup', 0);
        columns.block = true;
        columns.meta = { widths: widths[1].split(',').map((width) => Number(width.trim())) };
        tokens.splice(index + 2, 0, columns);
      }
    }
  }
}

/**
 * placeHeadingIds gives each heading the ID that GitHub gives it.
 * @param tokens - The tokens of the text.
 */
function placeHeadingIds(tokens: readonly Token[]): void {
  const ids = new Set<string>();
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index].type !== 'heading_open') {
      continue;
    }
    const base = slug(headingText(tokens[index + 1]?.children ?? []));
    let id = base;
    for (let count = 1; ids.has(id); count++) {
      id = `${base}-${count}`;
    }
    ids.add(id);
    tokens[index].attrSet('id', id);
  }
}

/** selfClosingBlocks are the types of the blocks of one token, which name their line too. */
const selfClosingBlocks = new Set(['fence', 'code_block', 'hr']);

/**
 * placeLines gives each block the line of the file where it starts.
 * @param tokens - The tokens of the text.
 */
function placeLines(tokens: readonly Token[]): void {
  for (const token of tokens) {
    if (token.map && (token.nesting === 1 || selfClosingBlocks.has(token.type))) {
      token.attrSet('data-line', String(token.map[0]));
    }
  }
}

/**
 * prepareOutput changes the tokens of one rendering into the form of the output of the renderer.
 * @param tokens - The tokens of the text, which the function changes.
 * @param options - The parts of the output.
 */
export function prepareOutput(tokens: Token[], options: OutputOptions = {}): void {
  placeAlerts(tokens);
  placeTableComments(tokens);
  if (options.headingIds ?? true) {
    placeHeadingIds(tokens);
  }
  if (options.lines ?? true) {
    placeLines(tokens);
  }
}
