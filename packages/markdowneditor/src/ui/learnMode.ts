// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The mode to learn Markdown (docs/editor.md, R-GEN-013): when it is on, the editor shows the Markdown marks beside the
// rendered text, for example `**` around bold text and `#` before a heading. The marks are the marks of the file, from
// the attributes that the parser records, for example `__` for bold text that the file writes with underscores. They
// are widgets of the view, not text of the document: they do not change the document, the cursor jumps over them, and
// copying copies the rendered text. The marks show in a muted color, and in full color in the block of the cursor.

import type { Mark, Node } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

/** MarkText returns the Markdown before and after a run of text with a mark, or undefined for a mark without marks. */
export type MarkText = (mark: Mark, text: string) => { open: string; close: string } | undefined;

/** NodeText returns the Markdown before the content of a node, or undefined for a node without marks. */
export type NodeText = (node: Node) => string | undefined;

/** LearnMarks are the marks that the mode shows for the nodes and marks of extensions (R-GEN-013). */
export interface LearnMarks {
  marks?: Record<string, MarkText>;
  nodes?: Record<string, NodeText>;
}

/** backticks returns a run of backticks one longer than the longest run of backticks in a text. */
function backticks(text: string): string {
  let longest = 0;
  let run = 0;
  for (const character of text) {
    run = character === '`' ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return '`'.repeat(longest + 1);
}

/** markTexts are the marks of the marks of the library. */
const markTexts: Record<string, MarkText> = {
  bold: (mark) => {
    const marker = (mark.attrs.marker as string | undefined) || '**';
    return { open: marker, close: marker };
  },
  italic: (mark) => {
    const marker = (mark.attrs.marker as string | undefined) || '*';
    return { open: marker, close: marker };
  },
  strike: () => ({ open: '~~', close: '~~' }),
  underline: () => ({ open: '<ins>', close: '</ins>' }),
  code: (_mark, text) => {
    const ticks = backticks(text);
    return { open: ticks, close: ticks };
  },
  link: (mark) => {
    const form = mark.attrs.form as string | undefined;
    if (form === 'bare') {
      return undefined;
    }
    if (form === 'autolink') {
      return { open: '<', close: '>' };
    }
    const title = mark.attrs.title ? ` "${mark.attrs.title as string}"` : '';
    return { open: '[', close: `](${mark.attrs.href as string}${title})` };
  },
};

/** LearnState is the state of the mode: on or off, and the widgets of the marks of the document. */
interface LearnState {
  on: boolean;
  marks: DecorationSet;
}

/** learnKey is the key of the plugin of the mode to learn Markdown. */
export const learnKey = new PluginKey<LearnState>('nsmdLearn');

/** widget returns a widget with the text of a mark. */
function widget(pos: number, text: string, side: number, block = false): Decoration {
  return Decoration.widget(
    pos,
    () => {
      const span = document.createElement('span');
      span.className = block ? 'nsmd-learn-mark nsmd-learn-mark-line' : 'nsmd-learn-mark';
      span.textContent = text;
      span.contentEditable = 'false';
      return span;
    },
    { side, ignoreSelection: true, key: `${side}:${block ? 'line' : 'inline'}:${text}` },
  );
}

/** prefixOf returns the marks before the text of a block of text: the quotes and the item of a list around it. */
function prefixOf(doc: Node, pos: number, nodes: Record<string, NodeText>): string {
  const $pos = doc.resolve(pos);
  let prefix = '';
  for (let depth = 1; depth <= $pos.depth; depth++) {
    const node = $pos.node(depth);
    const parent = $pos.node(depth - 1);
    const first = $pos.index(depth) === 0;
    const name = node.type.name;
    if (name === 'blockquote') {
      prefix += '> ';
    } else if ((name === 'listItem' || name === 'taskItem') && first && depth < $pos.depth + 1) {
      const index = $pos.index(depth - 1);
      if (parent.type.name === 'orderedList') {
        const start = (parent.attrs.start as number | null) ?? 1;
        prefix += `${start + index}${(parent.attrs.delimiter as string) || '.'} `;
      } else {
        prefix += `${(parent.attrs.bullet as string) || '-'} `;
      }
      if (name === 'taskItem') {
        prefix += node.attrs.checked ? '[x] ' : '[ ] ';
      }
    } else if (nodes[name]) {
      prefix += nodes[name](node) ?? '';
    }
  }
  return prefix;
}

/**
 * setLearning switches the mode to learn Markdown on or off.
 * @param view - The view of the editor.
 * @param on - true to switch the mode on.
 */
export function setLearning(view: EditorView, on: boolean): void {
  view.dispatch(view.state.tr.setMeta(learnKey, { on }).setMeta('addToHistory', false));
}

/**
 * isLearning returns true while the mode to learn Markdown is on.
 * @param state - The state of the editor.
 */
export function isLearning(state: EditorState): boolean {
  return learnKey.getState(state)?.on ?? false;
}

/**
 * learnDecorations returns the widgets of the marks of a document.
 * @param doc - The document.
 * @param extra - The marks of the nodes and marks of extensions.
 */
export function learnDecorations(doc: Node, extra: LearnMarks = {}): Decoration[] {
  const marks = { ...markTexts, ...extra.marks };
  const nodes = extra.nodes ?? {};
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    const name = node.type.name;
    if (name === 'codeBlock') {
      const fence = (node.attrs.fence as string) || '';
      const info = (node.attrs.info as string) || (node.attrs.language as string | null) || '';
      if (fence) {
        decorations.push(widget(pos + 1, `${fence}${info}`, -1, true), widget(pos + node.nodeSize - 1, fence, 1, true));
      } else {
        decorations.push(widget(pos + 1, '    ', -1));
      }
      return false;
    }
    if (name === 'horizontalRule') {
      decorations.push(widget(pos, (node.attrs.markup as string) || '---', -1, true));
      return false;
    }
    if (!node.isTextblock) {
      return true;
    }
    let prefix = prefixOf(doc, pos + 1, nodes);
    if (name === 'heading') {
      prefix += `${'#'.repeat(node.attrs.level as number)} `;
    }
    if (prefix) {
      decorations.push(widget(pos + 1, prefix, -1000));
    }
    // The open marks before each child, and the close marks after the last child of each run of a mark.
    let previous: readonly Mark[] = [];
    node.forEach((child, offset, index) => {
      const at = pos + 1 + offset;
      const next = index + 1 < node.childCount ? node.child(index + 1).marks : [];
      for (const mark of child.marks) {
        const rank = mark.type.spec.inclusive === false ? 50 : (mark.type as unknown as { rank: number }).rank;
        if (!mark.isInSet(previous)) {
          let runText = '';
          for (let position = index; position < node.childCount && mark.isInSet(node.child(position).marks); position++) {
            runText += node.child(position).text ?? '';
          }
          const text = marks[mark.type.name]?.(mark, runText);
          if (text) {
            decorations.push(widget(at, text.open, rank + 1));
          }
        }
        if (!mark.isInSet(next)) {
          let runText = '';
          for (let position = index; position >= 0 && mark.isInSet(node.child(position).marks); position--) {
            runText = (node.child(position).text ?? '') + runText;
          }
          const text = marks[mark.type.name]?.(mark, runText);
          if (text) {
            decorations.push(widget(at + child.nodeSize, text.close, -rank - 1));
          }
        }
      }
      if (child.type.name === 'image') {
        decorations.push(widget(at, `![${(child.attrs.alt as string | null) ?? ''}](${(child.attrs.src as string) ?? ''})`, -1));
      } else if (child.type.name === 'hardBreak') {
        decorations.push(widget(at, '\\', -1));
      } else if (child.type.name === 'footnoteReference') {
        decorations.push(widget(at, '[^', -1), widget(at + child.nodeSize, ']', 1));
      } else if (nodes[child.type.name]) {
        const text = nodes[child.type.name](child);
        if (text) {
          decorations.push(widget(at, text, -1));
        }
      }
      previous = child.marks;
    });
    return false;
  });
  return decorations;
}

