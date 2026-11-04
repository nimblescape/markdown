// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The values of the front matter in the text (docs/editor.md, R-FM-007), a plugin that every editor has: the text can
// hold the value of a key of the front matter between two hidden markers, for example
// `<wbr><!--{title}-->A paper<!--{/title}-->`.
//
// - The markers are hidden nodes in the line, which keep their text byte for byte. A start marker and an end marker
//   count only as a pair of the same key in the same line, with no other start marker between them, as a formatter reads
//   them; other markers stay inline HTML.
// - The value with its markers is a generated part (R-EDIT-011) when the front matter has the key: the user changes the
//   value in the form of the front matter, and a formatter, for example the one of Notes, writes the current value
//   between the markers. Ctrl+click (Cmd+click on macOS) on the value goes to its input in the form.
// - Backspace and Delete jump over a marker next to the cursor, so that the key deletes the character beyond it; at the
//   edge of a generated part, the key deletes the whole part.
//
// In the output of the renderer, the markers have no output, as on GitHub.

import { Extension, Node, type Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type MarkdownIt from 'markdown-it';
import type { StateCore, Token } from 'markdown-it';
import { frontMatterValues, valueKeyPattern, type FrontMatterFormat } from '@nimblescape/markdowntext';
import type { GeneratedPart, MarkdownPlugin, PluginEditor } from './api';
import { generatedPartsOf } from './generated';

/** valuesPluginName is the name of the plugin. */
export const valuesPluginName = 'frontMatterValues';

/** valueTokenType is the type of the token of a marker of a value. */
export const valueTokenType = 'front_matter_value';

/** valueNodeName is the name of the node of a marker of a value. */
export const valueNodeName = 'frontMatterValue';

/** valueOpen and valueClose match the start marker and the end marker of a value, with its key. */
const valueOpen = new RegExp(String.raw`^<!--\{(${valueKeyPattern})\}-->$`);
const valueClose = new RegExp(String.raw`^<!--\{/(${valueKeyPattern})\}-->$`);

/** isHtml returns true for a token of inline HTML whose text is a text or matches a pattern. */
const isHtml = (token: Token | undefined, test: RegExp | string): boolean =>
  token?.type === 'html_inline' && (typeof test === 'string' ? token.content === test : test.test(token.content));

/**
 * closeOf returns the index of the end marker of a value after its start marker, in the same line, or -1 when another
 * start marker, another end marker or the end of the line comes first.
 * @param children - The tokens of the line.
 * @param from - The index after the start marker.
 * @param key - The key of the start marker.
 */
function closeOf(children: readonly Token[], from: number, key: string): number {
  for (let index = from; index < children.length; index++) {
    const child = children[index];
    if (child.type === 'softbreak' || child.type === 'hardbreak' || isHtml(child, valueOpen)) {
      return -1;
    }
    const close = child.type === 'html_inline' ? valueClose.exec(child.content) : null;
    if (close) {
      return close[1] === key ? index : -1;
    }
  }
  return -1;
}

/**
 * markersOf makes one token of each marker of a value, the start marker with the `<wbr>` before it, among the tokens of
 * a line.
 * @param state - The state of the core rule.
 * @param children - The tokens of the line.
 */
function markersOf(state: StateCore, children: readonly Token[]): Token[] {
  const merged: Token[] = [];
  const closes = new Set<number>();
  const marker = (content: string, key: string, edge: 'open' | 'close'): Token => {
    const token = new state.Token(valueTokenType, '', 0);
    token.content = content;
    token.meta = { key, edge };
    return token;
  };
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (child.type !== 'html_inline') {
      merged.push(child);
      continue;
    }
    const wbr = child.content === '<wbr>' && isHtml(children[index + 1], valueOpen) ? 1 : 0;
    const open = valueOpen.exec(children[index + wbr].content);
    const close = open ? closeOf(children, index + wbr + 1, open[1]) : -1;
    if (open && close > 0) {
      merged.push(marker((wbr ? child.content : '') + children[index + wbr].content, open[1], 'open'));
      closes.add(close);
      index += wbr;
    } else if (closes.has(index)) {
      merged.push(marker(child.content, valueClose.exec(child.content)![1], 'close'));
    } else {
      merged.push(child);
    }
  }
  return merged;
}

/**
 * valuesRule is the core rule that makes one token of each marker of a value in the lines. It runs after the inline
 * rules.
 * @param state - The state of the core rule.
 */
function valuesRule(state: StateCore): void {
  for (const token of state.tokens) {
    if (token.type === 'inline' && token.children && token.content.includes('<!--{')) {
      token.children = markersOf(state, token.children);
    }
  }
}

/**
 * extendMarkdownIt adds the rule of the plugin to a markdown-it; in the output of the renderer, the markers have none.
 * @param md - The markdown-it.
 */
function extendMarkdownIt(md: MarkdownIt): MarkdownIt {
  md.core.ruler.after('inline', 'front_matter_values', valuesRule);
  md.renderer.rules[valueTokenType] = () => '';
  return md;
}

/** ValueMarker is the start marker or the end marker of a value of the front matter in the line: hidden, with its text. */
const ValueMarker = Node.create({
  name: valueNodeName,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes: () => ({ key: { default: '', rendered: false }, edge: { default: 'open', rendered: false }, text: { default: '', rendered: false } }),
  parseHTML: () => [],
  renderHTML: ({ node }) => ['span', { class: 'nsmd-value-marker', 'data-key': node.attrs.key as string, 'data-edge': node.attrs.edge as string }],
  renderText: () => '',
});

