// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "handleDisabledFileLoadingAsSuccess": true } }

// The tests of the files that the page in the frame gets as blob: URLs (docs/rendering.md, R-LAYOUT-003): the scripts,
// the images and the addresses in the styles under the given addresses, also relative ones, and nothing else.

import { describe, expect, test } from 'vitest';
import { embedFiles } from './embed';

const webview = 'https://file%2B.vscode-resource.vscode-cdn.net/work/';

describe('the files of the page in the frame', () => {
  test('become blob: URLs under the given addresses, each loaded once, and the other addresses stay', async () => {
    const html = [
      '<!DOCTYPE html><html><head><base href="https://file+.vscode-resource.vscode-cdn.net/work/docs/">',
      '<style>@font-face { src: url("https://file+.vscode-resource.vscode-cdn.net/work/layouts/a/font.woff2"); } .x { background: url(https://example.com/b.png); }</style>',
      '</head><body><img src="logo.svg"><img src="../docs/logo.svg"><img src="https://example.com/c.png"><div style="background: url(\'missing.png\')"></div>',
      '<script nonce="abc" src="https://file+.vscode-resource.vscode-cdn.net/work/dist/paged.polyfill.js"></script></body></html>',
    ].join('');
    const loaded: string[] = [];
    const embedded = await embedFiles(html, [webview], async (url) => {
      loaded.push(url);
      return url.endsWith('missing.png') ? undefined : new Blob([url]);
    });
    expect(loaded.sort()).toEqual([
      'https://file+.vscode-resource.vscode-cdn.net/work/dist/paged.polyfill.js',
      'https://file+.vscode-resource.vscode-cdn.net/work/docs/logo.svg',
      'https://file+.vscode-resource.vscode-cdn.net/work/docs/missing.png',
      'https://file+.vscode-resource.vscode-cdn.net/work/layouts/a/font.woff2',
    ]);
    expect(embedded.urls).toHaveLength(3);
    // The script is read from the text, so that happy-dom does not try to load it.
    const script = /<script nonce="abc" src="(blob:[^"]+)"><\/script>/.exec(embedded.html);
    expect(script).not.toBeNull();
    const page = new DOMParser().parseFromString(embedded.html.replace(/<script[^>]*><\/script>/, ''), 'text/html');
    const images = [...page.querySelectorAll('img')].map((image) => image.getAttribute('src'));
    expect(images[0]).toMatch(/^blob:/);
    expect(images[1]).toBe(images[0]);
    expect(images[2]).toBe('https://example.com/c.png');
    const css = page.querySelector('style')?.textContent ?? '';
    expect(css).toMatch(/url\("blob:[^"]+"\)/);
    expect(css).toContain('url(https://example.com/b.png)');
    expect(page.querySelector('div')?.getAttribute('style')).toContain("url('missing.png')");
    expect(embedded.html.startsWith('<!DOCTYPE html>')).toBe(true);
  });
});
