// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The HTML of the page of the webview (docs/platforms.md, R-VSC-001, R-VSC-003). The policy of the content allows only
// the script of the extension with a random nonce, the style sheets and fonts of the extension, and images from the
// folder of the file, from https and as data. Styles in attributes stay allowed, because the editor sets some, for
// example the alignment of the cells of a table. The base of the page is the folder of the file, so that an image with
// a relative path shows. The page has the element of the editor and the frame of the pages (docs/rendering.md,
// R-LAYOUT-003), which shows instead of the editor in the view "Pages": the page in the frame has the same policy and
// uses the same nonce, and it gets its files as blob: URLs, so images and fonts may also be blobs and data.

import type * as vscode from 'vscode';
import { editorElementId, pagesElementId } from '../messages';

/** PageOptions are the parts of the page of the webview. */
export interface PageOptions {
  /** webview is the webview of the page. */
  readonly webview: vscode.Webview;
  /** script is the script of the page. */
  readonly script: vscode.Uri;
  /** styles are the style sheets of the page. */
  readonly styles: readonly vscode.Uri[];
  /** base is the folder of the file, or undefined for a file without a folder, for example a new file. */
  readonly base?: vscode.Uri;
  /** language is the language of VS Code, for example `en`. */
  readonly language: string;
  /** title is the title of the page, the name of the file. */
  readonly title: string;
  /** nonce is the random value that allows the script. */
  readonly nonce: string;
}

/** escaped returns a text for the content or an attribute of HTML. */
export function escaped(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** newNonce returns a random value of 128 bits for the policy of the content. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * pageHtml returns the HTML of the page of the webview.
 * @param options - The parts of the page.
 */
export function pageHtml(options: PageOptions): string {
  const { webview, nonce } = options;
  const source = webview.cspSource;
  const policy = [
    "default-src 'none'",
    `img-src ${source} https: data: blob:`,
    `media-src ${source} https:`,
    `style-src ${source} 'unsafe-inline'`,
    `font-src ${source} data: blob:`,
    `script-src 'nonce-${nonce}'`,
    // The view of the pages loads the files of the webview for the page in its frame.
    `connect-src ${source}`,
  ].join('; ');
  const uri = (resource: vscode.Uri) => escaped(webview.asWebviewUri(resource).toString());
  const base = options.base ? `\n    <base href="${uri(options.base)}/">` : '';
  const styles = options.styles.map((style) => `\n    <link rel="stylesheet" href="${uri(style)}">`).join('');
  return `<!DOCTYPE html>
<html lang="${escaped(options.language)}">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${escaped(policy)}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">${base}${styles}
    <title>${escaped(options.title)}</title>
  </head>
  <body>
    <div id="${editorElementId}"></div>
    <iframe id="${pagesElementId}" title="Pages" hidden></iframe>
    <script nonce="${nonce}" src="${uri(options.script)}"></script>
  </body>
</html>
`;
}
