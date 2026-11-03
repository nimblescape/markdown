// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the PDF (docs/rendering.md, R-LAYOUT-002): the finish of the PDF and the search for a browser, which
// come from the tests of nimblescape Markdown Paper, and the print of a page with a real browser: the page of the
// built-in layout `plain`, with a function of a plugin that the page registers itself, as the page of a PDF does. The
// print needs an installed browser; without one, the test of the print runs only in CI, where it must find one.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { describe, expect, test } from 'vitest';
import type { RenderPlugin } from '@nimblescape/markdownrender';
import { renderPage } from '../page';
import { createLayoutRenderer } from '../text';
import { candidates, findBrowser, NoBrowserError } from './browser';
import { fileHost, fileReader, metadataOf, pagedJsFile, printPage } from './export';
import { finishPdf } from './pdf';

test('the PDF loses the marks of the soft hyphens and keeps the rest of the text, and gets its metadata', async () => {
  const document = await PDFDocument.create();
  const page = document.addPage([200, 200]);
  const content = 'BT /F1 12 Tf 10 10 Td <0041> Tj /Span << /ActualText <FEFF00AD> >> BDC 5 0 Td <0042> Tj EMC <0043> Tj /Span<</ActualText<FEFF00AD>>>BDC <0044> Tj EMC ET';
  const stream = document.context.flateStream(content);
  page.node.set(PDFName.of('Contents'), document.context.register(stream));
  const finished = await PDFDocument.load(await finishPdf(await document.save(), { title: 'Agenten', author: 'Hannes Stauss', language: 'de-AT', subject: 'Eine Studie' }));
  const contents = finished.getPages()[0].node.get(PDFName.of('Contents'));
  const ref = contents instanceof PDFArray ? contents.get(0) : contents;
  const raw = finished.context.lookup(ref) as PDFRawStream;
  const text = Buffer.from(decodePDFRawStream(raw).decode()).toString('latin1');
  expect(text).not.toContain('FEFF00AD');
  expect(text).toContain('<0041> Tj');
  expect(text).toContain('5 0 Td');
  expect(text).not.toContain('<0042>');
  expect(text).toContain('<0043> Tj');
  expect(finished.getTitle()).toBe('Agenten');
  expect(finished.getAuthor()).toBe('Hannes Stauss');
  expect(finished.getSubject()).toBe('Eine Studie');
  expect(finished.getCreator()).toBe('nimblescape Markdown');
  const named = await PDFDocument.load(await finishPdf(await document.save(), { title: 'Agenten', creator: 'nimblescape Markdown Paper' }));
  expect(named.getCreator()).toBe('nimblescape Markdown Paper');
});

