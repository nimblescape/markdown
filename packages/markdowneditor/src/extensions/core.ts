// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The Tiptap extensions of the document of the editor (docs/editor.md, R-EDIT-003; docs/specification.md, R-GEN-011):
// the nodes and marks of CommonMark and GFM from the extensions of Tiptap, footnotes, the front matter, and raw nodes
// for HTML and for text that no block of Markdown holds. Code blocks get the syntax colors of highlight.js through
// lowlight. Attributes that only record the form of the Markdown text,
// such as the character of a bullet, let the serializer write a changed block in the form that it had; the editor does
// not render them.

import { type AnyExtension, Node, mergeAttributes } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Code from '@tiptap/extension-code';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import Strike from '@tiptap/extension-strike';
import Underline from '@tiptap/extension-underline';
import { BulletList, ListItem, ListKeymap, OrderedList, TaskItem, TaskList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { isHistoryTransaction } from '@tiptap/pm/history';
import type { Fragment, Node as PmNode } from '@tiptap/pm/model';
import { Plugin, type EditorState, type Transaction } from '@tiptap/pm/state';
import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';

/**
 * syntax gives the syntax colors of code blocks (R-EDIT-003): the common languages of highlight.js, through lowlight. A
 * code block without a language that it knows keeps its text without colors, as on GitHub: its highlightAuto returns
 * the text alone, because the extension of Tiptap would otherwise guess the language of each such block.
 */
const lowlight = createLowlight(common);
const syntax = { ...lowlight, highlightAuto: (value: string) => ({ type: 'root', children: [{ type: 'text', value }] }) };

/** Alignment is the alignment of a column of a GFM table, from its delimiter row. */
export type Alignment = 'left' | 'center' | 'right' | null;

/** formAttribute returns an attribute that records the form of the Markdown text and that the editor does not render. */
const formAttribute = <T>(value: T) => ({ default: value, rendered: false });

/** tightAttribute is the attribute of a list without blank lines between its items, which the CSS shows closer. */
const tightAttribute = {
  default: true,
  parseHTML: (element: HTMLElement) => element.hasAttribute('data-tight'),
  renderHTML: (attributes: Record<string, unknown>) => (attributes.tight ? { 'data-tight': 'true' } : {}),
};

/** alignAttribute is the alignment of the column of a cell, which the cell shows as the alignment of its text. */
const alignAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.style.textAlign || null,
  renderHTML: (attributes: Record<string, unknown>) => (attributes.align ? { style: `text-align: ${attributes.align as string}` } : {}),
};

/**
 * backgroundAttribute is the color of a cell of a table, which the comment `<!--cell red-->` at the start of the cell
 * records (docs/editor.md, R-EDIT-010) and the cell shows as `data-color`.
 */
const backgroundAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute('data-color'),
  renderHTML: (attributes: Record<string, unknown>) => (attributes.background ? { 'data-color': attributes.background as string } : {}),
};

/** rawView returns the DOM of a raw text: its text in a block or a span that plugins can replace with their own view. */
const rawView = (kind: string, text: string, inline = false): [string, Record<string, string>, string] => [
  inline ? 'span' : 'pre',
  { class: `nsmd-raw nsmd-raw-${kind}`, 'data-raw': kind },
  text,
];

/** frontMatterRemoval is the meta of a transaction that removes the front matter on purpose. */
export const frontMatterRemoval = 'nsmdFrontMatterRemoval';

/** isFrontMatter returns true for the node of a front matter. */
const isFrontMatter = (node: PmNode | null | undefined): boolean => node?.type.name === 'frontMatter';

/** holdsFrontMatter returns true when a fragment holds a front matter. */
function holdsFrontMatter(fragment: Fragment): boolean {
  let found = false;
  fragment.descendants((node) => {
    found ||= isFrontMatter(node);
    return !found && !node.isTextblock;
  });
  return found;
}

/** onlyFirst returns true when a document holds a front matter only as its first block. */
function onlyFirst(doc: PmNode): boolean {
  let placed = true;
  doc.descendants((node, pos) => {
    if (isFrontMatter(node) && pos !== 0) {
      placed = false;
    }
    return placed && !node.isTextblock;
  });
  return placed;
}

/** replacesAll returns true when a transaction replaces the whole document, for a new text or for select all. */
const replacesAll = (tr: Transaction): boolean =>
  tr.steps.some((step, index) => step instanceof ReplaceStep && step.from === 0 && step.to === tr.docs[index].content.size);

/**
 * keepsFrontMatter returns false for a transaction that moves the front matter from the start of the document, puts
 * one at another place, or removes it by chance, for example with Backspace at the start of the first block. A new
 * text, select all, undo and a transaction with the meta frontMatterRemoval may remove it.
 */
function keepsFrontMatter(tr: Transaction, state: EditorState): boolean {
  if (!tr.docChanged) {
    return true;
  }
  const inserted = tr.steps.some((step) => (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) && holdsFrontMatter(step.slice.content));
  if (inserted && !onlyFirst(tr.doc)) {
    return false;
  }
  if (isFrontMatter(state.doc.firstChild) && !isFrontMatter(tr.doc.firstChild)) {
    let moved = false;
    tr.doc.forEach((node) => (moved ||= isFrontMatter(node)));
    return !moved && (isHistoryTransaction(tr) || replacesAll(tr) || tr.getMeta(frontMatterRemoval) === true);
  }
  return true;
}

/**
 * FrontMatter is the front matter at the start of a file, with its fences (R-SRC-003). It stays the first block of the
 * document, and the cursor does not select it: the form of the front matter has its own inputs (R-FM-001).
 */
