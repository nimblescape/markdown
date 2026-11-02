// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The view of the pages in a page of a browser or in a webview of VS Code (docs/rendering.md, R-LAYOUT-003): the page
// of the document in its layout (src/page.ts) in a frame, so that the style sheets of the layout change only the frame.
// The functions of the plugins show their tokens in the frame before Paged.js makes the pages: the page holds Paged.js
// (`hold`), the view fills the placeholders of the text with the renderer, and then releases Paged.js. The scripts of
// the page must be able to load in the frame: the integrating code gives their full addresses in the host.

import type { MarkdownRenderer } from '@nimblescape/markdownrender';
import type { Page } from './page';

/** PagesView is the view of the pages of a document in a frame. */
export interface PagesView {
  /** rendered resolves when Paged.js has made the pages, and rejects when the frame does not load. */
  readonly rendered: Promise<void>;
  /** dispose removes what the plugins added, and stops the view. */
  dispose(): void;
}

/** PagesWindow is the window of the frame, with the script of the layout. */
type PagesWindow = Window & { paperHandlers?: { release(): void }; paperRendered?: boolean };

/**
 * showPages shows the pages of a document in a frame, in place of what the frame showed.
 * @param frame - The frame. It must have the origin of the page that holds it, so it has no attribute `sandbox`
 *   without `allow-same-origin` and `allow-scripts`.
 * @param page - The page of the document, from renderPage with the option `hold`.
 * @param renderer - The renderer of the page, with the plugins whose functions show their tokens.
 */
export function showPages(frame: HTMLIFrameElement, page: Page, renderer: MarkdownRenderer): PagesView {
  let dispose: () => void = () => undefined;
  let stopped = false;
  const rendered = new Promise<void>((resolve, reject) => {
    const loaded = () => {
      frame.removeEventListener('load', loaded);
      const view = frame.contentWindow as PagesWindow | null;
      const text = frame.contentDocument?.querySelector('main.paper-text');
      if (stopped || !view || !text) {
        reject(new Error('The frame of the pages did not load the page.'));
        return;
      }
      view.document.addEventListener('paper-rendered', () => resolve(), { once: true });
      dispose = renderer.fill(text, { html: page.text.html, slots: page.text.slots });
      view.paperHandlers?.release();
      if (view.paperRendered) {
        resolve();
      }
    };
    frame.addEventListener('load', loaded);
  });
  frame.srcdoc = page.html;
  return {
    rendered,
    dispose: () => {
      stopped = true;
      dispose();
    },
  };
}