describe('the browser', () => {
  test('the search knows Chrome, Chromium and Edge on Windows, macOS and Linux', () => {
    const windows = candidates('win32', { PROGRAMFILES: 'C:\\Program Files', 'PROGRAMFILES(X86)': 'C:\\Program Files (x86)', LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' });
    expect(windows).toContain('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    expect(windows).toContain('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
    const mac = candidates('darwin', { HOME: '/Users/a' });
    expect(mac[0]).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    expect(mac).toContain('/Users/a/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
    const linux = candidates('linux', { PATH: ['/usr/bin', '/usr/local/bin'].join(path.delimiter) });
    expect(linux.slice(0, 3)).toEqual(['/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/usr/bin/google-chrome-stable']);
    expect(linux).toContain('/usr/bin/microsoft-edge');
  });

  test('a named program must exist, and the environment variable names a program', () => {
    expect(() => findBrowser('/no/such/browser')).toThrow('/no/such/browser does not exist');
    process.env.NIMBLESCAPE_TEST_BROWSER = '/no/such/browser';
    try {
      expect(() => findBrowser('', 'NIMBLESCAPE_TEST_BROWSER')).toThrow('/no/such/browser does not exist');
    } finally {
      delete process.env.NIMBLESCAPE_TEST_BROWSER;
    }
  });

  test('without a browser, the error says where to get one and names the environment variable', () => {
    const saved = process.env.PATH;
    process.env.PATH = '';
    try {
      let error: unknown;
      try {
        findBrowser();
      } catch (thrown) {
        error = thrown;
      }
      // A computer with a browser in one of the fixed places finds it without PATH.
      if (error !== undefined) {
        expect(error).toBeInstanceOf(NoBrowserError);
        expect(String(error)).toContain('https://www.google.com/chrome/');
        expect(String(error)).toContain('NIMBLESCAPE_BROWSER');
      }
    } finally {
      process.env.PATH = saved;
    }
  });
});

describe('the host of the disk', () => {
  test('reads the files of the disk by their file URLs, and nothing else', async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nimblescape-test-'));
    try {
      fs.writeFileSync(path.join(folder, 'a.txt'), 'A');
      expect(new TextDecoder().decode(await fileReader.read(pathToFileURL(path.join(folder, 'a.txt')).href))).toBe('A');
      expect(await fileReader.read(pathToFileURL(path.join(folder, 'b.txt')).href)).toBeUndefined();
      expect(await fileReader.read('https://example.com/a.txt')).toBeUndefined();
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  test('loads Paged.js of the installed package last, with a new nonce for each page', () => {
    expect(fs.existsSync(pagedJsFile())).toBe(true);
    const host = fileHost({ scripts: [{ text: 'void 0;' }], top: '/repo' });
    expect(host.scripts.at(-1)).toEqual({ src: pathToFileURL(pagedJsFile()).href });
    expect(host.scripts[0]).toEqual({ text: 'void 0;' });
    expect(host.top).toBe('file:///repo/');
    expect(host.sources).toBe('file:');
    expect(host.resource('file:///repo/a.png')).toBe('file:///repo/a.png');
    expect(host.nonce).not.toBe(fileHost().nonce);
  });
});

/** browser is the program of an installed browser, or undefined. */
const browser = ((): string | undefined => {
  try {
    return findBrowser();
  } catch {
    return undefined;
  }
})();

/** shout is a plugin whose function shows a fenced code block `shout` in capital letters. */
const shout: RenderPlugin = {
  name: 'shout',
  apiVersion: 1,
  render: {
    'fence:shout': (source, element) => {
      element.textContent = source.toUpperCase();
    },
  },
};

describe('the print of a page', () => {
  test.skipIf(!browser && !process.env.CI)('prints the pages in the size of the layout, with the metadata and the functions of the plugins in the page', { timeout: 60_000 }, async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nimblescape-test-'));
    try {
      const file = path.join(folder, 'paper.md');
      const text = ['---', 'title: A short paper', 'author: Hannes Stauss', 'subtitle: About the PDF', '---', '', '# Start', '', 'The text of the paper.', '', '```shout', 'hello', '```', ''].join('\n');
      fs.writeFileSync(file, text);
      const renderer = createLayoutRenderer({ plugins: [shout] });
      // The script of the page registers the function of the plugin, as a bundle with registerRenders does, and tells
      // the text that the function shows to the test.
      const register = "window.paperHandlers.addRender('fence:shout', (source, element) => { element.textContent = source.toUpperCase(); console.warn('shout: ' + element.textContent.trim()); });";
      const page = await renderPage(fileHost({ scripts: [{ text: register }] }), renderer, pathToFileURL(file).href, text);
      expect(page.problems).toEqual([]);
      expect(metadataOf(page)).toEqual({ title: 'A short paper', author: 'Hannes Stauss', subject: 'About the PDF', language: 'en-US' });
      const html = path.join(folder, 'copy', 'page.html');
      const printed = await printPage(page, { html });
      expect(fs.readFileSync(html, 'utf8')).toBe(page.html);
      expect(printed.messages).toEqual(['shout: HELLO']);
      const pdf = await PDFDocument.load(printed.pdf);
      expect(pdf.getTitle()).toBe('A short paper');
      expect(pdf.getAuthor()).toBe('Hannes Stauss');
      expect(pdf.getSubject()).toBe('About the PDF');
      expect(pdf.getCreator()).toBe('nimblescape Markdown');
      // The title block and the text on one page, in the size A4 of the layout: 210 mm × 297 mm in points.
      expect(pdf.getPageCount()).toBe(1);
      const { width, height } = pdf.getPage(0).getSize();
      expect(Math.round(width)).toBe(595);
      expect(Math.round(height)).toBe(842);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  test('refuses a page that waits for release', async () => {
    const page = await renderPage(fileHost(), createLayoutRenderer(), 'file:///repo/paper.md', '# Start\n', { hold: true });
    expect(page.held).toBe(true);
    await expect(printPage(page)).rejects.toThrow('without the option hold');
  });
});
