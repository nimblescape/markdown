// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The level "render" of the plugins (docs/plugins.md, R-GEN-012; docs/rendering.md, R-REN-002): a top-level block with a
// token that a plugin shows, or with a token that no node of the editor takes, is a raw block of the editor, which keeps
// its text byte for byte as one unit. The view of such a block shows its rendering: the HTML of markdown-it, with the
// plugins of the editor, and the function `render` of a plugin for each kind of token that the plugin shows. Raw HTML of
// the file shows as its text, as in the rest of the editor. The user changes the block through its source: a double
// click or the button "Edit source" opens a field with the text of the block below the rendering, which shows each
// change; leaving the field or Ctrl+Enter keeps the text, and Escape restores it. The editor then parses the block again.
// A raw block without a rendering, for example the definitions of link references, and a block of HTML show their text,
// and the field takes the place of the text.

import type { Node } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import type MarkdownIt from 'markdown-it';
import Renderer from 'markdown-it/lib/renderer.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { button, element, icon } from '../ui/dom';
import { fenceRender, type RenderFunction } from './api';

/**
 * renderOf returns the function of a plugin that shows a token, or undefined when no plugin shows it.
 * @param renders - The functions of the plugins by the kind of token.
 * @param token - The token.
 */
export function renderOf(renders: ReadonlyMap<string, RenderFunction>, token: Token): RenderFunction | undefined {
  if (token.type === 'fence') {
    const language = token.info.trim().split(/\s+/)[0];
    return language ? renders.get(`${fenceRender}${language}`) : undefined;
  }
  return token.nesting === 0 ? renders.get(token.type) : undefined;
}

/** withoutTrailingNewline returns a text without the line feed at its end. */
const withoutTrailingNewline = (text: string): string => (text.endsWith('\n') ? text.slice(0, -1) : text);

/** BlockRenderer shows the text of a raw block with the markdown-it of the editor and the plugins. */
export class BlockRenderer {
  private readonly renderer: Renderer;
  private placed: Token[] = [];

  /**
   * @param md - The markdown-it of the editor, with the syntax of the plugins.
   * @param renders - The functions of the plugins by the kind of token.
   */
  constructor(
    private readonly md: MarkdownIt,
    private readonly renders: ReadonlyMap<string, RenderFunction>,
  ) {
    const renderer = new Renderer();
    const rules: Renderer['rules'] = { ...md.renderer.rules };
    const escape = md.utils.escapeHtml;
    rules.html_block = (tokens, index) => `<pre class="nsmd-raw nsmd-raw-html">${escape(withoutTrailingNewline(tokens[index].content))}</pre>`;
    rules.html_inline = (tokens, index) => `<span class="nsmd-raw nsmd-raw-html">${escape(tokens[index].content)}</span>`;
    for (const kind of renders.keys()) {
      if (!kind.startsWith(fenceRender)) {
        rules[kind] = (tokens, index) => this.placeholder(tokens[index]);
      }
    }
    const fence = rules.fence;
    rules.fence = (tokens, index, options, env, self) =>
      renderOf(this.renders, tokens[index]) ? this.placeholder(tokens[index]) : (fence?.(tokens, index, options, env, self) ?? '');
    renderer.rules = rules;
    this.renderer = renderer;
  }

  /** placeholder returns the empty element in place of a token that a plugin shows, and remembers the token. */
  private placeholder(token: Token): string {
    const index = this.placed.push(token) - 1;
    const tag = token.block ? 'div' : 'span';
    return `<${tag} class="nsmd-render" data-nsmd-render="${index}"></${tag}>`;
  }

  /**
   * render shows the rendering of a text in an element, in place of what the element held.
   * @param text - The text of the block.
   * @param target - The element.
   * @returns A function that removes what the plugins added.
   */
  render(text: string, target: HTMLElement): () => void {
    const env = {};
    this.placed = [];
    let html: string;
    try {
      html = this.renderer.render(this.md.parse(text, env), this.md.options, env);
    } catch (error) {
      target.replaceChildren(element('pre', { class: 'nsmd-raw nsmd-render-error', title: String(error) }, text));
      return () => undefined;
    }
    const placed = this.placed;
    this.placed = [];
    target.innerHTML = html;
    const disposers: (() => void)[] = [];
    for (const slot of target.querySelectorAll<HTMLElement>('[data-nsmd-render]')) {
      const token = placed[Number(slot.dataset.nsmdRender)];
      const render = token ? renderOf(this.renders, token) : undefined;
      if (!token || !render) {
        continue;
      }
      try {
        const disposer = render(token.content, slot, token);
        if (typeof disposer === 'function') {
          disposers.push(disposer);
        }
      } catch (error) {
        slot.replaceChildren(element('code', { class: 'nsmd-render-error', title: String(error) }, token.content));
      }
    }
    return () => disposers.forEach((disposer) => disposer());
  }
}

