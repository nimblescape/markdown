// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The items of the menus of the editor (docs/editor.md, R-GEN-003, R-EDIT-007): the blocks that the insert menu "+"
// and the slash commands insert, the text styles and the lists of the format bar. Each item is a command of the
// engine, so each one is one step of undo (R-EDIT-001).

import type { Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { alertTitles, type AlertKind } from '@nimblescape/markdownrender';
import type { MenuItem } from './menu';

/** AlertKind is a kind of GitHub alert, `> [!NOTE]`. */
export type { AlertKind };

/** alertKinds are the kinds of GitHub alerts with their names, as the renderer writes them. */
export const alertKinds = alertTitles;

/**
 * nextFootnoteLabel returns a label for a new footnote: one more than the highest number among the labels of the
 * document.
 * @param doc - The document.
 */
export function nextFootnoteLabel(doc: Node): string {
  let highest = 0;
  doc.descendants((node) => {
    if (node.type.name === 'footnoteReference' || node.type.name === 'footnoteDefinition') {
      const number = Number(node.attrs.label);
      if (Number.isInteger(number)) {
        highest = Math.max(highest, number);
      }
    }
    return true;
  });
  return String(highest + 1);
}

/**
 * insertFootnote inserts a reference of a new footnote at the selection and its definition at the end of the
 * document, and puts the cursor into the definition.
 * @param editor - The Tiptap editor.
 */
export function insertFootnote(editor: Editor): boolean {
  const { schema, doc } = editor.state;
  const reference = schema.nodes.footnoteReference;
  const definition = schema.nodes.footnoteDefinition;
  if (!reference || !definition) {
    return false;
  }
  const label = nextFootnoteLabel(doc);
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.replaceSelectionWith(reference.create({ label }), false);
      const end = tr.doc.content.size;
      tr.insert(end, definition.create({ label }, schema.nodes.paragraph.create()));
      // The text of the definition starts after the open tags of the definition and of its paragraph.
      tr.setSelection(TextSelection.create(tr.doc, end + 2));
      tr.scrollIntoView();
      return true;
    })
    .run();
}

/**
 * insertAlert inserts a GitHub alert, a block quote whose first line is `[!NOTE]`, and puts the cursor after the
 * marker.
 * @param editor - The Tiptap editor.
 * @param kind - The kind of the alert.
 */
export function insertAlert(editor: Editor, kind: AlertKind): boolean {
  const marker = `[!${kind.toUpperCase()}] `;
  return editor
    .chain()
    .focus()
    .insertContent({ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: marker }] }] })
    .run();
}

/** Ask is how an item asks the user for a text, for example the address of an image. */
export type Ask = (label: string, value?: string) => Promise<string | undefined>;

/**
 * insertItems returns the items of the insert menu "+" and of the slash commands.
 * @param editor - The Tiptap editor.
 * @param ask - How to ask the user for a text.
 */
