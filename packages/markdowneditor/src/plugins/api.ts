// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The plugin API of the editor, version 1 (docs/plugins.md, R-GEN-005, R-GEN-012, R-PLUGIN-001): a plugin is one object.
// At the level "render", it adds syntax to the markdown-it of the editor, styles, and a view for each new kind of token
// (docs/rendering.md, R-REN-002); the editor keeps the text of such a block byte for byte as one unit, and the user
// changes it through its source. At the level "render and edit", it adds nodes and marks, which token becomes which node
// or mark, how a changed node is written, commands, keys, items of the menus, and the schema and the inputs of the
// front matter. Both levels may mark generated parts as read-only
// (docs/editor.md, R-EDIT-011) and show threads beside the text (R-GEN-014). `activate` gets the API of the editor and
// of the platform, and returns what to dispose. pluginParts combines the plugins of an editor into the parts that the
// codec, the extensions and the interaction of the editor take.

import type { AnyExtension, Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import type { ParseSpec } from 'prosemirror-markdown';
import { renderParts, type MarkdownItExtension, type RenderFunction, type RenderPlugin } from '@nimblescape/markdownrender';
import type { JsonSchema, TextPatch } from '@nimblescape/markdowntext';
import type { Writers } from '../markdown/serialize';
import type { FormatButton } from '../ui/formatBar';
import type { FrontMatterInput } from '../ui/frontMatterForm';
import type { MenuItem } from '../ui/menu';
import type { ProposalResult, ProposedChange } from '../ui/proposals';

// The level "render" of a plugin is a plugin of the renderer of @nimblescape/markdownrender (docs/rendering.md,
// R-REN-002): its members, the version of the plugin API and the function that shows a token come from there.
export { pluginApiVersion, type RenderFunction } from '@nimblescape/markdownrender';

/** Disposable is what a plugin returns to dispose: a function or an object with a function `dispose`. */
export type Disposable = (() => void) | { dispose(): void };

/** PluginCommand is a command of a plugin, which the keys, the menus and the integrating code run by its name. */
export type PluginCommand = (editor: PluginEditor, ...args: unknown[]) => boolean;

/** BlockAt is a block of the document with its position. */
export interface BlockAt {
  readonly node: Node;
  readonly pos: number;
}

/** PluginMenus are the items that a plugin adds to the menus of the editor. */
export interface PluginMenus {
  /** insert returns the items of the insert menu "+" and of the slash commands. */
  insert?: (editor: Editor) => MenuItem[];
  /** format are the buttons of the format bar over selected text. */
  format?: FormatButton[];
  /** block returns the items of the menu of a block, under its handle. */
  block?: (editor: Editor, block: BlockAt) => MenuItem[];
  /** table returns the items of the table menu of a table. */
  table?: (editor: Editor, table: BlockAt) => MenuItem[];
}

/**
 * GeneratedPart is a part of the document that a plugin generates, for example the text of a citation (R-EDIT-011).
 * The user cannot type in it, delete a piece of it or paste into it; the cursor jumps over it, and the user deletes it
 * only as a whole, in one step of Undo.
 */
export interface GeneratedPart {
  /** from and to are the positions of the part in the document. */
  readonly from: number;
  readonly to: number;
  /** open goes to the target of the part, for example the entry of a reference, on Ctrl+click (Cmd+click on macOS). */
  readonly open?: () => void;
  /** edit opens the form of the data of the part, for example the page of a citation, on a double click. */
  readonly edit?: () => void;
}

/** ThreadMarker is a passage of the document that has a thread, for example a note or an AI chat (R-GEN-014). */
export interface ThreadMarker {
  /** id names the thread. */
  readonly id: string;
  /** from and to are the positions of the passage in the document. */
  readonly from: number;
  readonly to: number;
  /** kind is the kind of the thread, for the icon; the default is `note`. */
  readonly kind?: 'note' | 'chat';
  /** count is the number of answers, which the icon shows. */
  readonly count?: number;
  /** label is the name of the thread for the tooltip and for screen readers, for example "Note of a user". */
  readonly label?: string;
}

/** PluginThreads are the threads of a plugin beside the text (R-GEN-014). */
export interface PluginThreads {
  /** find returns the threads of a document. */
  find: (doc: Node) => readonly ThreadMarker[];
  /**
   * open shows a thread in the panel beside the text, which the editor opens at the passage of the thread.
   * @returns What to dispose when the panel closes.
   */
  open: (thread: ThreadMarker, panel: HTMLElement, editor: PluginEditor) => void | Disposable;
}

/** PluginChannel carries the messages of a plugin between the page and the other part of the plugin on its platform. */
export interface PluginChannel {
  /** post sends a message to the other part of the plugin. */
  post(message: unknown): void;
  /** onMessage calls a listener with each message of the other part, and returns a function that stops it. */
  onMessage(listener: (message: unknown) => void): () => void;
}

/** PluginHost is the API of the platform for the plugins, which the integrating code gives the editor. */
export interface PluginHost {
  /** platform names the platform, for example `web` or `vscode`. */
  readonly platform: string;
  /** channel returns the channel of a plugin to its other part, for example in the extension of VS Code. */
  channel?(plugin: string): PluginChannel | undefined;
}

/** PluginEditor is the API of the editor for the plugins: the MarkdownEditor (src/editor.ts). */
export interface PluginEditor {
  /** tiptap is the Tiptap editor, with its state, its view and its commands. */
  readonly tiptap: Editor;
  /** id is the ID of the editor in its source. */
  readonly id: string;
  /** isEditable is false in read-only mode. */
  readonly isEditable: boolean;
  /** getMarkdown returns the text of the editor as Markdown. */
  getMarkdown(): string;
  /**
   * textOffset returns the place in the text of the file of a position of the document, exact inside a block; with the
   * side 1, the place at the edge of a mark is inside the marks of the text after the position.
   */
  textOffset(pos: number, side?: -1 | 1): number;
  /** runCommand runs a command of a plugin by its full name, `plugin.command`. */
  runCommand(name: string, ...args: unknown[]): boolean;
  /** openThread opens the panel of a thread beside the text, and closeThread closes it. */
  openThread(id: string): boolean;
  closeThread(): void;
  /** refreshPlugins asks the plugins again for their generated parts, threads and schema of the front matter, after a change of their data. */
  refreshPlugins(): void;
  /**
   * reparse parses the text of the file again after the syntax of a plugin changed, for example the blocks that a plugin
   * of the level "render" knows; only the top-level blocks whose node changes change, and the text stays the same.
   */
  reparse(): void;
  /**
   * changeText changes the text of the file as a change of the user, as one step of Undo, for example for a slash
   * command whose platform finds the new text. The patches have the places of the current text of the file, in their
   * order, and do not overlap. It returns whether the text changed.
   */
  changeText(patches: readonly TextPatch[]): boolean;
  /**
   * selectText selects a range of the text of the file inside the text of one paragraph or heading, or puts the cursor
   * at a place there, and focuses the editor. It returns whether the editor found the range.
   */
  selectText(from: number, to?: number): boolean;
  /**
   * proposeChange shows a change of the text of the file as a tracked change with "Accept" and "Reject" (R-AI-006), for
   * example a change of the AI; the result says how the proposal ended.
   */
  proposeChange(change: ProposedChange): Promise<ProposalResult>;
}

/**
 * MarkdownPlugin is a plugin of the editor (R-PLUGIN-001): a plugin of the renderer, the level "render", with the
 * members of the level "render and edit". `name` names the plugin, for example `notes`; it is the first part of the
 * full names of its commands.
 */
export interface MarkdownPlugin extends RenderPlugin {
  /**
   * render shows the kinds of tokens of the plugin at the level "render": by the type of a token that has no children,
   * for example `math_block`, or `fence:<language>` for a fenced code block, for example `fence:mermaid`. A top-level
   * block with such a token, or with a token that no node of the editor takes, is one unit that keeps its text.
   */
  readonly render?: Readonly<Record<string, RenderFunction>>;
  /** nodes and marks are the Tiptap extensions of the nodes and marks of the plugin, with their views. */
  readonly nodes?: readonly AnyExtension[];
  readonly marks?: readonly AnyExtension[];
  /** fromMarkdown maps the tokens of the syntax of the plugin to its nodes and marks. */
  readonly fromMarkdown?: Readonly<Record<string, ParseSpec>>;
  /** toMarkdown writes the nodes and marks of the plugin as Markdown. */
  readonly toMarkdown?: Writers;
  /** commands are the commands of the plugin, by their names in the plugin. */
  readonly commands?: Readonly<Record<string, PluginCommand>>;
  /** keys maps a key, in the form of Tiptap, for example `Mod-Alt-m`, to the name of a command of the plugin. */
  readonly keys?: Readonly<Record<string, string>>;
  /** menus are the items of the plugin in the menus of the editor. */
  readonly menus?: PluginMenus;
  /** frontMatterSchema is the JSON schema of the front matter, or returns it (R-FM-004). */
  readonly frontMatterSchema?: JsonSchema | ((editor: Editor) => JsonSchema | undefined);
  /** frontMatterInputs are the inputs of the plugin for the values of keys of the front matter (R-FM-006). */
  readonly frontMatterInputs?: readonly FrontMatterInput[];
  /** generated returns the parts of a document that the plugin generates, which are read-only (R-EDIT-011). */
  readonly generated?: (doc: Node) => readonly GeneratedPart[];
  /** threads are the threads of the plugin beside the text (R-GEN-014). */
  readonly threads?: PluginThreads;
  /**
   * formatRules are the format rules of the syntax of the plugin for the AI, a text in Markdown, for example how a note
   * is written (docs/ai.md, R-AI-001).
   */
  readonly formatRules?: string;
  /**
   * activate starts the plugin in an editor, after the editor shows its text.
   * @param editor - The API of the editor.
   * @param host - The API of the platform.
   * @returns What to dispose when the editor is destroyed.
   */
  readonly activate?: (editor: PluginEditor, host: PluginHost) => void | Disposable;
}

/** PluginParts are the parts of the plugins of an editor, combined. */
export interface PluginParts {
  readonly plugins: readonly MarkdownPlugin[];
  readonly markdownIt: MarkdownItExtension[];
  readonly tokens: Record<string, ParseSpec>;
  readonly writers: Required<Writers>;
  readonly renders: Map<string, RenderFunction>;
  readonly extensions: AnyExtension[];
  readonly commands: Map<string, PluginCommand>;
  readonly keys: Map<string, string>;
}

/** dispose disposes what a plugin returned. */
export function dispose(disposable: void | Disposable | undefined): void {
  if (typeof disposable === 'function') {
    disposable();
  } else if (disposable && typeof disposable.dispose === 'function') {
    disposable.dispose();
  }
}

/**
 * pluginParts checks the plugins of an editor and combines their parts. A plugin needs a name of its own and the
 * version 1 of the plugin API; for the same key, the part of a later plugin wins.
 * @param plugins - The plugins, in their order.
 */
export function pluginParts(plugins: readonly MarkdownPlugin[]): PluginParts {
  const { markdownIt, renders } = renderParts(plugins, 'editor');
  const parts: PluginParts = {
    plugins,
    markdownIt,
    tokens: {},
    writers: { nodes: {}, marks: {} },
    renders,
    extensions: [],
    commands: new Map(),
    keys: new Map(),
  };
  for (const plugin of plugins) {
    Object.assign(parts.tokens, plugin.fromMarkdown);
    Object.assign(parts.writers.nodes, plugin.toMarkdown?.nodes);
    Object.assign(parts.writers.marks, plugin.toMarkdown?.marks);
    parts.extensions.push(...(plugin.nodes ?? []), ...(plugin.marks ?? []));
    for (const [name, command] of Object.entries(plugin.commands ?? {})) {
      parts.commands.set(`${plugin.name}.${name}`, command);
    }
    for (const [key, command] of Object.entries(plugin.keys ?? {})) {
      if (!plugin.commands?.[command]) {
        throw new Error(`The key ${key} of the plugin ${plugin.name} runs the command ${command}, which the plugin does not have.`);
      }
      parts.keys.set(key, `${plugin.name}.${command}`);
    }
  }
  return parts;
}
