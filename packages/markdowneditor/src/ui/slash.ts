// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The slash commands (docs/editor.md, R-GEN-003): `/` at the start of a line or after a space opens the list of the
// insert menu at the cursor, and the words typed after it filter the list. Choosing an item removes the slash and the
// typed words and inserts the item; Escape, a click elsewhere or a second space closes the list and keeps the text.
// The list shows the name of each item as a slash command, for example `/h1`, the same name as in the text editor.
//
// A slash typed on selected text keeps the text, goes after it and opens the list of the commands on selected text,
// for example adding a note, while the text stays marked. Choosing a command removes the slash and the typed words,
// selects the text again and runs the command. Without such commands, the slash replaces the selected text as any
// typed character does.

import { Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import type { Menu, MenuItem } from './menu';

/** SlashState is the state of the slash commands: the position of the slash while the list is open, and the selected text that the commands on selected text get. */
interface SlashState {
  from: number | null;
  selected?: { from: number; to: number } | null;
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

/**
 * canStartOnSelection returns true when a slash typed on selected text starts the commands on selected text: text is
 * selected, outside code, and it ends in a block of text.
 * @param state - The state of the editor.
 */
function canStartOnSelection(state: EditorState): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || selection.empty || state.doc.textBetween(selection.from, selection.to, ' ', ' ').trim() === '') {
    return false;
  }
  const { $to } = selection;
  return $to.parent.isTextblock && !$to.parent.type.spec.code && !$to.marks().some((mark) => mark.type.name === 'code');
}

/**
 * slashSelection returns the selected text that the open list of the slash commands acts on, or undefined without a
 * list on selected text. A plugin uses it to find out whether its commands on selected text apply.
 * @param state - The state of the editor.
 */
export function slashSelection(state: EditorState): { from: number; to: number } | undefined {
  const value = slashKey.getState(state);
  return value?.from != null && value.selected ? value.selected : undefined;
}

/**
 * shownItems returns the items that the slash commands offer: the commands on selected text after a slash typed on
 * selected text, else the other items; each shows its name as a slash command at its right.
 * @param items - The items of the insert menu and of the plugins.
 * @param onSelection - Whether the slash was typed on selected text.
 */
export function shownItems(items: readonly MenuItem[], onSelection: boolean): MenuItem[] {
  return items.filter((item) => (item.selection === true) === onSelection).map((item) => (item.slash ? { ...item, hint: `/${item.slash}` } : item));
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
        if (slashQuery(state, from) === null) {
          return { from: null };
        }
        const selected = value.selected ? { from: tr.mapping.map(value.selected.from, 1), to: tr.mapping.map(value.selected.to, -1) } : null;
        return { from, selected: selected && selected.from < selected.to ? selected : null };
      },
    },
    props: {
      handleTextInput(editorView, from, _to, text) {
        if (text !== '/' || !editorView.editable) {
          return false;
        }
        const { state } = editorView;
        if (canStartOnSelection(state) && host.items().some((item) => item.selection === true)) {
          // The slash goes after the selected text, which stays for the command.
          const { from: start, to: end } = state.selection;
          const tr = state.tr.insertText('/', end);
          tr.setSelection(TextSelection.create(tr.doc, end + 1)).setMeta(slashKey, { from: end, selected: { from: start, to: end } });
          editorView.dispatch(tr);
          return true;
        }
        if (!canStart(state)) {
          return false;
        }
        editorView.dispatch(state.tr.insertText('/', from).setMeta(slashKey, { from, selected: null }));
        return true;
      },
      decorations(state) {
        const selected = slashSelection(state);
        return selected ? DecorationSet.create(state.doc, [Decoration.inline(selected.from, selected.to, { class: 'nsmd-slash-selected' })]) : null;
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
      // The selected text of the open list: the menu closes the list before the chosen command runs.
      let selected: { from: number; to: number } | undefined;
      return {
        update(updated) {
          const from = slashKey.getState(updated.state)?.from ?? null;
          if (from === null) {
            if (host.menu.isOpen && host.menu.owner === 'slash') {
              host.menu.close();
            }
            return;
          }
          selected = slashSelection(updated.state);
          const query = slashQuery(updated.state, from) ?? '';
          if (!host.menu.isOpen || host.menu.owner !== 'slash') {
            const onSelection = selected !== undefined;
            const items = shownItems(host.items(), onSelection).map((item) => ({
              ...item,
              run: () => {
                const current = slashKey.getState(updated.state)?.from ?? from;
                const end = updated.state.selection.from;
                const tr = updated.state.tr.delete(current, end).setMeta(slashKey, { from: null });
                if (onSelection && selected) {
                  // The command gets the selected text again.
                  tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(selected.from, 1), tr.mapping.map(selected.to, -1)));
                }
                updated.dispatch(tr);
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
