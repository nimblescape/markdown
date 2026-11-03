// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The pages of a file that follow its text (docs/rendering.md, R-LAYOUT-003): the view "Pages" of an editor, in a
// browser and in a webview of VS Code. While the pages show, each change of the text of the source makes the page of
// the document again after a short pause, and the frame shows the new pages at the same place. A double click on a page
// gives the line of the file of the block under the pointer, so that the integrating code can go to that place in
// "Edit". The code of the integrating code shows and hides the frame; this code only follows the text while it shows.

import type { MarkdownRenderer } from '@nimblescape/markdownrender';
import type { TextSource } from '@nimblescape/markdowntext';
import { type Host, type Page, renderPage } from './page';
import { showPages, type PagesView } from './pages';

/**
 * lineAt returns the line of the file of the block at a node of the pages, counted from 0, or undefined for a node
 * outside the blocks of the text, for example on the title page. The renderer gives each block its line in the
 * attribute `data-line`, and Paged.js keeps it on the parts of a block on each page.
 * @param target - The node, for example the target of a double click.
 */
export function lineAt(target: EventTarget | null): number | undefined {
  // The node can be in the document of the frame, so the code asks for the type of the node and not for its class.
  const node = target as Node | null;
  const element = node && node.nodeType === 1 ? (node as Element) : (node?.parentElement ?? null);
  const block = element?.closest('[data-line]');
  const line = Number(block?.getAttribute('data-line'));
  return block && Number.isInteger(line) && line >= 0 ? line : undefined;
}

/**
 * offsetOfLine returns the place in a text where a line starts, or the end of the text for a line after its end.
 * @param text - The text.
 * @param line - The line, counted from 0.
 */
export function offsetOfLine(text: string, line: number): number {
  let offset = 0;
  for (let index = 0; index < line; index++) {
    const next = text.indexOf('\n', offset);
    if (next < 0) {
      return text.length;
    }
    offset = next + 1;
  }
  return offset;
}

/** PagePlace is a place of the text that the user chose on the pages. */
export interface PagePlace {
  /** line is the line of the file, counted from 0. */
  readonly line: number;
  /** offset is the place in the text of the source where the line starts. */
  readonly offset: number;
}

/** LivePagesOptions configure the pages that follow a text. */
export interface LivePagesOptions {
  /** host is the integrating code of the page (src/page.ts). */
  readonly host: Host;
  /** renderer is the renderer of the page, from createLayoutRenderer, with the plugins whose functions show their tokens. */
  readonly renderer: MarkdownRenderer;
  /** document is the URL of the file. */
  readonly document: string;
  /** source holds the text of the file. */
  readonly source: TextSource;
  /** embed are the starts of the addresses of the files that the page in the frame cannot load itself (showPages). */
  readonly embed?: readonly string[];
  /** delay is the pause in milliseconds after a change before the pages show again; the default is 600. */
  readonly delay?: number;
  /** env holds values that the plugins find in the environment of markdown-it. */
  readonly env?: Readonly<Record<string, unknown>>;
  /** onRendered is called with each page that the frame shows, for example for its problems. */
  readonly onRendered?: (page: Page) => void;
  /** onError is called when the page cannot be made, for example when a file of the layout cannot be read. */
  readonly onError?: (error: unknown) => void;
  /** onDoubleClick is called with the place of a double click on a block of the pages. */
  readonly onDoubleClick?: (place: PagePlace) => void;
}

/** LivePages shows the pages of a file in a frame and follows the changes of its text while they show. */
export class LivePages {
  private view: PagesView | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** version is the version of the source that the frame shows, or -1. */
  private version = -1;
  private stopFollowing: (() => void) | undefined;
  private disposed = false;

  /**
   * @param frame - The frame of the pages. It must have the origin of the page that holds it (showPages).
   * @param options - The options.
   */
  constructor(
    readonly frame: HTMLIFrameElement,
    private readonly options: LivePagesOptions,
  ) {}

  /** shown is true while the pages follow the text. */
  get shown(): boolean {
    return this.stopFollowing !== undefined;
  }

  /** show makes the pages of the text now, when the text changed since the last pages, and follows its changes. */
  show(): void {
    if (this.disposed || this.stopFollowing) {
      return;
    }
    const { source } = this.options;
    this.stopFollowing = source.onChange(() => this.schedule());
    if (this.version !== source.version) {
      void this.render();
    }
  }

  /** hide stops following the text; the frame keeps the last pages. */
  hide(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.stopFollowing?.();
    this.stopFollowing = undefined;
  }

  /** dispose stops the pages and removes what the plugins added to the frame. */
  dispose(): void {
    this.hide();
    this.disposed = true;
    this.view?.dispose();
    this.view = undefined;
  }

  /** schedule makes the pages again after the pause. */
  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.render(), this.options.delay ?? 600);
  }

  /** render makes the page of the text and shows it in the frame, at the place where the frame was. */
  private async render(): Promise<void> {
    const { source, host, renderer, document } = this.options;
    const version = source.version;
    let page: Page;
    try {
      page = await renderPage(host, renderer, document, source.text, { hold: true, ...(this.options.env ? { env: this.options.env } : {}) });
    } catch (error) {
      this.options.onError?.(error);
      return;
    }
    // A later change makes later pages; hidden pages wait until they show again.
    if (this.disposed || !this.stopFollowing || version !== source.version) {
      return;
    }
    const top = this.frame.contentWindow?.scrollY ?? 0;
    this.view?.dispose();
    // The next load of the frame is the load of the new page.
    const loaded = () => {
      this.frame.removeEventListener('load', loaded);
      this.frame.contentDocument?.addEventListener('dblclick', (event) => this.doubleClicked(event));
    };
    this.frame.addEventListener('load', loaded);
    const view = showPages(this.frame, page, renderer, this.options.embed ? { embed: this.options.embed } : {});
    this.view = view;
    this.version = version;
    view.rendered.then(
      () => {
        if (this.view === view) {
          this.frame.contentWindow?.scrollTo(0, top);
          this.options.onRendered?.(page);
        }
      },
      (error: unknown) => this.options.onError?.(error),
    );
  }

  /** doubleClicked gives the place of a double click on a block to the integrating code. */
  private doubleClicked(event: Event): void {
    const line = lineAt(event.target);
    if (line !== undefined && this.options.onDoubleClick) {
      event.preventDefault();
      this.options.onDoubleClick({ line, offset: offsetOfLine(this.options.source.text, line) });
    }
  }
}
