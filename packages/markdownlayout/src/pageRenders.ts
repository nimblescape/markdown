// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The functions of the plugins in the page itself (docs/rendering.md, R-LAYOUT-002): the page of the PDF has no
// integrating code that fills the placeholders of the text with the renderer, as the view of the pages does
// (src/pages.ts). So the page holds the data of its placeholders, the slots, as JSON in the element
// `script#nsmd-render-slots`, and a script of the page registers the functions of the plugins with the script of the
// layout (src/page/handlers.js). After the page has loaded, the script of the layout fills each placeholder whose kind
// has a function, as the renderer does, and then Paged.js makes the pages. A page with `hold` leaves the placeholders to
// the integrating code. The integrating code bundles the script of the page with the same plugins as its renderer:
//
//   import { registerRenders } from '@nimblescape/markdownlayout';
//   registerRenders(plugins);
//
// In the page, a function of a plugin gets a copy of the data of its token: the fields of the token of markdown-it,
// with `meta` when it is JSON, and the methods attrIndex and attrGet.

import { renderParts, type RenderFunction, type RenderPlugin, type RenderSlot } from '@nimblescape/markdownrender';

/** slotsId is the ID of the element of the page with the slots of the placeholders. */
export const slotsId = 'nsmd-render-slots';

/** TokenData is the data of a token of markdown-it, as the page holds it. */
export interface TokenData {
  type: string;
  tag: string;
  attrs: [string, string][] | null;
  map: [number, number] | null;
  nesting: number;
  level: number;
  children: TokenData[] | null;
  content: string;
  markup: string;
  info: string;
  meta: unknown;
  block: boolean;
  hidden: boolean;
}

/** jsonOf returns a value that JSON can hold, or null. */
function jsonOf(value: unknown): unknown {
  try {
    return value === undefined ? null : (JSON.parse(JSON.stringify(value)) as unknown);
  } catch {
    return null;
  }
}

/**
 * tokenData returns the data of a token, with the data of its children.
 * @param token - The token.
 */
export function tokenData(token: RenderSlot['token']): TokenData {
  return {
    type: token.type,
    tag: token.tag,
    attrs: token.attrs ? token.attrs.map(([name, value]) => [name, value]) : null,
    map: token.map ? [token.map[0], token.map[1]] : null,
    nesting: token.nesting,
    level: token.level,
    children: token.children ? token.children.map(tokenData) : null,
    content: token.content,
    markup: token.markup,
    info: token.info,
    meta: jsonOf(token.meta),
    block: token.block,
    hidden: token.hidden,
  };
}

/**
 * slotsHtml returns the element of the page with the slots of the placeholders, or an empty text without slots. The
 * JSON writes `<` as `\u003c`, so that the text of the element cannot end it.
 * @param slots - The slots of the rendering.
 */
export function slotsHtml(slots: readonly RenderSlot[]): string {
  if (slots.length === 0) {
    return '';
  }
  const json = JSON.stringify(slots.map((slot) => ({ kind: slot.kind, source: slot.source, token: tokenData(slot.token) })));
  return `<script type="application/json" id="${slotsId}">${json.replace(/</g, '\\u003c')}</script>`;
}

/** PageHandlers is the part of the script of the layout in the page that takes the functions of the plugins. */
interface PageHandlers {
  addRender(kind: string, render: RenderFunction): void;
}

/**
 * registerRenders registers the functions of plugins with the script of the layout in a page, so that the page shows
 * the tokens of the plugins before Paged.js makes the pages. It runs in the page, in a script before Paged.js; for the
 * same kind of token, the function of a later plugin wins, as in the renderer.
 * @param plugins - The plugins, in the order of the renderer.
 * @param view - The window of the page.
 * @throws When the page has no script of the layout, or a plugin is not valid.
 */
export function registerRenders(plugins: readonly RenderPlugin[], view: Window = window): void {
  const handlers = (view as Window & { paperHandlers?: PageHandlers }).paperHandlers;
  if (!handlers) {
    throw new Error('The page has no script of the layout: registerRenders runs in the page of renderPage.');
  }
  for (const [kind, render] of renderParts(plugins).renders) {
    handlers.addRender(kind, render);
  }
}
