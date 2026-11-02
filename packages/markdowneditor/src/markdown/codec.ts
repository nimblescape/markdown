// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The Markdown of the editor in both directions (docs/editor.md, R-EDIT-004, R-EDIT-005): the reader and the
// writer for one schema and one markdown-it, with the parts that the extensions of the editor add (R-GEN-012).

import { getSchema, type AnyExtension } from '@tiptap/core';
import type { Node, Schema } from '@tiptap/pm/model';
import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type { ParseSpec } from 'prosemirror-markdown';
import { coreExtensions } from '../extensions/core';
import { createMarkdownIt, type MarkdownItExtension } from './markdownIt';
import { MarkdownReader, type MarkdownSource, type ParsedMarkdown } from './parse';
import { MarkdownWriter, type SerializeOptions, type Writers } from './serialize';

/** CodecOptions are the parts that the extensions of the editor add to the Markdown of the editor. */
export interface CodecOptions {
  /** extensions are the Tiptap extensions of the document; the default is the core of the editor. */
  extensions?: AnyExtension[];
  /** schema is the schema of the document, for example the schema of a Tiptap editor; it replaces `extensions`. */
  schema?: Schema;
  /** markdownIt are the functions that add syntax to the markdown-it of the editor. */
  markdownIt?: MarkdownItExtension[];
  /** tokens maps the tokens of that syntax to nodes and marks of the document. */
  tokens?: Record<string, ParseSpec>;
  /** writers are the ways to write those nodes and marks as Markdown. */
  writers?: Writers;
  /**
   * rendered returns true for a token that a plugin of the level "render" shows (docs/plugins.md, R-GEN-012): its
   * top-level block stays one unit, a raw block that keeps its text.
   */
  rendered?: (token: Token) => boolean;
}

/** MarkdownCodec reads Markdown text into the document of the editor and writes the document back as Markdown text. */
export class MarkdownCodec {
  readonly schema: Schema;
  readonly md: MarkdownIt;
  private readonly reader: MarkdownReader;
  private readonly writer: MarkdownWriter;

  constructor(options: CodecOptions = {}) {
    this.schema = options.schema ?? getSchema(options.extensions ?? coreExtensions());
    this.md = createMarkdownIt(options.markdownIt);
    this.reader = new MarkdownReader(this.schema, this.md, options.tokens, options.rendered);
    this.writer = new MarkdownWriter(this.md.utils.normalizeReference, options.writers);
  }

  /**
   * parse returns the document of a Markdown text and the source of its blocks.
   * @param text - The text of the file.
   */
  parse(text: string): ParsedMarkdown {
    return this.reader.parse(text);
  }

  /**
   * serialize returns the Markdown text of a document. With the source of the text that the document was parsed from,
   * each top-level block that the user did not change keeps its text.
   * @param doc - The document.
   * @param source - The source of the parsed text, or undefined to write each block new.
   * @param options - How to write the document.
   */
  serialize(doc: Node, source?: MarkdownSource, options?: SerializeOptions): string {
    return this.writer.serialize(doc, source, options);
  }

  /**
   * rebased returns the Markdown text of a document and a source for this text in which each top-level block has its
   * text as written, without a new parse.
   * @param doc - The document.
   * @param source - The source of the text that the document holds now.
   */
  rebased(doc: Node, source: MarkdownSource): { text: string; source: MarkdownSource } {
    return this.writer.rebased(doc, source);
  }
}
