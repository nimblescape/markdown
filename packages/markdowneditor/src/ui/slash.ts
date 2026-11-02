// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The slash commands (docs/editor.md, R-GEN-003): `/` at the start of a line or after a space opens the list of the
// insert menu at the cursor, and the words typed after it filter the list. Choosing an item removes the slash and the
// typed words and inserts the item; Escape, a click elsewhere or a second space closes the list and keeps the text.

import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Menu, MenuItem } from './menu';

/** SlashState is the state of the slash commands: the position of the slash while the list is open. */
interface SlashState {
  from: number | null;
}

/** slashKey is the key of the plugin of the slash commands. */
export const slashKey = new PluginKey<SlashState>('nsmdSlash');

/**
 * slashQuery returns the words after the slash at a position, or null when the cursor is not after it in the same
 * block any more.
 * @param state - The state of the editor.
 * @param from - The position of the slash.
 */
export function slashQuery(state: EditorState, from: number): string | null {
  const { selection } = state;
  if (!selection.empty || selection.from <= from || from >= state.doc.content.size) {
    return null;
  }
  const $from = state.doc.resolve(from);
  if (!$from.sameParent(selection.$from)) {
    return null;
  }
  const text = state.doc.textBetween(from, selection.from, '\n', '\n');
  if (!text.startsWith('/') || text.includes('\n') || /\s\s/.test(text) || text.length > 40) {
    return null;
  }
  return text.slice(1);
}

/**
 * canStart returns true when a slash typed at the cursor starts the slash commands: at the start of a block of text or
 * after a space, outside code.
 * @param state - The state of the editor.
 */
function canStart(state: EditorState): boolean {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock || $from.parent.type.spec.code || $from.marks().some((mark) => mark.type.name === 'code')) {
    return false;
  }
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, '\n', '\n');
  return before === '' || /\s/.test(before);
}

/** SlashHost is what the slash commands need from the editor. */
export interface SlashHost {
  menu: Menu;
  items: () => MenuItem[];
}

/**
 * slashPlugin returns the plugin of the slash commands.
 * @param host - The menu and the items.
 */
export function slashPlugin(host: SlashHost): Plugin<SlashState> {
  let view: EditorView | undefined;
  const close = () => {
    if (view && slashKey.getState(view.state)?.from != null) {
      view.dispatch(view.state.tr.setMeta(slashKey, { from: null }));
    }
  };
  return new Plugin<SlashState>({
    key: slashKey,
    state: {
      init: () => ({ from: null }),
      apply(tr, value, _old, state) {
        const meta = tr.getMeta(slashKey) as SlashState | undefined;
        if (meta) {
          return meta;
        }
        if (value.from === null) {
          return value;
        }
        const from = tr.mapping.map(value.from, -1);
        return slashQuery(state, from) === null ? { from: null } : { from };
      },
    },
    props: {
      handleTextInput(editorView, from, _to, text) {
        if (text !== '/' || !editorView.editable || !canStart(editorView.state)) {
          return false;
        }
        editorView.dispatch(editorView.state.tr.insertText('/', from).setMeta(slashKey, { from }));
        return true;
      },
      handleKeyDown(editorView, event) {
        const state = slashKey.getState(editorView.state);
        if (state?.from == null || !host.menu.isOpen || host.menu.owner !== 'slash') {
          return false;
        }
        if (event.key === 'Escape') {
          close();
          return true;
        }
        return host.menu.keydown(event);
      },
    },
    view(editorView) {
      view = editorView;
      return {
        update(updated) {
          const from = slashKey.getState(updated.state)?.from ?? null;
          if (from === null) {
            if (host.menu.isOpen && host.menu.owner === 'slash') {
              host.menu.close();
            }
            return;
          }
          const query = slashQuery(updated.state, from) ?? '';
          if (!host.menu.isOpen || host.menu.owner !== 'slash') {
            const items = host.items().map((item) => ({
              ...item,
              run: () => {
                const current = slashKey.getState(updated.state)?.from ?? from;
                const end = updated.state.selection.from;
                updated.dispatch(updated.state.tr.delete(current, end).setMeta(slashKey, { from: null }));
                item.run();
              },
            }));
            let coords: { left: number; bottom: number };
            try {
              coords = updated.coordsAtPos(from);
            } catch {
              coords = { left: 0, bottom: 0 };
            }
            host.menu.open(items, coords.left, coords.bottom + 4, close, 'slash');
          }
          host.menu.filter(query);
        },
        destroy() {
          view = undefined;
        },
      };
    },
  });
}
