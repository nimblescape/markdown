// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// @vitest-environment happy-dom

// The tests of the functions of the plugins in the page itself (docs/rendering.md, R-LAYOUT-002): the page holds the
// slots of its placeholders as JSON, a script of the page registers the functions of the plugins, and the script of the
// layout fills the placeholders as the renderer does, also when a function fails.

import { afterEach, describe, expect, test, vi } from 'vitest';
import type { RenderPlugin } from '@nimblescape/markdownrender';
import handlersJs from './page/handlers.js?raw';
import { type Host, renderPage } from './page';
import { registerRenders, slotsHtml, slotsId, type TokenData } from './pageRenders';
import { createLayoutRenderer } from './text';

/** host is a host for the tests, without files. */
const host: Host = { reader: { read: async () => undefined }, resource: (url) => url, sources: 'file:', scripts: [], nonce: 'abc' };

/** PageWindow is the window with the script of the layout. */
type PageWindow = Window & {
  paperHandlers?: {
    fill(root: ParentNode): void;
    addRender(kind: string, render: unknown): void;
    pending: ((root: ParentNode) => boolean | number)[];
    beforePages: ((root: ParentNode) => void)[];
    before(): Promise<void>;
  };
};

/** tokens are the data of the tokens that the functions of the plugins got. */
let tokens: { source: string; token: TokenData & { attrGet(name: string): string | null } }[] = [];

/** plugins show fenced code blocks `shout` in capital letters and fail for `broken`. */
const plugins: RenderPlugin[] = [
  {
    name: 'shout',
    apiVersion: 1,
    render: {
      'fence:shout': (source, element, token) => {
        tokens.push({ source, token: token as unknown as (typeof tokens)[number]['token'] });
        element.textContent = source.trim().toUpperCase();
      },
      'fence:broken': () => {
        throw new Error('The drawing failed.');
      },
    },
  },
];

/**
 * load puts the body of a page into the document of the test and runs the script of the layout, as the page does.
 * @param html - The HTML of the page.
 */
function load(html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  document.body.replaceChildren(...[...parsed.body.childNodes].map((node) => document.importNode(node, true)));
  delete (window as PageWindow).paperHandlers;
  new Function(handlersJs)();
}

afterEach(() => {
  tokens = [];
  document.body.replaceChildren();
});

describe('the slots of the page', () => {
  test('the page holds the slots of its placeholders as JSON that cannot end its element', async () => {
    const text = '# Start\n\n```shout\n</script><b>hello</b>\n```\n';
    const page = await renderPage(host, createLayoutRenderer({ plugins }), 'file:///repo/paper.md', text);
    expect(page.held).toBe(false);
    const json = /<script type="application\/json" id="nsmd-render-slots">(.*?)<\/script>/s.exec(page.html)?.[1] ?? '';
    expect(json).not.toContain('<');
    const slots = JSON.parse(json) as { kind: string; source: string; token: TokenData }[];
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ kind: 'fence:shout', source: '</script><b>hello</b>\n', token: { type: 'fence', info: 'shout', block: true, map: [2, 5] } });
  });

  test('a text without placeholders has no element of slots', async () => {
    expect(slotsHtml([])).toBe('');
    const page = await renderPage(host, createLayoutRenderer({ plugins }), 'file:///repo/paper.md', '# Start\n');
    expect(page.html).not.toContain(`id="${slotsId}"`);
  });
});

describe('the script of the layout', () => {
  test('fills the placeholders with the registered functions, with the data and the methods of the token', async () => {
    const page = await renderPage(host, createLayoutRenderer({ plugins }), 'file:///repo/paper.md', '```shout\nhello\n```\n\n```broken\ncode\n```\n');
    load(page.html);
    registerRenders(plugins);
    (window as PageWindow).paperHandlers?.fill(document.body);
    const placeholders = document.querySelectorAll('main.paper-text [data-nsmd-render]');
    expect(placeholders).toHaveLength(2);
    expect(placeholders[0].textContent).toBe('HELLO');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].source).toBe('hello\n');
    expect(tokens[0].token.type).toBe('fence');
    expect(tokens[0].token.attrGet('data-line')).toBe('0');
    expect(tokens[0].token.attrGet('class')).toBeNull();
    // A function that fails leaves the source of the token, marked as an error.
    const error = placeholders[1].querySelector('code.nsmd-render-error');
    expect(error?.textContent).toBe('code\n');
    expect(error?.getAttribute('title')).toContain('The drawing failed.');
  });

  test('leaves the placeholders without a registered function as they are', async () => {
    const page = await renderPage(host, createLayoutRenderer({ plugins }), 'file:///repo/paper.md', '```shout\nhello\n```\n');
    load(page.html);
    const before = document.querySelector('[data-nsmd-render]')?.innerHTML;
    (window as PageWindow).paperHandlers?.fill(document.body);
    expect(document.querySelector('[data-nsmd-render]')?.innerHTML).toBe(before);
    expect(tokens).toHaveLength(0);
  });

  test('registerRenders needs the script of the layout and valid plugins', () => {
    delete (window as PageWindow).paperHandlers;
    expect(() => registerRenders(plugins)).toThrow('The page has no script of the layout');
    new Function(handlersJs)();
    expect(() => registerRenders([{ name: 'no name', apiVersion: 1 }])).toThrow('needs a name');
  });
});

describe('the start of Paged.js', () => {
  test('a drawing that waits holds Paged.js up to 10 seconds, and a slow drawing up to its own time', async () => {
    vi.useFakeTimers();
    try {
      load('<main class="paper-text"><p>Text</p></main>');
      const handlers = (window as PageWindow).paperHandlers!;
      const start = Date.now();
      // The fast drawing never ends; the slow one says that it waits up to 30 seconds after the start.
      handlers.pending.push(() => true, () => start + 30_000);
      const copied: number[] = [];
      handlers.beforePages.push(() => copied.push(Date.now() - start));
      let started = false;
      void handlers.before().then(() => {
        started = true;
      });
      await vi.advanceTimersByTimeAsync(20_000);
      expect(started).toBe(false);
      await vi.advanceTimersByTimeAsync(11_000);
      expect(started).toBe(true);
      expect(copied).toHaveLength(1);
      expect(copied[0]).toBeGreaterThan(30_000);
    } finally {
      vi.useRealTimers();
    }
  });

  test('without a slow drawing, Paged.js starts 200 milliseconds after the last change', async () => {
    vi.useFakeTimers();
    try {
      load('<main class="paper-text"><p>Text</p></main>');
      const handlers = (window as PageWindow).paperHandlers!;
      const start = Date.now();
      // A slow drawing that is drawn: its time is over.
      handlers.pending.push(() => start - 1);
      let started = false;
      void handlers.before().then(() => {
        started = true;
      });
      await vi.advanceTimersByTimeAsync(1_000);
      expect(started).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
