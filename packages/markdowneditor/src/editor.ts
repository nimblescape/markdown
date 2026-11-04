// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The editor of rendered Markdown (docs/specification.md, R-GEN-001; docs/editor.md, R-GEN-003, R-GEN-008): a Tiptap
// editor with the extensions of the document, which reads and writes Markdown text with the codec of the editor, and
// with the interaction of a document editor: the toolbar, the format bar, the insert menu, the slash commands, the
// handles of the blocks, find and replace and the mode to learn Markdown. The text that the editor writes keeps each
// block that the user did not change as the file has it (R-EDIT-004). In read-only mode, the same editor is the view
// of the text.
//
// With a TextSource, the editor is one of the editors of a file (R-EDIT-002; docs/source.md, R-SRC-001, R-SRC-002): each
// change of the user becomes a change of the text of the source with the origin `user` and the ID of the editor, and
// each change of the source from another origin replaces only the blocks whose text changed. The editor gives the
// source its selection as the range of the text of the top-level blocks that the selection touches.
//
// Plugins extend the editor through the plugin API (docs/plugins.md, R-GEN-005, R-GEN-012, R-PLUGIN-001;
// src/plugins/api.ts): the editor combines their parts into its codec, its extensions and its interaction, shows the
// blocks of the level "render" with their source (src/plugins/render.ts), keeps their generated parts read-only
// (docs/editor.md, R-EDIT-011) and shows their threads beside the text (R-GEN-014).
//
// The editor is built on the renderer of @nimblescape/markdownrender (docs/specification.md, R-GEN-010): it reads the
// text with the markdown-it of its renderer, shows the blocks of the level "render" with the renderer and the plugins,
// and its text has the styles of rendered content (content.css, the class nsmd-content).

import { type AnyExtension, Editor, Extension } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { closeHistory } from '@tiptap/pm/history';
import { EditorState, Plugin, Selection, type Transaction } from '@tiptap/pm/state';
import { ReplaceStep, Transform } from '@tiptap/pm/transform';
import type { JsonSchema, Origin, TextChange, TextSelection, TextSource } from '@nimblescape/markdowntext';
import { coreExtensions } from './extensions/core';
import { MarkdownCodec } from './markdown/codec';
import type { MarkdownSource } from './markdown/parse';
import { outsideChange, updated } from './markdown/update';
import { addStyles, fenceRender, MarkdownRenderer, renderOf } from '@nimblescape/markdownrender';
import {
  dispose,
  type Disposable,
  type GeneratedPart,
  type MarkdownPlugin,
  type PluginEditor,
  type PluginHost,
  type PluginParts,
  pluginParts,
} from './plugins/api';
import { DocCache } from './plugins/cache';
import { frontMatterValuesPlugin } from './plugins/frontMatterValues';
import { generatedPlugin, generatedWrite, validParts } from './plugins/generated';
import { sourceViews } from './plugins/render';
import { setOpenThread, threadEntries, threadsKey, threadsPlugin, type ThreadEntry } from './plugins/threads';
import { Interaction, type InteractionOptions } from './ui/interaction';
import { type ProposalResult, type ProposedChange, proposalsKey, proposalsOf, proposalsPlugin, type Tracked } from './ui/proposals';
import { type ChangesOptions, EditorChanges } from './ui/changes';

/** textMark is the character that marks a position in the text of a block for textOffset, a character of private use. */
const textMark = '\uE000';

/** MarkdownEditorOptions configure a MarkdownEditor. */
export interface MarkdownEditorOptions extends InteractionOptions {
  /** markdown is the text that the editor shows first. */
  markdown?: string;
  /** editable false starts the editor in read-only mode; the default is true. */
  editable?: boolean;
  /** extensions are the Tiptap extensions of the editor; the default is the core of the editor. */
  extensions?: AnyExtension[];
  /** onChange is called after each change of the text by the user. */
  onChange?: (editor: MarkdownEditor) => void;
  /**
   * source is the source of the file (R-EDIT-002): the editor shows its text in place of `markdown`, gives it each
   * change of the user and takes each change from another editor or from outside.
   */
  source?: TextSource;
  /** id is the ID of the editor in the source; the default is a new ID. */
  id?: string;
  /** plugins are the plugins of the editor (docs/plugins.md, R-PLUGIN-001), in their order. */
  plugins?: MarkdownPlugin[];
  /** host is the API of the platform for the plugins; the default is the platform `web` without channels. */
  host?: PluginHost;
  /**
   * threadIcons false leaves out the icons of the threads beside the text, when the integrating code shows the threads
   * in a view of its own (R-GEN-014); the default is true.
   */
  threadIcons?: boolean;
  /**
   * styleNonce is the nonce of the style elements that the editor adds to the page: the base styles of Tiptap and the
   * styles of the plugins. A page whose policy allows only style elements with a nonce gives it, so that its policy
   * needs no `'unsafe-inline'` (docs/platforms.md, R-PLAT-001).
   */
  styleNonce?: string;
}

