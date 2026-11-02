// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The plugins of the renderer (docs/rendering.md, R-REN-002; docs/plugins.md, R-GEN-012, R-PLUGIN-001): a plugin adds
// syntax with `extendMarkdownIt(md)`, as in VS Code, so that a markdown-it plugin works in VS Code and in the renderer
// without a change. It may add styles, and a view for each new kind of token: the HTML of the markdown-it plugin, or a
// function `render(source, element, token)`. A plugin of the renderer is the level "render" of a plugin of the editor:
// the plugin object of the editor has the same members and adds the members of the level "render and edit".

import type Token from 'markdown-it/lib/token.mjs';
import type { MarkdownItExtension } from './markdownIt';

/** pluginApiVersion is the version of the plugin API of the renderer and of the editor. */
export const pluginApiVersion = 1;

/**
 * RenderFunction shows a token of a plugin in an element of a page (R-REN-002). It may return a function that removes
 * what it added, for example a listener.
 * @param source - The text of the token, for example the code of a diagram.
 * @param element - The empty element in place of the token: a `div` for a block, a `span` for an inline token.
 * @param token - The token of markdown-it.
 */
export type RenderFunction = (source: string, element: HTMLElement, token: Token) => void | (() => void);

/** RenderPlugin is a plugin of the renderer, and the level "render" of a plugin of the editor. */
export interface RenderPlugin {
  /** name names the plugin, of letters, digits, `_` and `-`; two plugins of a renderer have different names. */
  readonly name: string;
  /** apiVersion is the version of the plugin API that the plugin was written for. */
  readonly apiVersion: 1;
  /** extendMarkdownIt adds syntax to the markdown-it of the renderer, as `extendMarkdownIt` of the VS Code preview. */
  readonly extendMarkdownIt?: MarkdownItExtension;
  /** styles is the CSS of the plugin, which the page gets once. */
  readonly styles?: string;
  /**
   * render shows the kinds of tokens of the plugin in a page: by the type of a token that has no children, for example
   * `math_block`, or `fence:<language>` for a fenced code block, for example `fence:mermaid`. Without a page, the token
   * shows with the HTML of its rule of markdown-it.
   */
  readonly render?: Readonly<Record<string, RenderFunction>>;
}

/** fenceRender is the start of the key of `render` for a fenced code block with a language. */
export const fenceRender = 'fence:';

/** RenderParts are the parts of the plugins of a renderer, combined. */
export interface RenderParts {
  readonly markdownIt: MarkdownItExtension[];
  readonly renders: Map<string, RenderFunction>;
}

/**
 * checkPlugins checks that each plugin has a name of its own and the version 1 of the plugin API.
 * @param plugins - The plugins.
 * @param part - The part that the plugins are for, for the messages: `renderer` or `editor`.
 */
export function checkPlugins(plugins: readonly RenderPlugin[], part = 'renderer'): void {
  const names = new Set<string>();
  for (const plugin of plugins) {
    if (typeof plugin.name !== 'string' || !/^[A-Za-z][\w-]*$/.test(plugin.name)) {
      throw new Error(`A plugin of the ${part} needs a name of letters, digits, "_" and "-": ${String(plugin.name)}.`);
    }
    if (names.has(plugin.name)) {
      throw new Error(`The ${part} has two plugins with the name ${plugin.name}.`);
    }
    names.add(plugin.name);
    if (plugin.apiVersion !== pluginApiVersion) {
      throw new Error(`The plugin ${plugin.name} needs the plugin API version ${String(plugin.apiVersion)}; the ${part} has the version ${pluginApiVersion}.`);
    }
  }
}

/**
 * renderParts checks the plugins of a renderer and combines their parts; for the same kind of token, the function of a
 * later plugin wins.
 * @param plugins - The plugins, in their order.
 * @param part - The part that the plugins are for, for the messages.
 */
export function renderParts(plugins: readonly RenderPlugin[], part = 'renderer'): RenderParts {
  checkPlugins(plugins, part);
  const parts: RenderParts = { markdownIt: [], renders: new Map() };
  for (const plugin of plugins) {
    if (plugin.extendMarkdownIt) {
      parts.markdownIt.push(plugin.extendMarkdownIt);
    }
    for (const [kind, render] of Object.entries(plugin.render ?? {})) {
      parts.renders.set(kind, render);
    }
  }
  return parts;
}

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

/**
 * addStyles adds the CSS of the plugins to a page, once for each plugin: a later renderer or editor on the same page
 * finds the element of the styles of a plugin by its name.
 * @param plugins - The plugins.
 * @param page - The document of the page.
 * @param nonce - The nonce of the style elements, for a page whose policy allows only style elements with a nonce.
 */
export function addStyles(plugins: readonly RenderPlugin[], page: Document, nonce?: string): void {
  for (const plugin of plugins) {
    if (!plugin.styles || page.head.querySelector(`style[data-nsmd-plugin="${plugin.name}"]`)) {
      continue;
    }
    const style = page.createElement('style');
    style.dataset.nsmdPlugin = plugin.name;
    if (nonce) {
      style.setAttribute('nonce', nonce);
    }
    style.textContent = plugin.styles;
    page.head.append(style);
  }
}
