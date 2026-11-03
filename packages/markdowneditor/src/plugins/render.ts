// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The level "render" of the plugins (docs/plugins.md, R-GEN-012; docs/rendering.md, R-REN-002): a top-level block with a
// token that a plugin shows, or with a token that no node of the editor takes, is a raw block of the editor, which keeps
// its text byte for byte as one unit. The view of such a block shows its rendering by the renderer of the editor, the
// renderer of @nimblescape/markdownrender with the plugins of the editor (docs/specification.md, R-GEN-010): the HTML of
// markdown-it, and the function `render` of a plugin for each kind of token that the plugin shows. Raw HTML of the file
// shows as its text, as in the rest of the editor. The user switches the block between its rendering and its source,
// and the two never show at the same time: a double click or the button "Edit source" shows a field with the text of the
// block in the place of the rendering; leaving the field, Ctrl+Enter (Cmd+Enter on macOS) or the button "Show rendering"
// keeps the text and shows the rendering again, and Escape restores the text and shows the rendering. The editor then
// parses the block again. A raw block without a rendering, for example the definitions of link references, and a block of
// HTML show their text, and the field takes the place of the text in the same way.

import type { Node } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import type { MarkdownRenderer } from '@nimblescape/markdownrender';
import { button, element, icon } from '../ui/dom';

/** SourceViewHost is what the views of the blocks with a source need from the editor. */
export interface SourceViewHost {
  /** renderer returns the renderer of the raw blocks, the renderer of @nimblescape/markdownrender of the editor. */
  renderer(): MarkdownRenderer;
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
  private readonly done: HTMLButtonElement;
  private field: HTMLTextAreaElement | undefined;
  private close: ((keep: boolean) => void) | undefined;
  /** stale is true when the text of the block changed while its field was open, so its rendering is old. */
  private stale = false;
  private stopRender: () => void = () => undefined;

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
    // The button that shows the rendering again while the field is open; a button keeps the focus in the field on its
    // mousedown, so the field stays open until the click. show() gives it its name.
    this.done = button('Show rendering', icon('read'), () => this.close?.(true));
    this.done.classList.add('nsmd-unit-done');
    this.dom = element('div', { class: `nsmd-unit nsmd-unit-${kind}` }, this.shown, this.sourceText, edit, this.done);
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
    const label = rendered ? 'Show rendering' : 'Show text';
    this.done.title = label;
    this.done.setAttribute('aria-label', label);
    this.sourceText.textContent = rendered ? text : '';
    if (rendered) {
      this.shown.className = 'nsmd-unit-view nsmd-rendered';
      this.stopRender = this.host.renderer().render(text, this.shown);
    } else {
      this.shown.className = `nsmd-unit-view nsmd-raw nsmd-raw-${this.node.type.name === 'htmlBlock' ? 'html' : 'text'}`;
      this.shown.textContent = text;
    }
  }

  /** open shows the field of the source of the block in the place of its rendering. */
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
    this.shown.after(field);
    let done = false;
    const close = (keep: boolean) => {
      if (done) {
        return;
      }
      done = true;
      const text = field.value;
      this.field = undefined;
      this.close = undefined;
      field.remove();
      this.dom.classList.remove('nsmd-unit-editing');
      if (this.stale) {
        this.stale = false;
        this.show(sourceOf(this.node));
      }
      const pos = this.getPos();
      if (keep && text !== original && pos !== undefined) {
        this.host.commit(pos, text);
      } else {
        this.view.focus();
      }
    };
    this.close = close;
    field.addEventListener('input', () => {
      field.rows = Math.max(2, field.value.split('\n').length + 1);
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
    if (changed && this.field) {
      this.stale = true;
    } else if (changed) {
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
    return (
      target instanceof globalThis.Node &&
      (this.field?.contains(target) === true || (target instanceof Element && target.closest('.nsmd-unit-edit, .nsmd-unit-done') !== null))
    );
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
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