/**
 * withPlugins returns the options of the interaction with the parts of the plugins: their items of the menus, their
 * buttons of the format bar, their marks of the mode to learn Markdown and their schema and inputs of the front matter.
 * The options of the integrating code come first; the first schema wins.
 */
function withPlugins(options: InteractionOptions, plugins: readonly MarkdownPlugin[], parts: PluginParts): InteractionOptions {
  if (plugins.length === 0) {
    return options;
  }
  return {
    ...options,
    formatButtons: [...(options.formatButtons ?? []), ...plugins.flatMap((plugin) => plugin.menus?.format ?? [])],
    insertItems: (editor) => [...(options.insertItems?.(editor) ?? []), ...plugins.flatMap((plugin) => plugin.menus?.insert?.(editor) ?? [])],
    blockItems: (editor, block) => [...(options.blockItems?.(editor, block) ?? []), ...plugins.flatMap((plugin) => plugin.menus?.block?.(editor, block) ?? [])],
    tableItems: (editor, table) => [...(options.tableItems?.(editor, table) ?? []), ...plugins.flatMap((plugin) => plugin.menus?.table?.(editor, table) ?? [])],
    learnMarks: {
      marks: { ...parts.learnMarks.marks, ...options.learnMarks?.marks },
      nodes: { ...parts.learnMarks.nodes, ...options.learnMarks?.nodes },
    },
    frontMatterSchema: options.frontMatterSchema ?? plugins.find((plugin) => plugin.frontMatterSchema)?.frontMatterSchema,
    frontMatterInputs: [...(options.frontMatterInputs ?? []), ...plugins.flatMap((plugin) => plugin.frontMatterInputs ?? [])],
  };
}

/**
 * AiContext is what the AI knows of a document: the context of the chat of @nimblescape/markdownai, with the text of the
 * file, the selection, the schema of the front matter and the format rules of the plugins.
 */
export interface AiContext {
  readonly document: { readonly name: string; readonly text: string };
  readonly selection: { readonly from: number; readonly to: number };
  readonly frontMatterSchema?: JsonSchema;
  readonly formatRules: readonly string[];
}

/** editorCount counts the editors, for the IDs of the editors. */
let editorCount = 0;

/** MarkdownEditor is an editor of rendered Markdown in an element of a page. */
export class MarkdownEditor implements PluginEditor {
  /** tiptap is the Tiptap editor, for the extensions of the editor. */
  readonly tiptap: Editor;
  /** id is the ID of the editor in its source. */
  readonly id: string;
  private readonly codec: MarkdownCodec;
  private readonly interaction: Interaction;
  private readonly parts: PluginParts;
  private readonly renderer: MarkdownRenderer;
  private readonly generated: DocCache<GeneratedPart[]>;
  private readonly threads: DocCache<ThreadEntry[]>;
  private readonly disposables: (void | Disposable)[] = [];
  private source: MarkdownSource | undefined;
  private readonly textSource: TextSource | undefined;
  private readonly stopListening: (() => void)[] = [];
  private outside = false;
  private shownDoc: Node | undefined;
  /** proposals ends each open proposed change with its result (R-AI-006). */
  private readonly proposals = new Map<string, (result: ProposalResult) => void>();
  /** origin is the origin of the change that the editor gives the source now, when it is no change of the user. */
  private origin: Origin | undefined;
  /** changes shows the rendered changes against the text of the other side of a diff (docs/editor.md, R-EDIT-012). */
  private changes: EditorChanges | undefined;
  /**
   * held is the range of the top-level code block that held the cursor when `reparse` would have changed it: the
   * editor parses the text again when the cursor leaves it.
   */
  private held: { from: number; to: number } | undefined;