/** currentBlock returns the decoration that marks the top-level block of the cursor. */
function currentBlock(state: EditorState): Decoration | undefined {
  const { $head } = state.selection;
  if ($head.depth < 1) {
    return undefined;
  }
  const pos = $head.before(1);
  return Decoration.node(pos, pos + $head.node(1).nodeSize, { class: 'nsmd-learn-current' });
}

/**
 * learnPlugin returns the plugin of the mode to learn Markdown.
 * @param on - true to start with the mode on, or a function that returns it each time a state starts, for example
 *   after a new text.
 * @param extra - The marks of the nodes and marks of extensions.
 */
export function learnPlugin(on: boolean | (() => boolean), extra: LearnMarks = {}): Plugin<LearnState> {
  return new Plugin<LearnState>({
    key: learnKey,
    state: {
      init: (_config, state) => {
        const start = typeof on === 'function' ? on() : on;
        return { on: start, marks: start ? DecorationSet.create(state.doc, learnDecorations(state.doc, extra)) : DecorationSet.empty };
      },
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(learnKey) as { on: boolean } | undefined;
        const nowOn = meta ? meta.on : value.on;
        if (!nowOn) {
          return value.on ? { on: false, marks: DecorationSet.empty } : value;
        }
        if (meta || tr.docChanged || !value.on) {
          return { on: true, marks: DecorationSet.create(state.doc, learnDecorations(state.doc, extra)) };
        }
        return value;
      },
    },
    props: {
      decorations(state) {
        const value = learnKey.getState(state);
        if (!value?.on) {
          return undefined;
        }
        const current = currentBlock(state);
        return current ? value.marks.add(state.doc, [current]) : value.marks;
      },
      attributes: (state): Record<string, string> => (learnKey.getState(state)?.on ? { class: 'nsmd-learn' } : {}),
    },
  });
}
