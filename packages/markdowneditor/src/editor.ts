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

import { type AnyExtension, Editor } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import type { TextChange, TextSelection, TextSource } from '@nimblescape/markdowntext';
import { coreExtensions } from './extensions/core';
import { MarkdownCodec } from './markdown/codec';
import type { MarkdownSource } from './markdown/parse';
import { outsideChange, updated } from './markdown/update';
import { Interaction, type InteractionOptions } from './ui/interaction';

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
}

/** editorCount counts the editors, for the IDs of the editors. */
let editorCount = 0;

/** MarkdownEditor is an editor of rendered Markdown in an element of a page. */
export class MarkdownEditor {
  /** tiptap is the Tiptap editor, for the extensions of the editor. */
  readonly tiptap: Editor;
  /** id is the ID of the editor in its source. */
  readonly id: string;
  private readonly codec: MarkdownCodec;
  private readonly interaction: Interaction;
  private source: MarkdownSource | undefined;
  private readonly textSource: TextSource | undefined;
  private readonly stopListening: (() => void)[] = [];
  private outside = false;
  private shownDoc: Node | undefined;

  /**
   * @param element - The element of the page that holds the editor.
   * @param options - The text and the configuration of the editor.
   */
  constructor(element: HTMLElement, options: MarkdownEditorOptions = {}) {
    // The styles of markdown.css apply inside this class.
    element.classList.add('nsmd-editor');
    this.id = options.id ?? `markdowneditor-${++editorCount}`;
    this.textSource = options.source;
    this.interaction = new Interaction(element, options);
    this.tiptap = new Editor({
      element: this.interaction.box,
      extensions: [...(options.extensions ?? coreExtensions()), this.interaction.extension()],
      editable: options.editable ?? true,
      onUpdate: ({ transaction }) => {
        if (!this.outside && !transaction.getMeta(outsideChange)) {
          options.onChange?.(this);
        }
      },
    });
    this.interaction.attach(this.tiptap, { toggle: () => this.setEditable(!this.isEditable) });
    this.codec = new MarkdownCodec({ schema: this.tiptap.schema });
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
    this.tiptap.view.updateState(EditorState.create({ doc, plugins: this.tiptap.state.plugins }));
    this.shownDoc = this.tiptap.state.doc;
    this.interaction.refresh();
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
      this.textSource.setText(text, { kind: 'user', editor: this.id });
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

  /** destroy removes the editor and its interaction from its element, and the editor from its source. */
  destroy(): void {
    this.stopListening.forEach((stop) => stop());
    this.stopListening.length = 0;
    this.tiptap.destroy();
    this.interaction.destroy();
  }
}