  /**
   * @param element - The element of the page that holds the editor.
   * @param options - The text and the configuration of the editor.
   */
  constructor(element: HTMLElement, options: MarkdownEditorOptions = {}) {
    // The styles of markdown.css apply inside this class.
    element.classList.add('nsmd-editor');
    this.id = options.id ?? `markdowneditor-${++editorCount}`;
    this.textSource = options.source;
    // Every editor has the plugin of the values of the front matter in the text (R-FM-007), before the other plugins.
    const plugins = [frontMatterValuesPlugin, ...(options.plugins ?? [])];
    this.parts = pluginParts(plugins);
    addStyles(plugins, element.ownerDocument, options.styleNonce);
    this.generated = new DocCache((doc) => validParts(doc, plugins.flatMap((plugin) => plugin.generated?.(doc) ?? [])));
    this.threads = new DocCache((doc) => threadEntries(plugins, doc));
    this.interaction = new Interaction(element, withPlugins(options, plugins, this.parts));
    this.tiptap = new Editor({
      element: this.interaction.box,
      extensions: [...(options.extensions ?? coreExtensions()), ...this.parts.extensions, this.pluginExtension(options), this.interaction.extension()],
      editable: options.editable ?? true,
      ...(options.styleNonce ? { injectNonce: options.styleNonce } : {}),
      // The text has the styles of rendered content of the renderer (content.css).
      editorProps: { attributes: { class: 'nsmd-content' } },
      onUpdate: ({ transaction }) => {
        if (!this.outside && !transaction.getMeta(outsideChange)) {
          options.onChange?.(this);
        }
      },
    });
    this.interaction.attach(this.tiptap, { toggle: () => this.setEditable(!this.isEditable) });
    const renders = this.parts.renders;
    // A rendered block is one block of the file in its place: its footnotes stay where it has them, its raw HTML shows
    // as its text, and its first lines are no front matter.
    this.renderer = new MarkdownRenderer(
      { plugins, footnotes: 'inPlace', rawHtml: 'text', headingIds: false, lines: false, frontMatter: 'text' },
      'editor',
    );
    this.codec = new MarkdownCodec({
      schema: this.tiptap.schema,
      md: this.renderer.markdownIt,
      tokens: this.parts.tokens,
      writers: this.parts.writers,
      rendered: (token) => renderOf(renders, token) !== undefined,
    });
    this.show(this.textSource?.text ?? options.markdown ?? '');
    if (this.textSource) {
      const textSource = this.textSource;
      this.stopListening.push(textSource.onChange((change) => this.changed(change)));
      const onTransaction = ({ transaction }: { transaction: Transaction }) => {
        // The plugins may change the document after the transaction, so the editor compares the documents.
        const docChanged = this.tiptap.state.doc !== this.shownDoc;
        this.shownDoc = this.tiptap.state.doc;
        this.transacted(docChanged && !this.outside && !transaction.getMeta(outsideChange));
      };
      this.tiptap.on('transaction', onTransaction);
      this.stopListening.push(() => this.tiptap.off('transaction', onTransaction));
      this.stopListening.push(() => textSource.removeEditor(this.id));
    }
    // A proposed change whose blocks changed went out of the state: its proposal ends as outdated.
    const onProposals = () => {
      const tracked = proposalsOf(this.tiptap.state);
      [...this.proposals.keys()].filter((id) => !tracked.has(id)).forEach((id) => this.settle(id, 'outdated'));
    };
    this.tiptap.on('transaction', onProposals);
    this.stopListening.push(() => this.tiptap.off('transaction', onProposals));
    // A code block that waits for `reparse` moves with the changes, and the editor parses again once the cursor left it.
    const onHeld = ({ transaction }: { transaction: Transaction }) => {
      const held = this.held;
      if (!held) {
        return;
      }
      held.from = transaction.mapping.map(held.from, 1);
      held.to = transaction.mapping.map(held.to, -1);
      const { from, to } = this.tiptap.state.selection;
      if (to <= held.from || from >= held.to) {
        this.held = undefined;
        queueMicrotask(() => this.reparse());
      }
    };
    this.tiptap.on('transaction', onHeld);
    this.stopListening.push(() => this.tiptap.off('transaction', onHeld));
    const host = options.host ?? { platform: 'web' };
    for (const plugin of plugins) {
      this.disposables.push(plugin.activate?.(this, host));
    }
  }

  /**
   * pluginExtension returns the Tiptap extension with the parts of the plugins in the view: the keys of their commands,
   * the views of the blocks with a source, the generated parts and the threads beside the text.
   */
  private pluginExtension(options: MarkdownEditorOptions): Extension {
    const plugins = this.parts.plugins;
    return Extension.create({
      name: 'nsmdPlugins',
      addKeyboardShortcuts: () => Object.fromEntries([...this.parts.keys].map(([key, command]) => [key, () => this.runCommand(command)])),
      addProseMirrorPlugins: () => [
        sourceViews({ renderer: () => this.renderer, commit: (pos, text) => this.editSource(pos, text) }),
        proposalsPlugin({ render: (text, element, inline) => this.renderProposal(text, element, inline), accept: (id) => this.acceptChange(id), reject: (id) => this.rejectChange(id) }),
        new Plugin({ appendTransaction: (transactions, oldState, newState) => this.unitOfCode(transactions, oldState, newState) }),
        ...(plugins.some((plugin) => plugin.generated) ? [generatedPlugin(this.generated)] : []),
        ...(plugins.some((plugin) => plugin.threads)
          ? [threadsPlugin({ box: this.interaction.box, icons: options.threadIcons ?? true, entries: this.threads, editor: () => this })]
          : []),
      ],
    });
  }

  /**
   * unitOfCode makes a top-level code block that the cursor leaves a raw block that keeps its text, when a plugin of the
   * level "render" shows its language, for example a diagram of Mermaid that the user wrote (R-GEN-012).
   * @returns The transaction that replaces the code block, or null.
   */
  private unitOfCode(transactions: readonly Transaction[], oldState: EditorState, newState: EditorState): Transaction | null {
    const rawBlock = newState.schema.nodes.rawBlock;
    const $head = oldState.selection.$head;
    if (!rawBlock || $head.depth !== 1 || $head.parent.type.name !== 'codeBlock' || !transactions.some((tr) => tr.selectionSet || tr.docChanged)) {
      return null;
    }
    let pos = $head.before(1);
    for (const tr of transactions) {
      pos = tr.mapping.map(pos, 1);
    }
    const node = newState.doc.nodeAt(pos);
    const { from, to } = newState.selection;
    if (node?.type.name !== 'codeBlock' || (from > pos && to < pos + node.nodeSize) || newState.doc.resolve(pos).depth !== 0) {
      return null;
    }
    const language = String(node.attrs.language ?? '').trim();
    if (!language || !this.parts.renders.has(`${fenceRender}${language}`)) {
      return null;
    }
    const text = this.codec.serialize(newState.doc.type.create(null, node)).replace(/\n$/, '');
    return newState.tr.replaceWith(pos, pos + node.nodeSize, rawBlock.create({ text, rendered: true }));
  }

