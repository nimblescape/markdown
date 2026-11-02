// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The PDF of a file of the disk (docs/rendering.md, R-LAYOUT-002), for the command line and for an extension of
// VS Code: the host of the disk gives the page the files of the disk by their file URLs and the script of Paged.js of
// the installed package pagedjs, renderPage makes the page, and printPage prints it with an installed browser and
// writes the metadata. The page of the PDF is the page of the view of the pages, without `hold`: the functions of the
// plugins show their tokens in the page itself, from a script of the page that registers them (src/pageRenders.ts).
// The module runs in Node.js.

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Host, LayoutPlaces, Page, Reader, Script } from '../page';
import { findBrowser } from './browser';
import { finishPdf, type Metadata, printPdf, type PrintResult } from './pdf';

/** fileReader reads the files of the disk by their file URLs. */
export const fileReader: Reader = {
  async read(url) {
    if (!url.startsWith('file:')) {
      return undefined;
    }
    try {
      return new Uint8Array(await fs.promises.readFile(fileURLToPath(url)));
    } catch {
      return undefined;
    }
  },
};

/**
 * folderUrl returns the file URL of a folder, with a slash at its end.
 * @param folder - The path of the folder.
 */
export const folderUrl = (folder: string): string => {
  const url = pathToFileURL(folder).href;
  return url.endsWith('/') ? url : `${url}/`;
};

/** pagedJsFile returns the path of the script of Paged.js, `dist/paged.polyfill.js` of the installed package pagedjs. */
export function pagedJsFile(): string {
  // The exports of the package pagedjs name no file of dist/, so the path starts at its main module, lib/index.cjs.
  return path.join(path.dirname(createRequire(import.meta.url).resolve('pagedjs')), '..', 'dist', 'paged.polyfill.js');
}

/** FileHostOptions are the options of the host of the disk. */
export interface FileHostOptions {
  /** top is the path of the top folder of the search for a layout, for example the folder of the workspace. */
  top?: string;
  /** builtinLayouts is the path of a folder of more built-in layouts. */
  builtinLayouts?: string;
  /** findLayout finds the folder of a layout that only the integrating code knows (LayoutPlaces). */
  findLayout?: LayoutPlaces['findLayout'];
  /**
   * scripts are the scripts of the page before Paged.js, with file URLs, for example the script that registers the
   * functions of the plugins (registerRenders) and the scripts of the drawings of plugins.
   */
  scripts?: Script[];
  /** styles are style sheets as texts before the style sheets of the layout, for example of the drawings of plugins. */
  styles?: string[];
}

/**
 * fileHost returns the host of a page that a browser loads from the disk: the page loads the files by their file URLs,
 * and Paged.js from the installed package pagedjs.
 * @param options - The options.
 */
export function fileHost(options: FileHostOptions = {}): Host {
  return {
    reader: fileReader,
    ...(options.top ? { top: folderUrl(options.top) } : {}),
    ...(options.builtinLayouts ? { builtinLayouts: folderUrl(options.builtinLayouts) } : {}),
    ...(options.findLayout ? { findLayout: options.findLayout } : {}),
    resource: (url) => url,
    sources: 'file:',
    scripts: [...(options.scripts ?? []), { src: pathToFileURL(pagedJsFile()).href }],
    ...(options.styles ? { styles: options.styles } : {}),
    nonce: randomBytes(16).toString('base64'),
  };
}

/**
 * metadataOf returns the metadata of the PDF of a page: the title, the field `author`, the field `subtitle` as the
 * subject, and the language of the layout.
 * @param page - The page.
 */
export function metadataOf(page: Page): Metadata {
  const author = page.values.author?.trim();
  const subject = page.values.subtitle?.trim();
  return { title: page.title, ...(author ? { author } : {}), ...(subject ? { subject } : {}), language: page.layout.language };
}

/** PrintOptions are the options of the print of a page. */
export interface PrintOptions {
  /** browser is the path of the program of the browser; empty searches an installed browser (findBrowser). */
  browser?: string;
  /** timeout is the longest time in milliseconds that each step of the browser may need. */
  timeout?: number;
  /** html is the path of a file for a copy of the HTML page, for a look at the page; undefined keeps none. */
  html?: string;
  /** creator and producer name the programs in the metadata of the PDF. */
  creator?: string;
  producer?: string;
}

/**
 * printPage prints the page of a document to a PDF, with its metadata: the page is written to a file in a new
 * temporary folder, which the browser loads, and the folder is removed afterwards.
 * @param page - The page, from renderPage with the host of the disk and without the option `hold`.
 * @param options - The options.
 * @throws When the page waits for `release`, when no browser is found (a NoBrowserError), or when the browser fails.
 */
export async function printPage(page: Page, options: PrintOptions = {}): Promise<PrintResult> {
  if (page.held) {
    throw new Error('The page of a PDF must not wait for release: make it with renderPage without the option hold.');
  }
  const program = findBrowser(options.browser);
  const folder = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'nimblescape-page-'));
  try {
    const html = path.join(folder, 'page.html');
    await fs.promises.writeFile(html, page.html, 'utf8');
    if (options.html) {
      await fs.promises.mkdir(path.dirname(options.html), { recursive: true });
      await fs.promises.copyFile(html, options.html);
    }
    const printed = await printPdf(program, html, options.timeout);
    const metadata: Metadata = {
      ...metadataOf(page),
      ...(options.creator ? { creator: options.creator } : {}),
      ...(options.producer ? { producer: options.producer } : {}),
    };
    return { pdf: await finishPdf(printed.pdf, metadata), messages: printed.messages };
  } finally {
    await fs.promises.rm(folder, { recursive: true, force: true });
  }
}
