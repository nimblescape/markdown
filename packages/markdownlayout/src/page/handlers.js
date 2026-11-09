// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The script of the layout in the page of the pages (docs/rendering.md, R-LAYOUT-001, R-LAYOUT-002), before Paged.js:
//
// - The start of Paged.js. Paged.js makes the pages from the content of the page, so the content must be complete: the
//   functions of the plugins must have shown their tokens, and the scripts of the page must have drawn, for example
//   diagrams. Paged.js starts when the page has loaded, the integrating code has released the page (`hold` and
//   `release`, for code that fills the page after it loaded), no function of `pending` says that a drawing waits, and
//   the page has not changed for 200 milliseconds, at the latest 10 seconds after the page loaded. A function of
//   `pending` returns true while a drawing waits, or the time (as `Date.now()` gives it) up to which the page waits for
//   a slow drawing, for example a diagram that a program draws one after the other; that time can be later than the 10
//   seconds. The functions of `beforePages` then run, for example to copy what Paged.js would lose.
// - The page numbers. Paged.js restarts the page numbers on the page of an element with `counter-reset: page 1`, with a
//   rule `counter-reset` on that page. Chromium no longer carries a counter that a page resets to the next pages, so
//   they would count on from the pages before. After Paged.js has made a page, the handler counts the pages as
//   Paged.js does for `target-counter()` and gives each page its number with `counter-set`, which the next pages keep.
// - The last line of a justified paragraph whose spaces shrink. A layout can shrink the spaces of a justified line with
//   a negative `word-spacing`, as Word does to fit one more word or syllable: the browser breaks the lines with the
//   narrow spaces and then widens the spaces of each full line to the width of the text. The last line of a paragraph
//   is not justified, so it would keep the narrow spaces, which Word does not do. After Paged.js has made a page, the
//   handler gives the last line of each such paragraph that ends on the page its natural spaces again, or narrows them
//   only as far as the line needs to fit, and leaves the paragraph as it was when the change would add a line. The
//   paragraph in which the page breaks does not end on the page: its last line on the page stays justified.
// - No text is lost at a page break. Paged.js lays the text out in a column as high as the page and breaks the page
//   before the first glyph that the browser puts into the next column; a column beside the page does not show. The
//   browser gives the first glyph after a line break at a soft hyphen the rectangle of the line before, so Paged.js
//   took that glyph for the last one on the page and broke the word one glyph after the soft hyphen, with its own
//   hyphen after that glyph: "Fließb-" for "Fließ-band". The page then needed one more line than Paged.js had
//   measured, and the browser moved this line and, for the widows of the paragraph, the line before it into the next
//   column. The handler breaks such a word at its soft hyphen. After Paged.js has made a page, the handler measures the
//   page again, as Paged.js does; while text still lies outside the page, it breaks the page before that text, at the
//   last place where a line can break, and the next page starts there. Then the last lines get their spaces. The
//   next page starts at the place of the break in the text of the content that the text on the page copies: Paged.js
//   searched that text by its characters, and in an element with a repeated text, such as "). " after each citation,
//   it found an earlier one, so that the next page showed a part of the page before once more.
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

  /** A character that shows no glyph and where a line can break: white space or a soft hyphen. */
  const noGlyph = /[\s\u00ad]/;

  /**
   * The references (`data-ref`) of the elements that the break at the end of a page splits: the parents of the place of
   * the break in the content of Paged.js. Paged.js marks the part of such an element on the page with `data-split-to`
   * only when it makes the next page.
   * @param page - The page of Paged.js.
   */
  function splitRefs(page) {
    const refs = new Set();
    const token = page && page.endToken;
    for (let element = token && token.node ? token.node.parentElement : null; element; element = element.parentElement) {
      if (element.dataset && element.dataset.ref) {
        refs.add(element.dataset.ref);
      }
    }
    return refs;
  }

  /**
   * The overflow of a page that starts after the soft hyphen where the browser breaks the line, or undefined when the
   * overflow does not start one glyph after a soft hyphen. The browser gives the first glyph after a line break at a
   * soft hyphen the rectangle of the line before, so Paged.js takes that glyph for the last one that fits.
   * @param overflow - The range of the overflow that Paged.js found, from its start to the end of the page.
   */
  function afterSoftHyphen(overflow) {
    if (!overflow) {
      return undefined;
    }
    const node = overflow.startContainer;
    const offset = overflow.startOffset;
    if (node.nodeType !== Node.TEXT_NODE || offset < 2 || node.data[offset - 2] !== '\u00ad' || noGlyph.test(node.data[offset - 1])) {
      return undefined;
    }
    const moved = overflow.cloneRange();
    moved.setStart(node, offset - 1);
    return moved;
  }

  /**
   * The overflow of a page that starts at the last place before its start where a line can break, when it starts inside
   * a word: after the white space or the soft hyphen before the word in the same text node. Else the overflow itself.
   * @param overflow - The range of the overflow, from its start to the end of the page.
   */
  function atLineBreak(overflow) {
    const node = overflow.startContainer;
    const offset = overflow.startOffset;
    // The end of a text node is inside a word when only the hyphen of Paged.js after it lay outside the page.
    if (node.nodeType !== Node.TEXT_NODE || offset === 0 || noGlyph.test(node.data[offset - 1]) || (offset < node.data.length && noGlyph.test(node.data[offset]))) {
      return overflow;
    }
    let start = offset - 1;
    while (start > 0 && !noGlyph.test(node.data[start - 1])) {
      start--;
    }
    if (start === 0) {
      return overflow;
    }
    const moved = overflow.cloneRange();
    moved.setStart(node, start);
    return moved;
  }

  /**
   * Takes the hyphen away that Paged.js added after the last text of a page, where it broke a word, so that the text of
   * the page is again a part of the text of the content.
   * @param rendered - The element of the text of the page.
   * @param hyphen - The hyphen of Paged.js.
   */
  function removeHyphen(rendered, hyphen) {
    const walker = document.createTreeWalker(rendered, NodeFilter.SHOW_TEXT);
    const last = walker.lastChild();
    if (last && last.parentElement && last.parentElement.classList.contains('pagedjs_hyphen') && last.data.endsWith(hyphen)) {
      last.data = last.data.slice(0, last.data.length - hyphen.length);
      last.parentElement.classList.remove('pagedjs_hyphen');
    }
  }

  /**
   * The break token of an overflow that starts in a text of a page, with the text of the content that this text copies,
   * or undefined when the token of Paged.js is right or the text is not known. Paged.js finds that text of the content
   * as the first text of the element whose characters hold the characters of the text on the page, and the place in it
   * as the first place of these characters. Texts that repeat in an element, such as "). " after each citation, then
   * gave the place of an earlier text, and the next page showed a part of the page before once more.
   * @param texts - The texts of the content of the texts of the pages, with the place where each starts in it.
   * @param token - The break token of Paged.js.
   * @param overflow - The range of the overflow, from its start to the end of the page.
   */
  function sourceToken(texts, token, overflow) {
    if (!token || !overflow) {
      return undefined;
    }
    let text = overflow.startContainer;
    let offset = overflow.startOffset;
    // A text that lies outside the page as a whole is the child of the element where the overflow starts.
    if (text.nodeType !== Node.TEXT_NODE) {
      text = text.childNodes[offset];
      offset = 0;
    }
    const place = text && text.nodeType === Node.TEXT_NODE ? texts.get(text) : undefined;
    if (!place) {
      return undefined;
    }
    const start = place.start + offset;
    // Paged.js lets the next page start at the element of a text that is the first child of the element.
    const parent = place.node.parentNode;
    if (start === 0 && parent && parent.firstChild === place.node && token.node === parent && !token.offset) {
      return undefined;
    }
    return token.node === place.node && token.offset === start ? undefined : new token.constructor(place.node, start);
  }

  /** The reference of Paged.js of the element of a text, which the copy of the element on a page has as well. */
  function refOf(text) {
    return text.parentElement ? text.parentElement.getAttribute('data-ref') : null;
  }

  /**
   * Notes for each text of a part of a page the text of the content that it copies, for sourceToken. Paged.js copies a
   * paragraph with all its texts, and the first text on a page alone, which can be the end of a text of the content.
   * @param texts - The texts of the content of the texts of the pages, with the place where each starts in it.
   * @param clone - The element or the text on the page.
   * @param node - The element or the text of the content.
   */
  function noteTexts(texts, clone, node) {
    if (!clone || !node) {
      return;
    }
    if (clone.nodeType === Node.TEXT_NODE && node.nodeType === Node.TEXT_NODE) {
      texts.set(clone, { node, start: Math.max(0, node.data.length - clone.data.length) });
      return;
    }
    if (clone.nodeType !== Node.ELEMENT_NODE || node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const originals = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let original = walker.nextNode(); original; original = walker.nextNode()) {
      originals.push(original);
    }
    const copies = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let next = 0;
    for (let copy = copies.nextNode(); copy && next < originals.length; copy = copies.nextNode()) {
      // Other handlers can change the copy, such as the one of the notes at the foot of the page.
      let index = next;
      while (index < originals.length && !(originals[index].data === copy.data && refOf(originals[index]) === refOf(copy))) {
        index++;
      }
      if (index < originals.length) {
        texts.set(copy, { node: originals[index], start: 0 });
        next = index + 1;
      }
    }
  }

  /**
   * Breaks a page before the text that lies outside it, as Paged.js breaks a page, and lets the next page start there.
   * The text outside the page is in the next column of the text, which does not show.
   * @param page - The page of Paged.js.
   * @param source - The content of Paged.js, from which it makes the pages.
   * @param texts - The texts of the content of the texts of the pages (sourceToken).
   */
  function fitPage(page, source, texts) {
    const layout = page && page.layoutMethod;
    const rendered = page && page.wrapper;
    const token = page && page.endToken;
    if (!layout || !rendered || !source || !token || !token.node) {
      return;
    }
    const hyphen = (layout.settings && layout.settings.hyphenGlyph) || '\u2011';
    // Each round breaks the page at least one line earlier; a page with this many rounds has a problem of its own.
    for (let round = 0; round < 20; round++) {
      const found = layout.findOverflow(rendered, layout.bounds);
      if (!found) {
        return;
      }
      removeHyphen(rendered, hyphen);
      const overflow = atLineBreak(found);
      const made = layout.createBreakToken(overflow, rendered, source);
      const next = sourceToken(texts, made, overflow) || made;
      // A page breaks after some text, else the next page would start where this one does.
      if (!next || !next.node || (page.startToken && next.equals(page.startToken))) {
        return;
      }
      const letter = next.offset && next.node.textContent ? next.node.textContent.charAt(next.offset) : undefined;
      const removed = layout.removeOverflow(overflow, letter);
      // The other handlers, such as the one of the footnotes, learn which text left the page.
      layout.hooks.afterOverflowRemoved.trigger(removed, rendered, layout);
      token.node = next.node;
      token.offset = next.offset;
    }
  }

  /** The place and the height of each box of an element, which changes when the element gets or loses a line. */
  function shapeOf(element) {
    return Array.from(element.getClientRects(), (rect) => `${Math.round(rect.left * 2)},${Math.round(rect.top * 2)},${Math.round(rect.height * 2)}`).join(' ');
  }

  /**
   * Gives the last lines of the justified paragraphs with shrinking spaces of a page their natural spaces.
   * @param page - The element of the page.
   * @param split - The references of the elements that the break at the end of the page splits (splitRefs).
   */
  function naturalLastLines(page, split = new Set()) {
    for (const block of page.querySelectorAll('p, li, dd, dt, td, th')) {
      const style = getComputedStyle(block);
      const shrink = parseFloat(style.wordSpacing);
      if (!(shrink < 0) || style.textAlign !== 'justify' || style.textAlignLast === 'justify' || block.hasAttribute('data-split-to') || split.has(block.dataset.ref)) {
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
      // A box for each column of the paragraph: a line that the change adds can go into the next column of the page,
      // where the height of all boxes together can stay the same.
      const shape = shapeOf(block);
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
      if (shapeOf(block) !== shape) {
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
    /**
     * pending are functions of the integrating code that return true while a drawing of the page waits, or the time up
     * to which the page waits for a slow drawing, which can be later than the 10 seconds.
     */
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
      class PageEnds extends window.Paged.Handler {
        constructor(chunker, polisher, caller) {
          super(chunker, polisher, caller);
          /** The text of the content of each text on the pages, with the place where the text starts in it. */
          this.texts = new WeakMap();
        }

        renderNode(clone, node) {
          noteTexts(this.texts, clone, node);
        }

        onOverflow(overflow) {
          return afterSoftHyphen(overflow);
        }

        onBreakToken(token, overflow) {
          return sourceToken(this.texts, token, overflow);
        }

        finalizePage(pageElement, page) {
          fitPage(page, this.chunker && this.chunker.source, this.texts);
          naturalLastLines(pageElement, splitRefs(page));
        }
      }
      window.Paged.registerHandlers(PageNumbers, PageEnds);
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
              let end = Date.now() + 10000;
              let last = Date.now();
              const observer = new MutationObserver(() => {
                last = Date.now();
              });
              observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
              const check = () => {
                const now = Date.now();
                let waiting = false;
                for (const test of handlers.pending) {
                  const result = test(document.body);
                  if (typeof result === 'number') {
                    // A slow drawing waits up to its own time.
                    end = Math.max(end, result);
                    waiting = waiting || now <= result;
                  } else if (result) {
                    waiting = true;
                  }
                }
                if (now > end || (!waiting && now - last >= 200)) {
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