  /**
   * runCommand runs a command of a plugin (R-PLUGIN-001).
   * @param name - The full name of the command, `plugin.command`, for example `notes.addNote`.
   * @param args - The arguments of the command.
   * @returns What the command returns, or false for a command that no plugin has.
   */
  runCommand(name: string, ...args: unknown[]): boolean {
    const command = this.parts.commands.get(name);
    return command ? command(this, ...args) : false;
  }

  /**
   * openThread opens the panel of a thread beside the text (R-GEN-014).
   * @param id - The ID of the thread.
   * @returns false when no plugin has a thread with this ID in the document.
   */
  openThread(id: string): boolean {
    if (!this.threads.get(this.tiptap.state.doc).some((entry) => entry.marker.id === id)) {
      return false;
    }
    setOpenThread(this.tiptap.view, id);
    return true;
  }

  /** closeThread closes the panel of the open thread. */
  closeThread(): void {
    setOpenThread(this.tiptap.view, undefined);
  }

  /**
   * goToText puts the cursor at the start of the top-level block that holds a place of the text of the file, shows the
   * block and focuses the editor, for example after a double click on the pages (docs/rendering.md, R-LAYOUT-003).
   * @param offset - The place in the text of the file, as the source counts it.
   */
  goToText(offset: number): void {
    const ranges = this.blockRanges();
    const range = [...ranges].reverse().find((each) => each.from <= offset) ?? ranges[0];
    if (!range || this.tiptap.isDestroyed) {
      return;
    }
    const { state } = this.tiptap;
    const selection = Selection.near(state.doc.resolve(Math.min(range.start + 1, state.doc.content.size)));
    this.tiptap.view.dispatch(state.tr.setSelection(selection).scrollIntoView());
    this.tiptap.view.focus();
  }

  /**
   * textOffset returns the place in the text of the file of a position of the document, as the source counts it, for
   * example for a plugin that needs the place of the selected text in the file (docs/plugins.md, R-PLUGIN-001). Inside
   * the text of a top-level block, the place is exact: the editor writes the block with a mark at the position and finds
   * the mark in the text of the block. A position between top-level blocks gives the start of the next block. At the
   * edge of a mark, for example before bold text, the place is outside the mark; with the side 1, the place is next to
   * the text after the position, inside the marks of that text, as the start of a selection needs it.
   * @param pos - The position in the document.
   * @param side - -1, the default, for the marks of the text before the position; 1 for the marks of the text after it.
   */
  textOffset(pos: number, side: -1 | 1 = -1): number {
    const ranges = this.blockRanges();
    const index = ranges.findIndex((range) => pos >= range.start && pos < range.end);
    const range = index < 0 ? ranges[ranges.length - 1] : ranges[index];
    if (!range || index < 0) {
      return range?.to ?? 0;
    }
    const block = this.tiptap.state.doc.child(index);
    const text = this.source?.blocks.get(block)?.text;
    const single = this.tiptap.state.doc.type.create(null, block);
    const inner = pos - range.start;
    const $inner = inner > 0 ? single.resolve(inner) : undefined;
    if (text === undefined || !$inner?.parent.inlineContent) {
      return range.from;
    }
    // The mark has the marks of the position, so that it stands inside them, for example in bold text.
    const mark = single.type.schema.text(textMark, side > 0 && $inner.nodeAfter?.isText ? $inner.nodeAfter.marks : $inner.marks());
    const written = this.codec.serialize(new Transform(single).insert(inner, mark).doc).replace(/\n+$/, '');
    const at = written.indexOf(textMark);
    if (at < 0) {
      return range.from;
    }
    const before = written.slice(0, at);
    const after = written.slice(at + textMark.length);
    let offset: number;
    if (text.startsWith(before)) {
      offset = before.length;
    } else if (text.endsWith(after)) {
      offset = text.length - after.length;
    } else {
      offset = 0;
      while (offset < before.length && offset < text.length && text[offset] === before[offset]) {
        offset++;
      }
    }
    const breaks = this.source?.lineBreak === '\r\n' ? text.slice(0, offset).split('\n').length - 1 : 0;
    return range.from + offset + breaks;
  }

  /**
   * refreshPlugins asks the plugins again for their generated parts, their threads and the schema of the front matter,
   * after a change of their data, for example a schema that a plugin received from its part on the platform.
   */
  refreshPlugins(): void {
    this.generated.refresh();
    this.threads.refresh();
    this.interaction.refreshFrontMatter();
    if (!this.tiptap.isDestroyed) {
      this.tiptap.view.dispatch(this.tiptap.state.tr.setMeta(threadsKey, { refresh: true }).setMeta('addToHistory', false));
    }
  }