export function insertItems(editor: Editor, ask: Ask): MenuItem[] {
  const chain = () => editor.chain().focus();
  const items: MenuItem[] = [
    { id: 'paragraph', label: 'Text', keywords: ['paragraph', 'plain'], icon: 'paragraph', run: () => chain().setParagraph().run() },
    ...[1, 2, 3, 4, 5, 6].map((level) => ({
      id: `heading${level}`,
      label: `Heading ${level}`,
      keywords: ['title', `h${level}`],
      icon: 'heading' as const,
      hint: '#'.repeat(level),
      run: () => chain().setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run(),
    })),
    { id: 'bulletList', label: 'Bulleted list', keywords: ['unordered', 'ul'], icon: 'bulletList', hint: '-', run: () => chain().toggleBulletList().run() },
    { id: 'orderedList', label: 'Numbered list', keywords: ['ordered', 'ol'], icon: 'orderedList', hint: '1.', run: () => chain().toggleOrderedList().run() },
    { id: 'taskList', label: 'Task list', keywords: ['todo', 'checkbox', 'check'], icon: 'taskList', hint: '- [ ]', run: () => chain().toggleTaskList().run() },
    { id: 'blockquote', label: 'Quote', keywords: ['blockquote'], icon: 'quote', hint: '>', run: () => chain().toggleBlockquote().run() },
    { id: 'codeBlock', label: 'Code block', keywords: ['fence', 'pre'], icon: 'codeBlock', hint: '```', run: () => chain().setCodeBlock().run() },
    {
      id: 'table',
      label: 'Table',
      keywords: ['grid'],
      icon: 'table',
      hint: '| |',
      run: () => chain().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(),
    },
    { id: 'horizontalRule', label: 'Divider', keywords: ['rule', 'hr', 'line', 'separator'], icon: 'rule', hint: '---', run: () => chain().setHorizontalRule().run() },
    {
      id: 'image',
      label: 'Image',
      keywords: ['picture', 'img'],
      icon: 'image',
      hint: '![]()',
      run: () => {
        void ask('Address of the image').then((src) => {
          if (src) {
            chain().setImage({ src }).run();
          } else {
            editor.commands.focus();
          }
        });
      },
    },
    ...(Object.entries(alertKinds) as [AlertKind, string][]).map(([kind, name]) => ({
      id: `alert-${kind}`,
      label: name,
      keywords: ['alert', 'callout', 'admonition'],
      icon: 'alert' as const,
      hint: `[!${kind.toUpperCase()}]`,
      run: () => insertAlert(editor, kind),
    })),
  ];
  if (editor.schema.nodes.footnoteReference) {
    items.push({ id: 'footnote', label: 'Footnote', keywords: ['note', 'reference'], icon: 'footnote', hint: '[^1]', run: () => insertFootnote(editor) });
  }
  return items;
}

/**
 * textStyleItems returns the text styles of the format bar (R-EDIT-007): paragraph, heading 1 to 6, quote and code
 * block, with the style of the selection active.
 * @param editor - The Tiptap editor.
 */
export function textStyleItems(editor: Editor): MenuItem[] {
  const chain = () => editor.chain().focus();
  const inQuote = editor.isActive('blockquote');
  return [
    { id: 'paragraph', label: 'Text', icon: 'paragraph', active: editor.isActive('paragraph') && !inQuote, run: () => chain().setParagraph().run() },
    ...[1, 2, 3, 4, 5, 6].map((level) => ({
      id: `heading${level}`,
      label: `Heading ${level}`,
      icon: 'heading' as const,
      hint: '#'.repeat(level),
      active: editor.isActive('heading', { level }),
      run: () => chain().setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run(),
    })),
    { id: 'blockquote', label: 'Quote', icon: 'quote', hint: '>', active: inQuote, run: () => chain().toggleBlockquote().run() },
    { id: 'codeBlock', label: 'Code block', icon: 'codeBlock', hint: '```', active: editor.isActive('codeBlock'), run: () => chain().toggleCodeBlock().run() },
  ];
}

/**
 * textStyleName returns the name of the text style of the selection, for the button of the format bar.
 * @param editor - The Tiptap editor.
 */
export function textStyleName(editor: Editor): string {
  return textStyleItems(editor).find((item) => item.active)?.label ?? 'Text';
}

/**
 * listItems returns the lists of the format bar: bulleted, numbered and task list.
 * @param editor - The Tiptap editor.
 */
export function listItems(editor: Editor): MenuItem[] {
  const chain = () => editor.chain().focus();
  return [
    { id: 'bulletList', label: 'Bulleted list', icon: 'bulletList', hint: '-', active: editor.isActive('bulletList'), run: () => chain().toggleBulletList().run() },
    { id: 'orderedList', label: 'Numbered list', icon: 'orderedList', hint: '1.', active: editor.isActive('orderedList'), run: () => chain().toggleOrderedList().run() },
    { id: 'taskList', label: 'Task list', icon: 'taskList', hint: '- [ ]', active: editor.isActive('taskList'), run: () => chain().toggleTaskList().run() },
  ];
}