/** editors are the editors with the plugin, for Ctrl+click on a value. */
const editors = new Set<PluginEditor>();

/**
 * focusValue gives the focus to the input of a key in the form of the front matter of the editor of a document, or to
 * the form when it has no input of the key.
 * @param doc - The document.
 * @param key - The key, for example `author.name`.
 */
function focusValue(doc: PmNode, key: string): void {
  const editor = [...editors].find((candidate) => candidate.tiptap.state.doc === doc);
  const form = editor?.tiptap.view.dom.querySelector<HTMLElement>('.nsmd-fm');
  if (!form) {
    return;
  }
  const path = key.split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  const focus = `value ${JSON.stringify(path)}`;
  const input = [...form.querySelectorAll<HTMLElement>('[data-focus]')].find((candidate) => candidate.dataset.focus === focus);
  form.scrollIntoView({ block: 'nearest' });
  (input ?? form.querySelector<HTMLElement>('input, select, textarea, button'))?.focus();
}

/** valuesCache keeps the values of the front matter of each document. */
const valuesCache = new WeakMap<PmNode, Map<string, string>>();

/**
 * valuesOf returns the values of the front matter of a document (R-FM-007), or none when its first block is no front
 * matter.
 * @param doc - The document.
 */
function valuesOf(doc: PmNode): Map<string, string> {
  let values = valuesCache.get(doc);
  if (!values) {
    const first = doc.firstChild;
    values = first?.type.name === 'frontMatter' ? frontMatterValues(first.attrs.text as string, first.attrs.format as FrontMatterFormat) : new Map<string, string>();
    valuesCache.set(doc, values);
  }
  return values;
}

/** partsCache keeps the generated parts of each document. */
const partsCache = new WeakMap<PmNode, GeneratedPart[]>();

/**
 * valueParts returns the values with their markers in a document whose keys the front matter has: the generated parts
 * of the plugin.
 * @param doc - The document.
 */
export function valueParts(doc: PmNode): GeneratedPart[] {
  const cached = partsCache.get(doc);
  if (cached) {
    return cached;
  }
  const parts: GeneratedPart[] = [];
  const values = valuesOf(doc);
  doc.descendants((node, pos) => {
    if (!node.isTextblock) {
      return true;
    }
    if (values.size === 0 || node.type.name === 'codeBlock') {
      return false;
    }
    let start: PmNode | undefined;
    let startPos = 0;
    node.forEach((child, offset) => {
      if (child.type.name !== valueNodeName) {
        return;
      }
      const at = pos + 1 + offset;
      const key = child.attrs.key as string;
      if (child.attrs.edge === 'close' && start?.attrs.key === key && values.has(key)) {
        parts.push({ from: startPos, to: at + 1, open: () => focusValue(doc, key) });
      }
      start = child.attrs.edge === 'open' ? child : undefined;
      startPos = at;
    });
    return false;
  });
  partsCache.set(doc, parts);
  return parts;
}

/** isMarker returns true for a marker of a value. */
const isMarker = (node: PmNode | null | undefined): boolean => node?.type.name === valueNodeName;

/**
 * jumpOverMarkers returns the command that moves the cursor over the markers next to it, before Backspace (backward) or
 * Delete (forward) deletes a character, so that the key deletes the character beyond them. At the edge of a generated
 * part, the cursor stays, so that the key deletes the whole part. The command moves the cursor and leaves the key to the
 * next command.
 * @param direction - -1 for Backspace, 1 for Delete.
 */
function jumpOverMarkers(direction: -1 | 1) {
  return ({ editor }: { editor: Editor }): boolean => {
    const { state, view } = editor;
    const { empty, from } = state.selection;
    const next = (pos: number) => (direction < 0 ? state.doc.resolve(pos).nodeBefore : state.doc.resolve(pos).nodeAfter);
    if (!empty || !isMarker(next(from))) {
      return false;
    }
    const parts = generatedPartsOf(state);
    const atPart = (pos: number) => parts.some((part) => (direction < 0 ? part.to === pos : part.from === pos));
    let at = from;
    while (isMarker(next(at)) && !atPart(at)) {
      at += direction;
    }
    if (at !== from) {
      view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, at)));
    }
    return false;
  };
}

/** MarkerKeys are the keys that jump over the markers. */
const MarkerKeys = Extension.create({
  name: 'frontMatterValueKeys',
  priority: 1000,
  addKeyboardShortcuts: () => ({
    Backspace: (props) => jumpOverMarkers(-1)(props),
    Delete: (props) => jumpOverMarkers(1)(props),
  }),
});

/**
 * frontMatterValuesPlugin is the plugin of the values of the front matter in the text (R-FM-007), which every editor has
 * before the plugins of the integrating code.
 */
export const frontMatterValuesPlugin: MarkdownPlugin = {
  name: valuesPluginName,
  apiVersion: 1,
  extendMarkdownIt,
  styles: '.nsmd-value-marker { display: none; }',
  nodes: [ValueMarker, MarkerKeys],
  fromMarkdown: {
    [valueTokenType]: {
      node: valueNodeName,
      getAttrs: (token) => {
        const meta = token.meta as { key: string; edge: string };
        return { key: meta.key, edge: meta.edge, text: token.content };
      },
    },
  },
  toMarkdown: {
    nodes: {
      [valueNodeName]: (state, node) => {
        state.text(node.attrs.text as string, false);
      },
    },
  },
  generated: valueParts,
  activate: (editor) => {
    editors.add(editor);
    return () => editors.delete(editor);
  },
};
