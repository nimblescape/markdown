// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The renderer (docs/rendering.md, R-REN-001 to R-REN-003): it turns the text of a file into HTML without edit
// functions, with markdown-it 14 and the plugins of the renderer. It needs no editor and no page: `toHtml` returns the
// HTML as a string, for example for a command line. In a page, `render` writes the HTML into an element and shows each
// token that a plugin shows with the function `render` of the plugin; without a page, such a token shows with the HTML
// of its rule of markdown-it. The front matter of the file is no part of the rendering; the line numbers of the blocks
// stay the lines of the file. The editor shows each block that it keeps as one unit with this renderer
// (docs/specification.md, R-GEN-010).

import { frontMatterOf } from '@nimblescape/markdowntext';
import type MarkdownIt from 'markdown-it';
import Renderer from 'markdown-it/lib/renderer.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { createMarkdownIt, type FootnotePlace } from './markdownIt';
import { alertTitles, alertTitleType, columnsType, prepareOutput, type AlertKind } from './output';
import { addStyles, fenceRender, renderOf, renderParts, type RenderFunction, type RenderPlugin } from './plugins';
import { closeOpen, openCount, rawHtmlRules, type RawHtml } from './rawHtml';

/** RendererOptions are the options of a renderer. */
export interface RendererOptions {
  /** plugins are the plugins of the renderer (R-REN-002). */
  readonly plugins?: readonly RenderPlugin[];
  /**
   * markdownIt is a markdown-it with the syntax of nimblescape Markdown and of the plugins, from createMarkdownIt, for
   * example the one of an editor; without it, the renderer makes its own with the syntax of its plugins.
   */
  readonly markdownIt?: MarkdownIt;
  /** footnotes is where the definitions of the footnotes show, for the markdown-it of the renderer; default `end`. */
  readonly footnotes?: FootnotePlace;
  /** rawHtml is how the raw HTML of the file shows; the default is `safe` (src/rawHtml.ts). */
  readonly rawHtml?: RawHtml;
  /** headingIds gives each heading the ID that GitHub gives it; the default is true. */
  readonly headingIds?: boolean;
  /** lines gives each block the line of the file where it starts, `data-line`; the default is true. */
  readonly lines?: boolean;
  /**
   * frontMatter is `skip` when the text is a whole file, whose front matter is no part of the rendering (the default),
   * or `text` when the text is a part of a file, whose first lines are text.
   */
  readonly frontMatter?: 'skip' | 'text';
}

/** RenderSlot is a token that a plugin shows in a page, at its placeholder in the HTML. */
export interface RenderSlot {
  /** kind is the key of the function of the plugin: the type of the token, or `fence:<language>`. */
  readonly kind: string;
  /** source is the text of the token. */
  readonly source: string;
  /** token is the token of markdown-it. */
  readonly token: Token;
}

/** Rendering is the HTML of a text and the tokens that plugins show in a page. */
export interface Rendering {
  /**
   * html is the HTML. Each token that a plugin shows is an element `.nsmd-render` with the attribute
   * `data-nsmd-render`, the index of its slot, around the HTML of its rule of markdown-it.
   */
  readonly html: string;
  /** slots are the tokens that plugins show, by the index of their placeholders. */
  readonly slots: readonly RenderSlot[];
}

/** withoutFrontMatter returns a text without its byte order mark, with blank lines in place of its front matter. */
function withoutFrontMatter(text: string): string {
  const body = text.startsWith('\ufeff') ? text.slice(1) : text;
  const lines = body.split('\n');
  const front = frontMatterOf(lines.map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line)));
  return front ? [...Array<string>(front.lines).fill(''), ...lines.slice(front.lines)].join('\n') : body;
}

/** MarkdownRenderer turns the text of a file into HTML without edit functions. */
export class MarkdownRenderer {
  /** markdownIt is the markdown-it of the renderer, with the syntax of nimblescape Markdown and of the plugins. */
  readonly markdownIt: MarkdownIt;
  /** plugins are the plugins of the renderer. */
  readonly plugins: readonly RenderPlugin[];
  private readonly renders: Map<string, RenderFunction>;
  private readonly renderer: Renderer;
  private readonly options: RendererOptions;
  private slots: RenderSlot[] = [];