/** SourceViewHost is what the views of the blocks with a source need from the editor. */
export interface SourceViewHost {
  /** renderer returns the renderer of the raw blocks. */
  renderer(): BlockRenderer;
  /**
   * commit gives a block a new text, which the editor parses again.
   * @param pos - The position of the block.
   * @param text - The new text of the block.
   */
  commit(pos: number, text: string): void;
}

/** sourceOf returns the text of a raw block or of a block of HTML. */
const sourceOf = (node: Node): string => (node.type.name === 'htmlBlock' ? (node.attrs.html as string) : (node.attrs.text as string)) ?? '';

/** isRendered is true for a raw block whose text a plugin or markdown-it shows. */
const isRendered = (node: Node): boolean => node.type.name === 'rawBlock' && node.attrs.rendered === true;

/** SourceView is the view of a raw block or of a block of HTML, with the field of its source. */
class SourceView implements NodeView {
  readonly dom: HTMLElement;
  private readonly shown: HTMLElement;
  private readonly sourceText: HTMLElement;
  private field: HTMLTextAreaElement | undefined;
  private stopRender: () => void = () => undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private node: Node,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly host: SourceViewHost,
  ) {
    const kind = node.type.name === 'htmlBlock' ? 'html' : 'text';
    this.shown = element('div', { class: 'nsmd-unit-view' });
    // In the mode to learn Markdown, the text of a rendered block shows below its rendering.
    this.sourceText = element('pre', { class: `nsmd-raw nsmd-raw-${kind} nsmd-unit-source`, 'aria-hidden': 'true' });
    const edit = button('Edit source', icon('source'), () => this.open());
    edit.classList.add('nsmd-unit-edit');
    this.dom = element('div', { class: `nsmd-unit nsmd-unit-${kind}` }, this.shown, this.sourceText, edit);
    this.dom.addEventListener('dblclick', (event) => {
      if (!this.field && this.view.editable) {
        event.preventDefault();
        this.open();
      }
    });
    this.show(sourceOf(node));
  }

  /** show shows a text of the block: its rendering, or the text itself. */
  private show(text: string): void {
    this.stopRender();
    this.stopRender = () => undefined;
    const rendered = isRendered(this.node);
    this.dom.classList.toggle('nsmd-unit-rendered', rendered);
    this.sourceText.textContent = rendered ? text : '';
    if (rendered) {
      this.shown.className = 'nsmd-unit-view nsmd-rendered';
      this.stopRender = this.host.renderer().render(text, this.shown);
    } else {
      this.shown.className = `nsmd-unit-view nsmd-raw nsmd-raw-${this.node.type.name === 'htmlBlock' ? 'html' : 'text'}`;
      this.shown.textContent = text;
    }
  }

  /** open opens the field of the source of the block. */
  private open(): void {
    if (this.field || !this.view.editable) {
      return;
    }
    const original = sourceOf(this.node);
    const field = element('textarea', { class: 'nsmd-unit-field', 'aria-label': 'Source of the block', spellcheck: 'false' });
    field.value = original;
    field.rows = Math.max(2, original.split('\n').length + 1);
    this.field = field;
    this.dom.classList.add('nsmd-unit-editing');
    this.dom.append(field);
    let done = false;
    const close = (keep: boolean) => {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(this.timer);
      const text = field.value;
      this.field = undefined;
      field.remove();
      this.dom.classList.remove('nsmd-unit-editing');
      this.show(original);
      const pos = this.getPos();
      if (keep && text !== original && pos !== undefined) {
        this.host.commit(pos, text);
      } else {
        this.view.focus();
      }
    };
    field.addEventListener('input', () => {
      field.rows = Math.max(2, field.value.split('\n').length + 1);
      if (isRendered(this.node)) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.show(field.value), 250);
      }
    });
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        close(true);
      }
    });
    field.addEventListener('blur', () => close(true));
    field.focus();
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) {
      return false;
    }
    const changed = node.attrs !== this.node.attrs && sourceOf(node) !== sourceOf(this.node);
    this.node = node;
    if (changed && !this.field) {
      this.show(sourceOf(node));
    }
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(event: Event): boolean {
    const target = event.target;
    return target instanceof globalThis.Node && (this.field?.contains(target) === true || (target instanceof Element && target.closest('.nsmd-unit-edit') !== null));
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    clearTimeout(this.timer);
    this.stopRender();
  }
}

/**
 * sourceViews returns the ProseMirror plugin with the views of the raw blocks and of the blocks of HTML.
 * @param host - What the views need from the editor.
 */
export function sourceViews(host: SourceViewHost): Plugin {
  const view = (node: Node, editorView: EditorView, getPos: () => number | undefined) => new SourceView(node, editorView, getPos, host);
  return new Plugin({ props: { nodeViews: { rawBlock: view, htmlBlock: view } } });
}
