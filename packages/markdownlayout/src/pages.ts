// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The view of the pages in a page of a browser or in a webview of VS Code (docs/rendering.md, R-LAYOUT-003): the page
// of the document in its layout (src/page.ts) in a frame, so that the style sheets of the layout change only the frame.
// The functions of the plugins show their tokens in the frame before Paged.js makes the pages: the page holds Paged.js
// (`hold`), the view fills the placeholders of the text with the renderer, and then releases Paged.js. The scripts of
// the page must be able to load in the frame: the integrating code gives their full addresses in the host.
//
// The frame shows the page with `srcdoc`. With the option `embed`, the view first loads the files of the page under
// these addresses and gives the page their contents as `blob:` URLs (src/embed.ts), for a webview of VS Code, which
// gives its files only to its own page.

import type { MarkdownRenderer } from '@nimblescape/markdownrender';
import { embedFiles } from './embed';
import type { Page } from './page';

/** PagesView is the view of the pages of a document in a frame. */
export interface PagesView {
  /** rendered resolves when Paged.js has made the pages, and rejects when the frame does not load. */
  readonly rendered: Promise<void>;
  /** dispose removes what the plugins added, and stops the view. */
  dispose(): void;
}

/** ShowPagesOptions are the options of the view of the pages. */
export interface ShowPagesOptions {
  /**
   * embed are the starts of the addresses of the files that the page in the frame cannot load itself, for example the
   * addresses of the files of a webview of VS Code: the view loads them and gives the page their contents.
   */
  readonly embed?: readonly string[];
}

/** PagesWindow is the window of the frame, with the script of the layout. */
type PagesWindow = Window & { paperHandlers?: { release(): void }; paperRendered?: boolean };

/**
 * showPages shows the pages of a document in a frame, in place of what the frame showed.
 * @param frame - The frame. It must have the origin of the page that holds it, so it has no attribute `sandbox`
 *   without `allow-same-origin` and `allow-scripts`.
 * @param page - The page of the document, from renderPage with the option `hold`.
 * @param renderer - The renderer of the page, with the plugins whose functions show their tokens.
 * @param options - The options of the view.
 */
export function showPages(frame: HTMLIFrameElement, page: Page, renderer: MarkdownRenderer, options: ShowPagesOptions = {}): PagesView {
  let dispose: () => void = () => undefined;
  let stopped = false;
  let urls: readonly string[] = [];
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
    if (!options.embed) {
      frame.srcdoc = page.html;
      return;
    }
    embedFiles(page.html, options.embed).then(
      (embedded) => {
        urls = embedded.urls;
        if (stopped) {
          urls.forEach((url) => URL.revokeObjectURL(url));
        } else {
          frame.srcdoc = embedded.html;
        }
      },
      (error: unknown) => {
        frame.removeEventListener('load', loaded);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
  return {
    rendered,
    dispose: () => {
      stopped = true;
      dispose();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls = [];
    },
  };
}