  /**
   * @param options - The options of the renderer.
   * @param part - The part that the plugins are for, for the messages of their check: `renderer` or `editor`.
   */
  constructor(options: RendererOptions = {}, part = 'renderer') {
    this.options = options;
    this.plugins = options.plugins ?? [];
    const parts = renderParts(this.plugins, part);
    this.renders = parts.renders;
    this.markdownIt = options.markdownIt ?? createMarkdownIt(parts.markdownIt, { footnotes: options.footnotes });
    const md = this.markdownIt;
    const rules: Renderer['rules'] = { ...md.renderer.rules };
    rawHtmlRules(rules, md, options.rawHtml ?? 'safe');
    const escape = md.utils.escapeHtml;
    rules[alertTitleType] = (tokens, index) => `<p class="markdown-alert-title">${alertTitles[(tokens[index].meta as { kind: AlertKind }).kind]}</p>\n`;
    rules[columnsType] = (tokens, index) =>
      `<colgroup>${(tokens[index].meta as { widths: number[] }).widths.map((width) => `<col style="width: ${width}%">`).join('')}</colgroup>\n`;
    for (const kind of this.renders.keys()) {
      if (!kind.startsWith(fenceRender)) {
        const own = rules[kind];
        rules[kind] = (tokens, index, ruleOptions, env, self) =>
          this.placeholder(tokens[index], kind, own ? own(tokens, index, ruleOptions, env, self) : `<code>${escape(tokens[index].content)}</code>`);
      }
    }
    const fence = rules.fence;
    rules.fence = (tokens, index, ruleOptions, env, self) => {
      const token = tokens[index];
      const html = fence?.(tokens, index, ruleOptions, env, self) ?? '';
      return renderOf(this.renders, token) ? this.placeholder(token, `${fenceRender}${token.info.trim().split(/\s+/)[0]}`, html) : html;
    };
    const renderer = new Renderer();
    renderer.rules = rules;
    // The elements that the raw HTML of a paragraph leaves open end with the paragraph (src/rawHtml.ts).
    const renderInline = renderer.renderInline.bind(renderer);
    renderer.renderInline = (tokens, inlineOptions, env: object) => {
      const count = openCount(env);
      return renderInline(tokens, inlineOptions, env) + closeOpen(env, count);
    };
    this.renderer = renderer;
  }

  /** placeholder returns the element in place of a token that a plugin shows, around its HTML, and keeps the slot. */
  private placeholder(token: Token, kind: string, html: string): string {
    const index = this.slots.push({ kind, source: token.content, token }) - 1;
    const tag = token.block ? 'div' : 'span';
    return `<${tag} class="nsmd-render" data-nsmd-render="${index}">${html}</${tag}>${token.block ? '\n' : ''}`;
  }

  /**
   * parse returns the tokens of a text in the form of the output of the renderer.
   * @param text - The text.
   * @param env - The environment of markdown-it, which plugins may read, as in the Markdown preview of VS Code.
   */
  parse(text: string, env: Record<string, unknown> = {}): Token[] {
    const tokens = this.markdownIt.parse(this.options.frontMatter === 'text' ? text : withoutFrontMatter(text), env);
    prepareOutput(tokens, this.options);
    return tokens;
  }

  /**
   * toHtml returns the HTML of a text, without a page.
   * @param text - The text.
   * @param env - The environment of markdown-it.
   */
  toHtml(text: string, env: Record<string, unknown> = {}): Rendering {
    const saved = this.slots;
    this.slots = [];
    try {
      const html = this.renderer.render(this.parse(text, env), this.markdownIt.options, env) + closeOpen(env);
      return { html, slots: this.slots };
    } finally {
      this.slots = saved;
    }
  }

  /**
   * fill shows the tokens of a rendering that plugins show, in the HTML of the rendering in a page: each placeholder
   * becomes empty, and the function of its plugin shows the token in it.
   * @param target - The element that holds the HTML of the rendering.
   * @param rendering - The rendering.
   * @returns A function that removes what the plugins added.
   */
  fill(target: ParentNode, rendering: Rendering): () => void {
    const disposers: (() => void)[] = [];
    for (const element of target.querySelectorAll<HTMLElement>('[data-nsmd-render]')) {
      const slot = rendering.slots[Number(element.dataset.nsmdRender)];
      const render = slot ? renderOf(this.renders, slot.token) : undefined;
      if (!slot || !render) {
        continue;
      }
      element.replaceChildren();
      try {
        const disposer = render(slot.source, element, slot.token);
        if (typeof disposer === 'function') {
          disposers.push(disposer);
        }
      } catch (error) {
        const code = element.ownerDocument.createElement('code');
        code.className = 'nsmd-render-error';
        code.title = String(error);
        code.textContent = slot.source;
        element.replaceChildren(code);
      }
    }
    return () => disposers.forEach((disposer) => disposer());
  }

  /**
   * render shows the rendering of a text in an element of a page, in place of what the element held, and adds the
   * styles of the plugins to the page.
   * @param text - The text.
   * @param target - The element.
   * @param env - The environment of markdown-it.
   * @returns A function that removes what the plugins added.
   */
  render(text: string, target: HTMLElement, env: Record<string, unknown> = {}): () => void {
    addStyles(this.plugins, target.ownerDocument);
    let rendering: Rendering;
    try {
      rendering = this.toHtml(text, env);
    } catch (error) {
      const pre = target.ownerDocument.createElement('pre');
      pre.className = 'nsmd-raw nsmd-render-error';
      pre.title = String(error);
      pre.textContent = text;
      target.replaceChildren(pre);
      return () => undefined;
    }
    target.innerHTML = rendering.html;
    return this.fill(target, rendering);
  }
}