  /**
   * reparse parses the text of the file again after the syntax of a plugin changed, for example the blocks that a plugin
   * of the level "render" knows (docs/plugins.md, R-PLUGIN-001): only the top-level blocks whose node changes change,
   * outside Undo, and the text stays the same. A top-level code block that holds the cursor changes only after the
   * cursor leaves it, as a code block whose language a plugin shows (R-GEN-012).
   */
  reparse(): void {
    this.held = undefined;
    if (this.tiptap.isDestroyed || !this.source) {
      return;
    }
    const { state } = this.tiptap;
    const { text, source } = this.codec.rebased(state.doc, this.source);
    const { tr, source: next } = updated(state, source, this.codec.parse(text));
    if (!tr) {
      return;
    }
    const { $head } = state.selection;
    if ($head.depth >= 1 && $head.node(1).type.name === 'codeBlock') {
      const held = { from: $head.before(1), to: $head.after(1) };
      if (tr.steps.some((step) => step instanceof ReplaceStep && step.from < held.to && held.from < step.to)) {
        this.held = held;
        return;
      }
    }
    this.source = next;
    this.outside = true;
    try {
      this.tiptap.view.dispatch(tr);
    } finally {
      this.outside = false;
    }
  }

  /**
   * editSource gives a block with a source a new text, from the field "Edit source" (R-GEN-012): a top-level block
   * changes through its text in the text of the file, which the editor parses again, so that the new text may become
   * other blocks; a block of HTML inside another block takes the new text. The change is one step of Undo.
   * @param pos - The position of the block.
   * @param text - The new text of the block.
   */
  editSource(pos: number, text: string): void {
    const { state } = this.tiptap;
    const node = state.doc.nodeAt(pos);
    if (!node || !this.source || !this.isEditable) {
      return;
    }
    if (state.doc.resolve(pos).depth > 0) {
      if (node.type.name === 'htmlBlock') {
        this.tiptap.view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, html: text }));
      }
      return;
    }
    const { source } = this.codec.rebased(state.doc, this.source);
    const known = source.blocks.get(node);
    if (!known) {
      return;
    }
    const texts: string[] = [];
    state.doc.forEach((block) => {
      const each = source.blocks.get(block);
      if (each) {
        texts[each.index] = block === node ? text : each.text;
      }
    });
    const body = source.before + texts.map((each, index) => (index > 0 ? source.gaps[index - 1] : '') + each).join('') + source.after;
    const file = `${source.bom ? '\ufeff' : ''}${source.lineBreak === '\r\n' ? body.replace(/\n/g, '\r\n') : body}`;
    const { tr, source: next } = updated(state, source, this.codec.parse(file));
    if (!tr) {
      return;
    }
    // The change is a change of the user: it enters Undo and goes to the source of the file.
    tr.setMeta('addToHistory', true).setMeta(outsideChange, false).scrollIntoView();
    const before = this.source;
    this.source = next;
    this.tiptap.view.dispatch(tr);
    if (this.tiptap.state.doc === state.doc) {
      this.source = before;
    }
    this.tiptap.view.focus();
  }

  /**
   * setMarkdown shows a new text. The text becomes the base that keeps the blocks that the user does not change, and
   * Undo starts again. With a source, the text becomes the text of the source, with the origin `program`.
   * @param markdown - The text.
   */
  setMarkdown(markdown: string): void {
    this.show(markdown);
    this.textSource?.setText(markdown, { kind: 'program', editor: this.id });
  }

  /** show shows a new text and starts Undo again. */
  private show(markdown: string): void {
    const { doc, source } = this.codec.parse(markdown);
    this.source = source;
    this.held = undefined;
    this.tiptap.view.updateState(EditorState.create({ doc, plugins: this.tiptap.state.plugins }));
    this.shownDoc = this.tiptap.state.doc;
    this.interaction.refresh();
    // A new text ends the proposed changes of the old one.
    [...this.proposals.keys()].forEach((id) => this.settle(id, 'outdated'));
  }

  /**
   * transacted gives the source a change of the user and the selection after a transaction.
   * @param byUser - true when the transaction changed the document and is no change from outside.
   */
  private transacted(byUser: boolean): void {
    if (!this.textSource || !this.source) {
      return;
    }
    if (byUser) {
      // The new source knows the text of each block, so that a change from outside finds the blocks that it changes.
      const { text, source } = this.codec.rebased(this.tiptap.state.doc, this.source);
      this.source = source;
      this.textSource.setText(text, this.origin ?? { kind: 'user', editor: this.id });
    }
    this.textSource.setSelections(this.id, [this.textSelection()]);
  }

  /**
   * changed takes a change of the source from another editor or from outside: only the blocks whose text changed
   * change (R-SRC-002), and Undo of the editor keeps its steps.
   * @param change - The change of the source.
   */
  private changed(change: TextChange): void {
    if (change.origin.editor === this.id || !this.source) {
      return;
    }
    const { tr, source } = updated(this.tiptap.state, this.source, this.codec.parse(change.text));
    this.source = source;
    if (tr) {
      this.outside = true;
      try {
        this.tiptap.view.dispatch(tr);
      } finally {
        this.outside = false;
      }
    }
    this.textSource?.setSelections(this.id, [this.textSelection()]);
  }

  /**
   * textSelection returns the selection of the editor in the text: from the start of the first top-level block that it
   * touches to the end of the last one, in the direction of the selection.
   */
  private textSelection(): TextSelection {
    const { anchor, head } = this.tiptap.state.selection;
    const ranges = this.blockRanges();
    const at = (position: number) => ranges.find((range) => position >= range.start && position <= range.end) ?? ranges[ranges.length - 1];
    const first = at(Math.min(anchor, head));
    const last = at(Math.max(anchor, head));
    if (!first || !last) {
      return { anchor: 0, head: 0 };
    }
    return anchor <= head ? { anchor: first.from, head: last.to } : { anchor: last.to, head: first.from };
  }

  /**
   * blockRanges returns, for each top-level block, its positions in the document and the range of its text in the text
   * of the source, with the byte order mark and the line breaks of the file. A block without text, for example the
   * empty paragraph of an empty document, has an empty range where the text before it ends.
   */
  private blockRanges(): { start: number; end: number; from: number; to: number }[] {
    const source = this.source;
    if (!source) {
      return [];
    }
    const doc = this.tiptap.state.doc;
    const texts: string[] = [];
    doc.forEach((node) => {
      const known = source.blocks.get(node);
      if (known) {
        texts[known.index] = known.text;
      }
    });
    // The offset of each block of the source in its text with line feeds.
    const offsets: number[] = [];
    let offset = source.before.length;
    for (let index = 0; index < source.count; index++) {
      offsets.push(offset);
      offset += (texts[index]?.length ?? 0) + (source.gaps[index]?.length ?? 0);
    }
    const inFile = (at: number): number =>
      at + (source.bom ? 1 : 0) + (source.lineBreak === '\r\n' ? source.text.slice(0, at).split('\n').length - 1 : 0);
    const ranges: { start: number; end: number; from: number; to: number }[] = [];
    let start = 0;
    let previous = 0;
    doc.forEach((node) => {
      const known = source.blocks.get(node);
      const from = known ? offsets[known.index] : previous;
      const to = known ? from + known.text.length : from;
      ranges.push({ start, end: start + node.nodeSize, from: inFile(from), to: inFile(to) });
      start += node.nodeSize;
      previous = to;
    });
    return ranges;
  }

  /** getMarkdown returns the text of the editor as Markdown. */
  getMarkdown(): string {
    return this.codec.serialize(this.tiptap.state.doc, this.source);
  }

  /**
   * aiContext returns what the AI knows of the document (docs/ai.md, R-AI-001): the text of the file, the selection
   * as places in the text, the JSON schema of the front matter, and the format rules of the plugins. It is the context
   * of the chat of @nimblescape/markdownai.
   * @param name - The path or the name of the file.
   */
  aiContext(name: string): AiContext {
    const { from, to } = this.tiptap.state.selection;
    const schema = this.interaction.frontMatterSchema();
    return {
      document: { name, text: this.textSource?.text ?? this.getMarkdown() },
      selection: from === to ? { from: this.textOffset(from), to: this.textOffset(from) } : { from: this.textOffset(from, 1), to: this.textOffset(to) },
      ...(schema === undefined ? {} : { frontMatterSchema: schema }),
      formatRules: this.parts.plugins.flatMap((plugin) => (plugin.formatRules?.trim() ? [plugin.formatRules] : [])),
    };
  }

  /**
   * showChanges shows the rendered changes of this editor as one side of a diff (docs/editor.md, R-EDIT-012): the
   * marks of the changed blocks and words against the text of the other side, the rows that line up with the other
   * side and the scroll together (src/ui/changes.ts). A second call replaces the first one.
   * @param options - The side, the text of the other side and the listeners for the other side.
   * @returns The changes, which take the text, the heights and the scroll position of the other side.
   */
  showChanges(options: ChangesOptions): EditorChanges {
    this.changes?.destroy();
    const changes = new EditorChanges(this.tiptap, options, (text) => this.codec.parse(text).doc);
    this.changes = changes;
    return changes;
  }

  /** hideChanges removes the rendered changes. */
  hideChanges(): void {
    this.changes?.destroy();
    this.changes = undefined;
  }

  /** isEditable is false in read-only mode. */
  get isEditable(): boolean {
    return this.tiptap.isEditable;
  }

  /**
   * setEditable switches between editing and read-only mode (R-GEN-008).
   * @param editable - false for read-only mode.
   */
  setEditable(editable: boolean): void {
    // A switch of the mode is no change of the text, so onChange is not called.
    this.tiptap.setEditable(editable, false);
    this.interaction.refresh();
  }

  /**
   * setReadOnlyToggle shows or hides the switch between editing and reading in the toolbar (R-GEN-008), for example
   * for the older version of a diff, which cannot change (docs/editor.md, R-EDIT-012). The option `readOnlyToggle`
   * false leaves out the switch for good.
   * @param shown - false hides the switch.
   */
  setReadOnlyToggle(shown: boolean): void {
    this.interaction.setReadOnlyToggle(shown);
  }

  /** isLearning is true while the mode to learn Markdown is on (R-GEN-013). */
  get isLearning(): boolean {
    return this.interaction.isLearning;
  }

  /**
   * setLearnMode switches the mode to learn Markdown on or off (R-GEN-013).
   * @param on - true to show the Markdown marks beside the rendered text.
   */
  setLearnMode(on: boolean): void {
    this.interaction.setLearnMode(on);
  }

  /**
   * setFrontMatterSchema gives the front matter a new JSON schema, or none, for example after a change of the layout
   * of a paper (R-FM-004).
   * @param schema - The schema, a function that returns it, or undefined for none.
   */
  setFrontMatterSchema(schema: MarkdownEditorOptions['frontMatterSchema']): void {
    this.interaction.setFrontMatterSchema(schema);
  }

  /** openFind opens the bar of find and replace. */
  openFind(): void {
    this.interaction.openFind();
  }

  /**
   * proposeChange shows a change of the text of the file that the AI or another program proposes as a tracked change,
   * with "Accept" and "Reject" (docs/ai.md, R-AI-006). Nothing changes the file before the user accepts it; an accepted
   * change is one step of Undo and goes to the source with the origin of the proposal, the AI by default. A change of
   * the user or from outside in the blocks of the proposal, and a new text, end it as outdated.
   * @param change - The proposed change: the range of the text of the file, as the source counts it, and the new text.
   * @returns The result, when the user accepted or rejected the change or it went away.
   */
  proposeChange(change: ProposedChange): Promise<ProposalResult> {
    this.settle(change.id, 'outdated');
    const tracked = this.tiptap.isDestroyed ? undefined : this.track(change);
    if (!tracked) {
      this.removeProposals([change.id]);
      return Promise.resolve('outdated');
    }
    const result = new Promise<ProposalResult>((resolve) => this.proposals.set(change.id, resolve));
    this.tiptap.view.dispatch(this.tiptap.state.tr.setMeta(proposalsKey, { add: tracked }).setMeta('addToHistory', false));
    return result;
  }

  /** proposedChanges returns the open proposed changes, in their order in the document. */
  proposedChanges(): ProposedChange[] {
    return [...proposalsOf(this.tiptap.state).values()].sort((a, b) => a.from - b.from).map((tracked) => tracked.change);
  }

  /**
   * acceptChange applies a proposed change to the text, as one step of Undo with the origin of the proposal.
   * @param id - The ID of the proposal.
   * @returns Whether the text changed; a proposal whose text changed meanwhile ends as outdated.
   */
  acceptChange(id: string): boolean {
    const tracked = proposalsOf(this.tiptap.state).get(id);
    if (!tracked || !this.isEditable || !this.source || this.tiptap.isDestroyed) {
      return false;
    }
    const { state } = this.tiptap;
    const { text, source } = this.codec.rebased(state.doc, this.source);
    const ranges = this.blockRanges();
    const base = tracked.base === 'file' ? 0 : tracked.base === 'start' ? ranges.find((range) => range.start === tracked.from)?.from : ranges.find((range) => range.end === tracked.from)?.to;
    const at = base === undefined ? -1 : base + tracked.offset;
    if (at < 0 || text.slice(at, at + tracked.oldText.length) !== tracked.oldText) {
      this.settle(id, 'outdated');
      this.removeProposals([id]);
      return false;
    }
    const file = text.slice(0, at) + tracked.newText + text.slice(at + tracked.oldText.length);
    const { tr, source: next } = updated(state, source, this.codec.parse(file));
    this.settle(id, 'accepted');
    if (!tr) {
      this.removeProposals([id]);
      return false;
    }
    // The change is a change of its own in Undo; it may change generated parts, as a change from outside does.
    closeHistory(tr).setMeta('addToHistory', true).setMeta(outsideChange, false).setMeta(generatedWrite, true).setMeta(proposalsKey, { remove: [id] });
    const before = this.source;
    this.source = next;
    this.origin = { ...(tracked.change.origin ?? { kind: 'ai' }), editor: this.id };
    try {
      this.tiptap.view.dispatch(tr.scrollIntoView());
    } finally {
      this.origin = undefined;
    }
    if (this.tiptap.state.doc === state.doc) {
      this.source = before;
      return false;
    }
    return true;
  }

  /**
   * rejectChange removes a proposed change without a change of the text.
   * @param id - The ID of the proposal.
   * @returns Whether the editor had the proposal.
   */
  rejectChange(id: string): boolean {
    if (!proposalsOf(this.tiptap.state).has(id)) {
      return false;
    }
    this.settle(id, 'rejected');
    this.removeProposals([id]);
    return true;
  }

  /** settle ends the proposal of an ID with its result. */
  private settle(id: string, result: ProposalResult): void {
    const resolve = this.proposals.get(id);
    this.proposals.delete(id);
    resolve?.(result);
  }

  /** removeProposals removes proposals from the state of the editor. */
  private removeProposals(ids: readonly string[]): void {
    if (!this.tiptap.isDestroyed && ids.some((id) => proposalsOf(this.tiptap.state).has(id))) {
      this.tiptap.view.dispatch(this.tiptap.state.tr.setMeta(proposalsKey, { remove: ids }).setMeta('addToHistory', false));
    }
  }

  /**
   * track finds the places of a proposed change: the top-level blocks that it touches, or the place between blocks for
   * a change in the text between them, the text that it replaces and its new text, and its range in the line for a change
   * inside the text of one paragraph or heading.
   * @param change - The proposed change.
   * @returns The tracked change, or undefined for a range outside the text.
   */
  private track(change: ProposedChange): Tracked | undefined {
    if (!this.source) {
      return undefined;
    }
    const { text } = this.codec.rebased(this.tiptap.state.doc, this.source);
    if (!(Number.isInteger(change.from) && Number.isInteger(change.to) && change.from >= 0 && change.from <= change.to && change.to <= text.length)) {
      return undefined;
    }
    const ranges = this.blockRanges();
    const empty = change.from === change.to;
    const touched = ranges
      .map((range, index) => ({ ...range, index }))
      .filter((range) => (empty ? range.from <= change.from && change.from <= range.to && range.from < range.to : range.from < change.to && range.to > change.from));
    if (touched.length === 0) {
      // A change in the text between two blocks, for example a new paragraph.
      const before = ranges.filter((range) => range.to <= change.from).pop();
      const at = before?.end ?? 0;
      return {
        change,
        from: at,
        to: at,
        inline: undefined,
        base: before ? 'end' : 'file',
        offset: before ? change.from - before.to : change.from,
        oldText: text.slice(change.from, change.to),
        newText: change.text,
      };
    }
    const first = touched[0];
    const last = touched[touched.length - 1];
    const start = Math.min(first.from, change.from);
    const end = Math.max(last.to, change.to);
    return {
      change,
      from: first.start,
      to: last.end,
      inline: touched.length === 1 && !/[\r\n]/.test(change.text) ? this.lineRange(text, first, change) : undefined,
      base: 'start',
      offset: start - first.from,
      oldText: text.slice(start, end),
      newText: text.slice(start, change.from) + change.text + text.slice(change.to, end),
    };
  }

  /**
   * lineRange returns the positions of a range of the text of the file inside the text of a top-level paragraph or
   * heading, or undefined when the range does not start and end at places of the text. A place right after the opening
   * marks of a mark, for example after `**`, or right before its closing marks, is the position at the edge of the mark.
   * @param text - The text of the file.
   * @param block - The block, with its positions and its range in the text.
   * @param change - The range in the text.
   */
  private lineRange(text: string, block: { start: number; end: number; from: number; to: number; index: number }, change: ProposedChange): { from: number; to: number } | undefined {
    const { doc } = this.tiptap.state;
    const node = doc.child(block.index);
    if (!node.isTextblock || change.from < block.from || change.to > block.to) {
      return undefined;
    }
    // The places in the text grow with the positions inside the text of a block: a search finds the first position at
    // or after a place.
    const search = (offset: number): number => {
      let low = block.start + 1;
      let high = block.end - 1;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (this.textOffset(middle) < offset) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }
      return low;
    };
    // A place between marks and a character: the character in the text equals the character of the document.
    const start = (offset: number): number | undefined => {
      const pos = search(offset);
      if (this.textOffset(pos) === offset) {
        return pos;
      }
      return pos > block.start + 1 && text.slice(offset, this.textOffset(pos)) === doc.textBetween(pos - 1, pos) ? pos - 1 : undefined;
    };
    const end = (offset: number): number | undefined => {
      const pos = search(offset);
      if (this.textOffset(pos) === offset) {
        return pos;
      }
      return pos > block.start + 1 && text.slice(this.textOffset(pos - 1), offset) === doc.textBetween(pos - 1, pos) ? pos : undefined;
    };
    const from = start(change.from);
    const to = from === undefined ? undefined : change.to === change.from ? from : end(change.to);
    return from === undefined || to === undefined || to < from ? undefined : { from, to };
  }

  /**
   * renderProposal shows the new text of a proposed change: blocks, or the content of one paragraph in the line.
   * @param text - The new text, Markdown.
   * @param element - The element.
   * @param inline - true for the new text of a change in the line.
   */
  private renderProposal(text: string, element: HTMLElement, inline: boolean): void {
    this.renderer.render(text, element);
    const only = element.childElementCount === 1 ? element.firstElementChild : null;
    if (inline && only?.tagName === 'P') {
      // In the line, the content of the paragraph stands without the paragraph and the line breaks around it.
      element.replaceChildren(...only.childNodes);
    }
  }

  /** destroy removes the editor and its interaction from its element, the editor from its source, and its plugins. */
  destroy(): void {
    this.hideChanges();
    [...this.proposals.keys()].forEach((id) => this.settle(id, 'outdated'));
    this.disposables.splice(0).forEach((disposable) => dispose(disposable));
    this.stopListening.forEach((stop) => stop());
    this.stopListening.length = 0;
    this.tiptap.destroy();
    this.interaction.destroy();
  }
}
