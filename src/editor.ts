// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The editor of rendered Markdown (docs/specification.md, R-GEN-001, R-GEN-008): a Tiptap editor with the extensions
// of the document, which reads and writes Markdown text with the codec of the editor. The text that the editor writes
// keeps each block that the user did not change as the file has it (R-GEN-006). In read-only mode, the same editor is
// the view of the text (R-GEN-010).

import { type AnyExtension, Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { coreExtensions } from './extensions/core';
import { MarkdownCodec } from './markdown/codec';
import type { MarkdownSource } from './markdown/parse';

/** MarkdownEditorOptions configure a MarkdownEditor. */
export interface MarkdownEditorOptions {
  /** markdown is the text that the editor shows first. */
  markdown?: string;
  /** editable false starts the editor in read-only mode; the default is true. */
  editable?: boolean;
  /** extensions are the Tiptap extensions of the editor; the default is the core of the editor. */
  extensions?: AnyExtension[];
  /** onChange is called after each change of the text by the user. */
  onChange?: (editor: MarkdownEditor) => void;
}

/** MarkdownEditor is an editor of rendered Markdown in an element of a page. */
export class MarkdownEditor {
  /** tiptap is the Tiptap editor, for the extensions of the editor. */
  readonly tiptap: Editor;
  private readonly codec: MarkdownCodec;
  private source: MarkdownSource | undefined;

  /**
   * @param element - The element of the page that holds the editor.
   * @param options - The text and the configuration of the editor.
   */
  constructor(element: HTMLElement, options: MarkdownEditorOptions = {}) {
    // The styles of markdown.css apply inside this class.
    element.classList.add('nsmd-editor');
    this.tiptap = new Editor({
      element,
      extensions: options.extensions ?? coreExtensions(),
      editable: options.editable ?? true,
      onUpdate: () => options.onChange?.(this),
    });
    this.codec = new MarkdownCodec({ schema: this.tiptap.schema });
    this.setMarkdown(options.markdown ?? '');
  }

  /**
   * setMarkdown shows a new text. The text becomes the base that keeps the blocks that the user does not change, and
   * Undo starts again.
   * @param markdown - The text.
   */
  setMarkdown(markdown: string): void {
    const { doc, source } = this.codec.parse(markdown);
    this.source = source;
    this.tiptap.view.updateState(EditorState.create({ doc, plugins: this.tiptap.state.plugins }));
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
    this.tiptap.setEditable(editable);
  }

  /** destroy removes the editor from its element. */
  destroy(): void {
    this.tiptap.destroy();
  }
}
