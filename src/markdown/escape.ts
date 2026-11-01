// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The escaping of text in a changed block (docs/specification.md, R-GEN-006): a backslash goes only before the
// characters that would otherwise start Markdown syntax, so that the text of a block that the user changes stays as
// readable as the text of the file. prosemirror-markdown escapes `[` and `]` everywhere, which breaks the GitHub alerts
// `> [!NOTE]` of the templates of Paper, so the serializer uses this function.

/** asciiPunctuation holds the characters that a backslash can escape in CommonMark. */
const asciiPunctuation = /[!-/:-@[-`{-~]/;

/** wordCharacter is a letter or a digit of any script. */
const wordCharacter = /[\p{L}\p{N}]/u;

/** entity is a character reference such as `&amp;`, `&#35;` or `&#x23;`. */
const entity = /^&(?:#\d{1,7}|#[xX][\da-fA-F]{1,6}|[A-Za-z][A-Za-z\d]{1,31});/;

/** EscapeContext tells the escaping where the text stands. */
export interface EscapeContext {
  /** atLineStart is true when the text starts a line of the Markdown text, for example as the start of a paragraph. */
  atLineStart: boolean;
  /** inLink is true for the text of a link, where a bracket would end or break the link. */
  inLink?: boolean;
  /** references holds the normalized labels of the link reference definitions of the file. */
  references: ReadonlySet<string>;
  /** normalize returns the normalized form of a label of a link reference, as markdown-it compares them. */
  normalize: (label: string) => string;
}

/**
 * opensLink returns true when the `[` at a position of a text could start a link, an image, a footnote reference or a
 * reference definition: a `^` follows it, or a `]` follows it that is followed by `(`, `[` or `:`, or the text up to
 * the next `]` is the label of a link reference of the file, or no `]` follows it in this text.
 */
function opensLink(text: string, position: number, context: EscapeContext): boolean {
  if (text[position + 1] === '^') {
    return true;
  }
  const close = text.indexOf(']', position + 1);
  if (close < 0) {
    // The closing bracket can be in the next text node, after a mark.
    return true;
  }
  const after = text[close + 1];
  if (after === '(' || after === '[' || after === ':') {
    return true;
  }
  return context.references.has(context.normalize(text.slice(position + 1, close)));
}

/**
 * escapeLineStart returns the escaped start of a line: a backslash before a character that would start a heading, a
 * block quote, a list item, a thematic break or a fence at the start of the line.
 */
function escapeLineStart(text: string): { prefix: string; rest: number } {
  const ordered = /^(\d{1,9})([.)])(?=[ \t]|$)/.exec(text);
  if (ordered) {
    return { prefix: `${ordered[1]}\\${ordered[2]}`, rest: ordered[0].length };
  }
  if (/^#{1,6}(?=[ \t]|$)/.test(text) || /^[>]/.test(text)) {
    return { prefix: `\\${text[0]}`, rest: 1 };
  }
  if (/^[-+](?=[ \t]|$)/.test(text) || /^[-=]+[ \t]*$/.test(text)) {
    return { prefix: `\\${text[0]}`, rest: 1 };
  }
  return { prefix: '', rest: 0 };
}

/**
 * escapeText returns a text of the document as Markdown text: the same text, with a backslash before each character
 * that would otherwise start Markdown syntax where it stands.
 * @param text - The text, without line breaks.
 * @param context - Where the text stands.
 */
export function escapeText(text: string, context: EscapeContext): string {
  let out = '';
  let start = 0;
  if (context.atLineStart) {
    // Spaces and tabs at the start of a line would be dropped, or make an indented code block.
    const indent = /^[ \t]*/.exec(text)?.[0] ?? '';
    out = indent.replace(/ /g, '&#32;').replace(/\t/g, '&#9;');
    const { prefix, rest } = escapeLineStart(text.slice(indent.length));
    out += prefix;
    start = indent.length + rest;
  }
  for (let index = start; index < text.length; index++) {
    const character = text[index];
    const previous = text[index - 1];
    const next = text[index + 1];
    switch (character) {
      case '\\':
        // A backslash before punctuation, or at the end of the text, where a mark or another node can follow.
        out += next === undefined || asciiPunctuation.test(next) ? '\\\\' : '\\';
        break;
      case '`':
      case '*':
        out += `\\${character}`;
        break;
      case '_':
        // An underscore inside a word starts no emphasis.
        out += previous !== undefined && next !== undefined && wordCharacter.test(previous) && wordCharacter.test(next) ? '_' : '\\_';
        break;
      case '~':
        // Strikethrough needs two tildes; a tilde at the end of the text can meet one of the next node.
        out += previous === '~' || next === '~' || next === undefined || previous === undefined ? '\\~' : '~';
        break;
      case '[':
        out += context.inLink || opensLink(text, index, context) ? '\\[' : '[';
        break;
      case ']':
        out += context.inLink ? '\\]' : ']';
        break;
      case '\n':
        // A line break in a text, which only a character reference can give, would end the paragraph.
        out += '&#10;';
        break;
      case '<':
        out += next !== undefined && /[A-Za-z/!?]/.test(next) ? '\\<' : '<';
        break;
      case '&':
        out += entity.test(text.slice(index)) ? '\\&' : '&';
        break;
      default:
        out += character;
    }
  }
  return out;
}
