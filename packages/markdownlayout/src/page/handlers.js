// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The script of the layout in the page of the pages (docs/rendering.md, R-LAYOUT-001, R-LAYOUT-002), before Paged.js:
//
// - The start of Paged.js. Paged.js makes the pages from the content of the page, so the content must be complete: the
//   functions of the plugins must have shown their tokens, and the scripts of the page must have drawn, for example
//   diagrams. Paged.js starts when the page has loaded, the integrating code has released the page (`hold` and
//   `release`, for code that fills the page after it loaded), no function of `pending` says that a drawing waits, and
//   the page has not changed for 200 milliseconds, at the latest 10 seconds after the page loaded. The functions of
//   `beforePages` then run, for example to copy what Paged.js would lose.
// - The page numbers. Paged.js restarts the page numbers on the page of an element with `counter-reset: page 1`, with a
//   rule `counter-reset` on that page. Chromium no longer carries a counter that a page resets to the next pages, so
//   they would count on from the pages before. After Paged.js has made a page, the handler counts the pages as
//   Paged.js does for `target-counter()` and gives each page its number with `counter-set`, which the next pages keep.
// - The last line of a justified paragraph whose spaces shrink. A layout can shrink the spaces of a justified line with
//   a negative `word-spacing`, as Word does to fit one more word or syllable: the browser breaks the lines with the
//   narrow spaces and then widens the spaces of each full line to the width of the text. The last line of a paragraph
//   is not justified, so it would keep the narrow spaces, which Word does not do. After Paged.js has made a page, the
//   handler gives the last line of each such paragraph that ends on the page its natural spaces again, or narrows them
//   only as far as the line needs to fit, and leaves the paragraph as it was when the change would add a line.
//
// - The functions of the plugins in the page (src/pageRenders.ts). A page without `hold` fills each placeholder of the
//   text whose kind has a function of `addRender` after the page has loaded, with the data of its slot from the element
//   `script#nsmd-render-slots`, as the renderer does: the placeholder becomes empty and the function shows the token in
//   it; when the function fails, the placeholder shows the source of the token, marked as an error.
//
// When Paged.js has made the pages, `window.paperRendered` is true and the document gets the event `paper-rendered`.
(function () {
  'use strict';

  /** The text node after a text node within an element, or null. */
  function nextText(root, node) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    walker.currentNode = node;
    return walker.nextNode();
  }

  /** Gives the last lines of the justified paragraphs with shrinking spaces of a page their natural spaces. */
  function naturalLastLines(page) {
    for (const block of page.querySelectorAll('p, li, dd, dt, td, th')) {
      const style = getComputedStyle(block);
      const shrink = parseFloat(style.wordSpacing);
      if (!(shrink < 0) || style.textAlign !== 'justify' || style.textAlignLast === 'justify' || block.hasAttribute('data-split-to')) {
        continue;
      }
      if (block.querySelector('p, div, ul, ol, table, blockquote, figure, pre')) {
        continue;
      }
      // The characters that show a glyph, in the order of the text.
      const glyphs = [];
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (let offset = 0; offset < node.data.length; offset++) {
          if (!/[\s\u00ad]/.test(node.data[offset])) {
            glyphs.push({ node, offset });
          }
        }
      }
      if (glyphs.length === 0) {
        continue;
      }
      const range = document.createRange();
      const rectOf = (glyph) => {
        range.setStart(glyph.node, glyph.offset);
        range.setEnd(glyph.node, glyph.offset + 1);
        return range.getBoundingClientRect();
      };
      const end = glyphs[glyphs.length - 1];
      const last = rectOf(end);
      // The first glyph of the last line: the first whose middle is below the top of the last glyph.
      let low = 0;
      let high = glyphs.length - 1;
      while (low < high) {
        const middle = (low + high) >> 1;
        const rect = rectOf(glyphs[middle]);
        if (rect.top + rect.height / 2 > last.top) {
          high = middle;
        } else {
          low = middle + 1;
        }
      }
      // The browser can place the first glyph after a soft hyphen at the end of the line before; the line starts after
      // a space or a soft hyphen, so the glyphs without one between them stay together.
      const gap = (before, after) => {
        range.setStart(before.node, before.offset + 1);
        range.setEnd(after.node, after.offset);
        return range.toString();
      };
      while (low > 0 && !/[\s\u00ad]/.test(gap(glyphs[low - 1], glyphs[low]))) {
        low--;
      }
      const first = glyphs[low];
      range.setStart(first.node, first.offset);
      range.setEnd(end.node, end.offset + 1);
      const spaces = (range.toString().match(/[ \u00a0]/g) || []).length;
      if (spaces === 0) {
        continue;
      }
      // The page can be scaled: the rectangles are on the screen, the word spacing is in CSS pixels.
      const box = block.getBoundingClientRect();
      const scale = block.offsetWidth > 0 ? box.width / block.offsetWidth : 1;
      const right = box.right - (parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth)) * scale;
      const room = (right - last.right) / scale;
      const spacing = Math.min(0, shrink + room / spaces - 0.05);
      // Each text node of the last line gets a span with the word spacing; the first is split at the line.
      const spans = [];
      for (let text = first.offset > 0 ? first.node.splitText(first.offset) : first.node; text; text = nextText(block, text)) {
        const span = document.createElement('span');
        span.className = 'paper-last-line';
        span.style.wordSpacing = `${spacing}px`;
        text.parentNode.insertBefore(span, text);
        span.appendChild(text);
        spans.push(span);
      }
      if (Math.abs(block.getBoundingClientRect().height - box.height) > 0.5) {
        for (const span of spans) {
          span.replaceWith(span.firstChild);
        }
        block.normalize();
      }
    }
  }

  /** The methods of the data of a token in the page, as markdown-it has them. */
  const tokenMethods = {
    attrIndex(name) {
      return (this.attrs || []).findIndex((attribute) => attribute[0] === name);
    },
    attrGet(name) {
      const index = this.attrIndex(name);
      return index >= 0 ? this.attrs[index][1] : null;
    },
  };

  /** The data of a token with the methods of a token, with its children. */
  function tokenOf(data) {
    const token = Object.assign(Object.create(tokenMethods), data);
    token.children = data.children ? data.children.map(tokenOf) : null;
    return token;
  }

  /** Fills the placeholders of the plugins in an element with the functions of `renders`. */
  function fill(root, renders) {
    const element = document.getElementById('nsmd-render-slots');
    if (!element || Object.keys(renders).length === 0) {
      return;
    }
    let slots;
    try {
      slots = JSON.parse(element.textContent || '[]');
    } catch (error) {
      console.error('The slots of the placeholders of the plugins are no JSON.', error);
      return;
    }
    for (const placeholder of root.querySelectorAll('[data-nsmd-render]')) {
      const slot = slots[Number(placeholder.dataset.nsmdRender)];
      const render = slot ? renders[slot.kind] : undefined;
      if (typeof render !== 'function') {
        continue;
      }
      placeholder.replaceChildren();
      try {
        render(slot.source, placeholder, tokenOf(slot.token));
      } catch (error) {
        const code = document.createElement('code');
        code.className = 'nsmd-render-error';
        code.title = String(error);
        code.textContent = slot.source;
        placeholder.replaceChildren(code);
      }
    }
  }

  /** The value of the counter `page` in a computed value of counter-reset or counter-increment, or undefined. */
  function pageValue(value) {
    const found = /(?:^|\s)page\s+(-?\d+)/.exec(value || '');
    return found ? Number(found[1]) : undefined;
  }

  let registered = false;
  let held = false;
  let released = null;
  const release = new Promise((resolve) => {
    released = resolve;
  });

  const renders = Object.create(null);

  window.paperHandlers = {
    naturalLastLines,
    /** addRender registers the function of a plugin for a kind of token: the type of the token, or `fence:<language>`. */
    addRender(kind, render) {
      renders[kind] = render;
    },
    /** fill fills the placeholders of the plugins in an element with the registered functions. */
    fill(root) {
      fill(root, renders);
    },
    /** pending are functions of the integrating code that return true while a drawing of the page waits. */
    pending: [],
    /** beforePages are functions of the integrating code that run right before Paged.js makes the pages. */
    beforePages: [],
    /** hold keeps Paged.js from starting until release. */
    hold() {
      held = true;
    },
    /** release lets Paged.js start, after hold. */
    release() {
      released();
    },
    /** Registers the handlers with Paged.js, once, when Paged.js is there. */
    register() {
      if (registered || !window.Paged || !window.Paged.Handler) {
        return;
      }
      registered = true;
      class PageNumbers extends window.Paged.Handler {
        constructor(chunker, polisher, caller) {
          super(chunker, polisher, caller);
          this.number = 0;
        }

        afterPageLayout(pageElement) {
          const style = getComputedStyle(pageElement);
          const reset = pageValue(style.counterReset);
          const increment = pageValue(style.counterIncrement);
          this.number = reset !== undefined ? reset + (increment || 0) : this.number + (increment === undefined ? 0 : increment);
          pageElement.style.counterSet = `page ${this.number}`;
        }
      }
      class LastLines extends window.Paged.Handler {
        finalizePage(page) {
          naturalLastLines(page);
        }
      }
      window.Paged.registerHandlers(PageNumbers, LastLines);
    },
    /** before is the function `before` of the configuration of Paged.js: it waits until the content is complete. */
    before() {
      const handlers = window.paperHandlers;
      handlers.register();
      const loaded = new Promise((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', () => resolve(), { once: true });
        }
      });
      return loaded
        .then(() => (held ? release : handlers.fill(document.body)))
        .then(
          () =>
            new Promise((resolve) => {
              const end = Date.now() + 10000;
              let last = Date.now();
              const observer = new MutationObserver(() => {
                last = Date.now();
              });
              observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
              const check = () => {
                const waiting = handlers.pending.some((test) => test(document.body));
                if (Date.now() > end || (!waiting && Date.now() - last >= 200)) {
                  observer.disconnect();
                  for (const run of handlers.beforePages) {
                    run(document.body);
                  }
                  resolve();
                } else {
                  setTimeout(check, 50);
                }
              };
              setTimeout(check, 150);
            }),
        );
    },
    /** after is the function `after` of the configuration of Paged.js. */
    after() {
      window.paperRendered = true;
      document.dispatchEvent(new Event('paper-rendered'));
    },
  };
})();
