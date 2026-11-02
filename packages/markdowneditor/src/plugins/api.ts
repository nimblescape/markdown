// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The plugin API of the editor, version 1 (docs/plugins.md, R-GEN-005, R-GEN-012, R-PLUGIN-001): a plugin is one object.
// At the level "render", it adds syntax to the markdown-it of the editor, styles, and a view for each new kind of token
// (docs/rendering.md, R-REN-002); the editor keeps the text of such a block byte for byte as one unit, and the user
// changes it through its source. At the level "render and edit", it adds nodes and marks, which token becomes which node
// or mark, how a changed node is written, commands, keys, items of the menus, the schema and the inputs of the front
// matter, and the marks of the mode to learn Markdown. Both levels may mark generated parts as read-only
// (docs/editor.md, R-EDIT-011) and show threads beside the text (R-GEN-014). `activate` gets the API of the editor and
// of the platform, and returns what to dispose. pluginParts combines the plugins of an editor into the parts that the
// codec, the extensions and the interaction of the editor take.

import type { AnyExtension, Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import type Token from 'markdown-it/lib/token.mjs';
import type { ParseSpec } from 'prosemirror-markdown';
import type { JsonSchema } from '@nimblescape/markdowntext';
import type { MarkdownItExtension } from '../markdown/markdownIt';
import type { Writers } from '../markdown/serialize';
import type { FormatButton } from '../ui/formatBar';
import type { FrontMatterInput } from '../ui/frontMatterForm';
import type { LearnMarks } from '../ui/learnMode';
import type { MenuItem } from '../ui/menu';

/** pluginApiVersion is the version of the plugin API of this editor. */
export const pluginApiVersion = 1;

/**
 * RenderFunction shows a token of a block of the level "render" in an element (R-REN-002). It may return a function
 * that removes what it added, for example a listener.
 * @param source - The text of the token, for example the code of a diagram.
 * @param element - The empty element in place of the token: a `div` for a block, a `span` for an inline token.
 * @param token - The token of markdown-it.
 */
export type RenderFunction = (source: string, element: HTMLElement, token: Token) => void | (() => void);

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
  /** runCommand runs a command of a plugin by its full name, `plugin.command`. */
  runCommand(name: string, ...args: unknown[]): boolean;
  /** openThread opens the panel of a thread beside the text, and closeThread closes it. */
  openThread(id: string): boolean;
  closeThread(): void;
  /** refreshPlugins asks the plugins again for their generated parts and threads, after a change of their data. */
  refreshPlugins(): void;
}

/** MarkdownPlugin is a plugin of the editor (R-PLUGIN-001). */
export interface MarkdownPlugin {
  /** name names the plugin, for example `notes`; it is the first part of the full names of its commands. */
  readonly name: string;
  /** apiVersion is the version of the plugin API that the plugin was written for. */
  readonly apiVersion: 1;
  /** extendMarkdownIt adds syntax to the markdown-it of the editor, as `extendMarkdownIt` of the VS Code preview. */
  readonly extendMarkdownIt?: MarkdownItExtension;
  /** styles is the CSS of the plugin, which the editor adds to the page once. */
  readonly styles?: string;
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
  /** learnMarks are the marks that the mode to learn Markdown shows for the nodes and marks of the plugin. */
  readonly learnMarks?: LearnMarks;
  /** frontMatterSchema is the JSON schema of the front matter, or returns it (R-FM-004). */
  readonly frontMatterSchema?: JsonSchema | ((editor: Editor) => JsonSchema | undefined);
  /** frontMatterInputs are the inputs of the plugin for the values of keys of the front matter (R-FM-006). */
  readonly frontMatterInputs?: readonly FrontMatterInput[];
  /** generated returns the parts of a document that the plugin generates, which are read-only (R-EDIT-011). */
  readonly generated?: (doc: Node) => readonly GeneratedPart[];
  /** threads are the threads of the plugin beside the text (R-GEN-014). */
  readonly threads?: PluginThreads;
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
  readonly learnMarks: Required<LearnMarks>;
}

/** fenceRender is the start of the key of `render` for a fenced code block with a language. */
export const fenceRender = 'fence:';

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
  const names = new Set<string>();
  const parts: PluginParts = {
    plugins,
    markdownIt: [],
    tokens: {},
    writers: { nodes: {}, marks: {} },
    renders: new Map(),
    extensions: [],
    commands: new Map(),
    keys: new Map(),
    learnMarks: { marks: {}, nodes: {} },
  };
  for (const plugin of plugins) {
    if (typeof plugin.name !== 'string' || !/^[A-Za-z][\w-]*$/.test(plugin.name)) {
      throw new Error(`A plugin of the editor needs a name of letters, digits, "_" and "-": ${String(plugin.name)}.`);
    }
    if (names.has(plugin.name)) {
      throw new Error(`The editor has two plugins with the name ${plugin.name}.`);
    }
    names.add(plugin.name);
    if (plugin.apiVersion !== pluginApiVersion) {
      throw new Error(`The plugin ${plugin.name} needs the plugin API version ${String(plugin.apiVersion)}; the editor has the version ${pluginApiVersion}.`);
    }
    if (plugin.extendMarkdownIt) {
      parts.markdownIt.push(plugin.extendMarkdownIt);
    }
    Object.assign(parts.tokens, plugin.fromMarkdown);
    Object.assign(parts.writers.nodes, plugin.toMarkdown?.nodes);
    Object.assign(parts.writers.marks, plugin.toMarkdown?.marks);
    for (const [kind, render] of Object.entries(plugin.render ?? {})) {
      parts.renders.set(kind, render);
    }
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
    Object.assign(parts.learnMarks.marks, plugin.learnMarks?.marks);
    Object.assign(parts.learnMarks.nodes, plugin.learnMarks?.nodes);
  }
  return parts;
}

/**
 * addStyles adds the CSS of the plugins to a page, once for each plugin: a later editor on the same page finds the
 * element of the styles of a plugin by its name.
 * @param plugins - The plugins.
 * @param page - The document of the page.
 */
export function addStyles(plugins: readonly MarkdownPlugin[], page: Document): void {
  for (const plugin of plugins) {
    if (!plugin.styles || page.head.querySelector(`style[data-nsmd-plugin="${plugin.name}"]`)) {
      continue;
    }
    const style = page.createElement('style');
    style.dataset.nsmdPlugin = plugin.name;
    style.textContent = plugin.styles;
    page.head.append(style);
  }
}