export const FrontMatter = Node.create({
  name: 'frontMatter',
  group: 'block',
  atom: true,
  selectable: false,
  addAttributes: () => ({ format: { default: 'yaml', rendered: false }, text: { default: '', rendered: false } }),
  parseHTML: () => [],
  renderHTML: ({ node }) => rawView('front-matter', node.attrs.text as string),
  addProseMirrorPlugins: () => [new Plugin({ filterTransaction: keepsFrontMatter })],
});

/** HtmlBlock is a block of HTML, for example a comment on lines of its own. Plugins show the comments that they know. */
export const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes: () => ({ html: { default: '', rendered: false } }),
  parseHTML: () => [],
  renderHTML: ({ node }) => rawView('html', node.attrs.html as string),
});

/**
 * RawBlock is text between blocks that no block of Markdown holds, for example the definitions of link references, or a
 * block that the editor keeps as one unit: a block with tokens that no node takes, or that a plugin of the level
 * "render" shows (docs/plugins.md, R-GEN-012). `rendered` is true for such a block, whose view shows its rendering.
 */
export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes: () => ({ text: { default: '', rendered: false }, rendered: { default: false, rendered: false } }),
  parseHTML: () => [],
  renderHTML: ({ node }) => rawView('text', node.attrs.text as string),
});

/** FootnoteDefinition is the definition of a footnote, `[^label]: text`, with the blocks of its text. */
export const FootnoteDefinition = Node.create({
  name: 'footnoteDefinition',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes: () => ({
    label: { default: '', parseHTML: (element) => element.getAttribute('data-label') ?? '', renderHTML: (attributes) => ({ 'data-label': attributes.label as string }) },
  }),
  parseHTML: () => [{ tag: 'div.nsmd-footnote' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { class: 'nsmd-footnote' }), 0],
});

/** HtmlInline is inline HTML, for example `<wbr>` or a comment such as the markers of the notes. */
export const HtmlInline = Node.create({
  name: 'htmlInline',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({ html: { default: '', rendered: false } }),
  parseHTML: () => [],
  renderHTML: ({ node }) => rawView('html', node.attrs.html as string, true),
});

/** FootnoteReference is the reference of a footnote, `[^label]`. */
export const FootnoteReference = Node.create({
  name: 'footnoteReference',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes: () => ({ label: { default: '', rendered: false } }),
  parseHTML: () => [],
  renderHTML: ({ node }) => ['sup', { class: 'nsmd-footnote-reference', 'data-label': node.attrs.label as string }, node.attrs.label as string],
});

/**
 * coreExtensions returns the Tiptap extensions of the document of the editor: the parts of CommonMark and GFM, the
 * footnotes, the front matter and the raw nodes. The editor and the Markdown parser and serializer use the same list,
 * so the schema of the document is the same everywhere.
 */
export function coreExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      // The file keeps its blocks as they are, so no empty paragraph is added at its end.
      trailingNode: false,
      // Markdown has no underline; the version below writes it as `<ins>text</ins>` (R-EDIT-007).
      underline: false,
      // The extensions below replace these with versions that record the form of the Markdown text, and add the marks
      // in the order in which the serializer nests them, from the outside in: code is the innermost mark.
      bold: false,
      italic: false,
      strike: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
    }),
    Bold.extend({ addAttributes: () => ({ marker: formAttribute('**') }) }),
    Italic.extend({ addAttributes: () => ({ marker: formAttribute('*') }) }),
    Strike,
    Underline.extend({
      parseHTML() {
        return [...(this.parent?.() ?? []), { tag: 'ins' }];
      },
    }),
    CodeBlockLowlight.extend({
      addAttributes() {
        // fence is the fence of a fenced code block, for example ``` or ~~~~, and empty for an indented code block;
        // info is the whole info string of the fence, whose first word is the language.
        return { ...this.parent?.(), fence: formAttribute('```'), info: formAttribute('') };
      },
    }).configure({ lowlight: syntax, defaultLanguage: null }),
    HorizontalRule.extend({ addAttributes: () => ({ markup: formAttribute('---') }) }),
    Link.extend({
      addAttributes() {
        // form is how the file writes the link: `inline` for [text](href), `autolink` for <href>, `bare` for an address
        // in the text that GFM links by itself.
        return { ...this.parent?.(), form: formAttribute('inline') };
      },
    }).configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    // A code span can stand in a link or in emphasis, as in CommonMark; Tiptap's code mark excludes all other marks.
    Code.extend({ excludes: 'code' }),
    Image.configure({ inline: true }),
    BulletList.extend({
      addAttributes() {
        return { ...this.parent?.(), bullet: formAttribute('-'), tight: tightAttribute };
      },
    }),
    OrderedList.extend({
      addAttributes() {
        return { ...this.parent?.(), delimiter: formAttribute('.'), tight: tightAttribute };
      },
    }),
    ListItem,
    TaskList.extend({
      addAttributes() {
        return { ...this.parent?.(), bullet: formAttribute('-'), tight: tightAttribute };
      },
    }),
    TaskItem.configure({ nested: true }),
    ListKeymap,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader.extend({
      addAttributes() {
        return { ...this.parent?.(), align: alignAttribute, background: backgroundAttribute };
      },
    }),
    TableCell.extend({
      addAttributes() {
        return { ...this.parent?.(), align: alignAttribute, background: backgroundAttribute };
      },
    }),
    FrontMatter,
    HtmlBlock,
    RawBlock,
    FootnoteDefinition,
    HtmlInline,
    FootnoteReference,
  ];
}
