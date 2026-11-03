// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// @vitest-environment happy-dom

// The tests of the pages that follow the text (docs/rendering.md, R-LAYOUT-003): the line of a block of the pages, the
// place of a line in the text, the pages in a frame that follow the changes of the text while they show, and the place
// of a double click. The frame of happy-dom loads the page without Paged.js, so the tests look at the text of the page.

import { TextSource } from '@nimblescape/markdowntext';
import { afterEach, describe, expect, test } from 'vitest';
import { lineAt, LivePages, offsetOfLine, type PagePlace } from './livePages';
import type { Host } from './page';
import { createLayoutRenderer } from './text';

/** host is a host for the tests, without files. */
const host: Host = { reader: { read: async () => undefined }, resource: (url) => url, sources: 'file:', scripts: [], nonce: 'abc' };

/** wait waits for a time, or for the next turn. */
const wait = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/** until waits until a test is true, at the latest one second. */
async function until(test: () => boolean): Promise<void> {
  for (let round = 0; round < 100 && !test(); round++) {
    await wait(10);
  }
  expect(test()).toBe(true);
}

const pages: LivePages[] = [];
afterEach(() => {
  pages.forEach((each) => each.dispose());
  pages.length = 0;
  document.body.replaceChildren();
});

describe('the place of a block', () => {
  test('lineAt gives the line of the block of a node, also of a text node, and nothing outside the blocks', () => {
    document.body.innerHTML = '<header><p>Title</p></header><div data-line="4"><p data-line="6">Some <b>bold</b> text</p></div>';
    const bold = document.querySelector('b');
    expect(lineAt(bold)).toBe(6);
    expect(lineAt(bold?.firstChild ?? null)).toBe(6);
    expect(lineAt(document.querySelector('div'))).toBe(4);
    expect(lineAt(document.querySelector('header p'))).toBeUndefined();
    expect(lineAt(null)).toBeUndefined();
  });

  test('offsetOfLine gives the place where a line starts, and the end of the text after its last line', () => {
    const text = '---\ntitle: A\n---\n\n# Start\n';
    expect(offsetOfLine(text, 0)).toBe(0);
    expect(offsetOfLine(text, 4)).toBe(text.indexOf('# Start'));
    expect(offsetOfLine(text, 5)).toBe(text.length);
    expect(offsetOfLine(text, 9)).toBe(text.length);
  });
});

describe('the pages that follow the text', () => {
  test('show the text, follow its changes while they show, and give the place of a double click', async () => {
    const source = new TextSource('# Start\n\nThe first text.\n');
    const frame = document.createElement('iframe');
    frame.srcdoc = '';
    document.body.append(frame);
    const places: PagePlace[] = [];
    const live = new LivePages(frame, { host, renderer: createLayoutRenderer(), document: 'file:///repo/paper.md', source, delay: 20, onDoubleClick: (place) => places.push(place) });
    pages.push(live);
    expect(live.shown).toBe(false);
    live.show();
    expect(live.shown).toBe(true);
    // The text of the pages, without the soft hyphens of the layout.
    const body = () => (frame.contentDocument?.querySelector('main.paper-text')?.textContent ?? '').replace(/\u00ad/g, '');
    await until(() => body().includes('The first text.'));
    source.setText('# Start\n\nThe second text.\n', { kind: 'program' });
    await until(() => body().includes('The second text.'));
    // The double click on the paragraph gives its line and the place of the line in the text; the frame of happy-dom
    // shows the text before it tells that it loaded.
    await wait(50);
    const paragraph = frame.contentDocument?.querySelector('main.paper-text p');
    paragraph?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(places).toEqual([{ line: 2, offset: source.text.indexOf('The second') }]);
    // Hidden pages keep the last pages and make new pages only when they show again.
    live.hide();
    source.setText('# Start\n\nThe third text.\n', { kind: 'program' });
    await wait(60);
    expect(body()).toContain('The second text.');
    live.show();
    await until(() => body().includes('The third text.'));
  });

  test('give an error of the page to the integrating code', async () => {
    const errors: unknown[] = [];
    const failing: Host = { ...host, reader: { read: () => Promise.reject(new Error('The disk failed.')) } };
    const frame = document.createElement('iframe');
    frame.srcdoc = '';
    document.body.append(frame);
    const live = new LivePages(frame, { host: failing, renderer: createLayoutRenderer(), document: 'file:///repo/paper.md', source: new TextSource('---\nlayout: thesis\n---\n# Start\n'), onError: (error) => errors.push(error) });
    pages.push(live);
    live.show();
    await until(() => errors.length === 1);
    expect(String(errors[0])).toContain('The disk failed.');
  });
});
