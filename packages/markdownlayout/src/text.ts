// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The text of the pages (docs/rendering.md, R-LAYOUT-001, R-LAYOUT-004): the layout is a plugin of the renderer
// (R-REN-002) whose core rule changes the tokens of markdown-it in a rendering with a layout, after the rules of
// markdown-it, of the footnotes and of the plugins before it. The renderer then writes its output, with the GitHub
// alerts and the line of each block (R-REN-001). The rule works only when the environment of the rendering has
// `nimblescapeLayout`, so the same markdown-it renders a text without a layout too.
//
// - Each footnote goes to the foot of the page of its first reference (src/footnotes.ts).
// - The headings get the ID that GitHub gives them, so plain Markdown links to them work, and a number such as 1.1
//   when the layout numbers them. A heading with `{-}` at its end, the heading of a special section (TOC, LOF, LOT,
//   LOL, BIB, ADT, AST, ACC, FWD, APX: by its words in the language of the layout, or by a marker such as `{BIB}`), and
//   a heading that a pattern of the layout names get none, nor do the headings below them; the special sections of
//   `headings.numberedSections` of the layout get a number as other chapters do.
// - The captions keep the numbers that the file gives them; only a caption without a number gets the next number of
//   its kind. A paragraph "Figure 1: …" directly before an image alone in its paragraph is the caption of the figure,
//   above the image; an image without it is a figure without a caption. A paragraph "Table 1: …" directly before a
//   table, or before the comment of the widths of its columns, is the caption of the table. A paragraph "Listing 1: …"
//   directly before a fenced code block, or before a comment before it, is the caption of the listing, and the code
//   gets the numbers of its lines when the layout asks for them.
// - The section of the table of contents, of the list of figures, of tables or of listings shows its list
//   (src/lists.ts) in place of the rest of the section. The reference list (BIB) gets no soft hyphens, unless the
//   layout asks for them with `references.hyphenate`.
// - The headings of the level 2 in the appendix part, after the heading "Anhang" or "Appendix", are the appendices A,
//   B, … (one appendix has no letter), whose figures, tables and listings are numbered A1, A2, …, as APA 7 numbers
//   them.
// - The document has up to three parts, each from a heading of the level 1 on, in its own element: the front part
//   (`div.paper-part.paper-front`), the chapters of the front matter (ADT, AST, ACC, FWD, TOC, LOF, LOT, LOL) before
//   the first other chapter; the body (`div.paper-part.paper-body`) with the chapters; and the appendix part
//   (`div.paper-part.paper-appendix`). A layout can give each part its own pages. A special section of the front part
//   gets no number, also when the layout numbers its kind.
// - A link whose text is a word and a number, such as "Abbildung 1" or "Kapitel 2.1", gets the label of its target,
//   and a link to a place that the file does not have is a problem.
//
// The classes and the IDs are those of the layout folder of nimblescape Markdown Paper, so that its layouts work
// without a change.

import { MarkdownRenderer, headingText, slug, type RenderPlugin, type RendererOptions } from '@nimblescape/markdownrender';
import type MarkdownIt from 'markdown-it';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { footnoteHtml, placeFootnotes, type FootnoteMeta } from './footnotes';
import { type Layout, type Problem, type SectionCode, sectionCodes, type Terms } from './format';
import { hyphenateHtml } from './hyphenate';
import { type Entry, type GeneratedList, generatedLists, listHtml } from './lists';
import { escapeHtml } from './template';
import { decodedTarget, footnoteType, internalLinks, layoutHtml, layoutHtmlType, listType, plainText, trailingAnchor, withoutTrailingSpace, type InternalLink } from './tokens';

/**
 * headingMarker matches a marker at the end of a heading: `{-}` or `{.unnumbered}` for a heading without a number, or
 * the code of a special section, for example `{BIB}`, for a heading whose words are not the words of the language.
 */
const headingMarker = new RegExp(`\\s*\\{(-|\\.unnumbered|${sectionCodes.join('|')})\\}\\s*$`);

/**
 * frontSections are the special sections of the front matter: the chapters of the level 1 with these codes before the
 * first other chapter are the front part of the document.
 */
const frontSections: readonly SectionCode[] = ['ADT', 'AST', 'ACC', 'FWD', 'TOC', 'LOF', 'LOT', 'LOL'];

/** Part is a part of the document: the front matter, the body with the chapters, or the appendix part. */
export type Part = 'front' | 'body' | 'appendix';

/** byHand matches a heading that starts with a number, such as "1 Introduction" or "2.3. Method". */
const byHand = /^\d+(?:\.\d+)*\.?\s/;

/** Heading is a heading of the text. */
export interface Heading {
  level: number;
  id: string;
  /** number is the number of the heading, for example 1.2, or the label of an appendix, else empty. */
  number: string;
  /** text is the text of the heading without its number. */
  text: string;
  /** section is the code of the special section that the heading starts, if any; APX-A, APX-B for an appendix. */
  section?: string;
  /** appendix is true for the heading of one appendix, whose number is its label, for example "Anhang A". */
  appendix?: boolean;
  /** part is the part of the document that the heading is in. */
  part?: Part;
  /** anchor is the ID of an anchor at the end of the heading, `<a id="sec-methods"></a>`, if any. */
  anchor?: string;
  line: number;
}

/** Caption is the caption of a figure, of a table or of a listing. */
export interface Caption {
  id: string;
  /** label is the word and the number, for example "Abbildung 1". */
  label: string;
  /** text is the text of the caption without its label. */
  text: string;
  line: number;
}

/** TextFound is what the layout finds in the text of one rendering. */
export interface TextFound {
  headings: Heading[];
  figures: Caption[];
  tables: Caption[];
  listings: Caption[];
  /** lists are the entries of the lists that the file holds between the markers of their sections. */
  lists: Partial<Record<GeneratedList, Entry[]>>;
  /** footnotes is the number of the footnotes of the pages. */
  footnotes: number;
  problems: Problem[];
}

/** emptyFound returns an empty TextFound. */
export const emptyFound = (): TextFound => ({ headings: [], figures: [], tables: [], listings: [], lists: {}, footnotes: 0, problems: [] });

/** LayoutEnv is what the rule needs in the environment of a rendering, as `nimblescapeLayout`. */
export interface LayoutEnv {
  layout: Layout;
  found: TextFound;
}

/** layoutEnvKey is the key of the LayoutEnv in the environment of a rendering. */
export const layoutEnvKey = 'nimblescapeLayout';

/** envOf returns the LayoutEnv of the environment of a rendering, if it has one. */
const envOf = (env: unknown): LayoutEnv | undefined => (env as Record<string, LayoutEnv | undefined> | undefined)?.[layoutEnvKey];

/** listMarker matches a marker of the list of a special section: `<!-- toc -->` at its start, `<!-- /toc -->` at its end. */
const listMarker = /^\s*<!--\s*(\/?)(toc|lof|lot|lol)\s*-->\s*$/i;

/** comment matches a block that is only an HTML comment, such as the comment of a listing or of the widths of a table. */
const comment = /^\s*<!--[\s\S]*-->\s*$/;

/**
 * captionPattern returns the pattern of the start of a caption, such as "Table 2: " or "Tabelle: ", with the number as
 * its group.
 * @param words - The words of the caption: the English word and the word of the language.
 */
function captionPattern(...words: string[]): RegExp {
  const alternatives = [...new Set(words)].map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`^(?:${alternatives})(?:\\s+([A-Z]?\\d+))?\\s*:\\s*`, 'i');
}

/**
 * referenceText matches the text of a link to a figure, a table or a heading that the layout writes anew: a word and a
 * number, such as "Abbildung 1", "Tabelle A1", "Kapitel 2.1" or "Anhang B".
 */
export const referenceText = /^(\p{L}+\.?)\s+(?:[A-Z]?\d+(?:\.\d+)*|[A-Z])$/u;

/**
 * matches tells whether the text of a heading is one of the terms, without regard to case.
 * @param text - The text of the heading.
 * @param terms - The terms.
 */
const matches = (text: string, terms: readonly string[]): boolean => terms.some((term) => term.toLocaleLowerCase() === text.toLocaleLowerCase());

/**
 * sectionOf returns the code of the special section of a heading: the code of its marker, else the code whose words
 * are its text. The appendix part and the reference list are chapters, of the level 1.
 * @param text - The text of the heading, without its marker.
 * @param level - The level of the heading.
 * @param marker - The marker of the heading, if any.
 * @param terms - The terms of the language.
 */
function sectionOf(text: string, level: number, marker: string | undefined, terms: Terms): SectionCode | undefined {
  if (marker && (sectionCodes as readonly string[]).includes(marker)) {
    return marker as SectionCode;
  }
  const code = sectionCodes.find((candidate) => matches(text, terms.sections[candidate]));
  return code && (level === 1 || (code !== 'APX' && code !== 'BIB')) ? code : undefined;
}

/**
 * letter returns the letter of the appendix with an index: A, B, …, Z, AA, AB, ….
 * @param index - The index, from 0.
 */
const letter = (index: number): string => (index < 26 ? String.fromCharCode(65 + index) : letter(Math.floor(index / 26) - 1) + letter(index % 26));

/**
 * imageOf returns the children of a paragraph with only an image, without the anchor at its end, and the anchor, or
 * undefined for another block.
 * @param tokens - The tokens of the text.
 * @param index - The index of the start of the paragraph.
 */
function imageOf(tokens: readonly Token[], index: number): { kept: Token[]; anchor?: { id: string; start: number } } | undefined {
  if (tokens[index]?.type !== 'paragraph_open' || tokens[index + 1]?.type !== 'inline') {
    return undefined;
  }
  const all = tokens[index + 1].children ?? [];
  const anchor = trailingAnchor(all);
  const kept = anchor ? all.slice(0, anchor.start) : all;
  const children = kept.filter((child) => !(child.type === 'text' && child.content.trim() === '') && child.type !== 'softbreak');
  return children.length === 1 && children[0].type === 'image' ? { kept, anchor } : undefined;
}

/**
 * afterComment returns the token after a paragraph, past one block that is only an HTML comment.
 * @param tokens - The tokens of the text.
 * @param index - The index of the token after the end of the paragraph.
 */
const afterComment = (tokens: readonly Token[], index: number): Token | undefined =>
  tokens[index]?.type === 'html_block' && comment.test(tokens[index].content) ? tokens[index + 1] : tokens[index];

/** ListingMeta is the mark of the code block of a listing for the rule of code blocks, in the meta of its token. */
interface ListingMeta {
  layoutListing?: { lineNumbers: boolean };
}

/** captionSource matches the start of the cite of the source of a listing, which a plugin writes after the caption. */
const captionSource = '<span class="caption-source">';

/**
 * numberLines puts the number of each line before the lines of the code of a code block, as an empty element whose
 * number the style sheet shows, so that it works with the colors of a highlighter and on a page that continues the
 * code block on the next page.
 * @param html - The HTML of the code block.
 */
export function numberLines(html: string): string {
  const open = /<code[^>]*>(?:<div[^>]*>)?/.exec(html);
  const end = html.lastIndexOf('</code>');
  if (!open || end < open.index + open[0].length) {
    return html;
  }
  const start = open.index + open[0].length;
  const lines = html.slice(start, end).split('\n');
  // The code ends with a line break, after which only the end of an element of the highlighter can stand.
  const last = lines.length > 1 && /^(?:<\/div>)?$/.test(lines[lines.length - 1]) ? lines.pop() : undefined;
  const numbered = lines.map((line, index) => `<span class="line-number" data-number="${index + 1}" aria-hidden="true"></span>${line}`);
  return `${html.slice(0, start)}${[...numbered, ...(last !== undefined ? [last] : [])].join('\n')}${html.slice(end)}`;
}

/**
 * listingCode gives the code block of a listing the class `listing`, and the numbers of its lines when the layout asks
 * for them.
 * @param html - The HTML of the code block.
 * @param lineNumbers - True for the numbers of the lines.
 */
export function listingCode(html: string, lineNumbers: boolean): string {
  const marked = html.replace(/^<pre\b([^>]*)>/, (_all, attributes: string) =>
    /\bclass="/.test(attributes) ? `<pre${attributes.replace(/\bclass="/, 'class="listing ')}>` : `<pre class="listing"${attributes}>`,
  );
  return lineNumbers ? numberLines(marked) : marked;
}

/**
 * layoutRule changes the tokens of one rendering with a layout.
 * @param state - The state of the core rule.
 * @param layout - The layout of the document.
 * @param found - What the rule finds, which it fills.
 */
function layoutRule(state: StateCore, layout: Layout, found: TextFound): void {
  const terms = layout.terms;
  found.footnotes = placeFootnotes(state);
  const tokens = state.tokens;
  const ids = new Set<string>();
  const unique = (base: string): string => {
    let id = base;
    for (let count = 1; ids.has(id); count++) {
      id = `${base}-${count}`;
    }
    ids.add(id);
    return id;
  };
  const html = (content: string, block = false): Token => layoutHtml(state, content, block);
  const patterns = layout.unnumbered.map((pattern) => new RegExp(pattern, 'iu'));
  const headingTexts = tokens.flatMap((token, index) => (token.type === 'heading_open' ? [plainText(tokens[index + 1].children ?? [])] : []));
  const numberedByHand = headingTexts.some((text) => byHand.test(text));
  const counters = [0, 0, 0, 0, 0, 0];
  let unnumberedBelow = 0;
  let appendixPart = false;
  let appendix = -1;
  const appendixCount = (() => {
    let inPart = false;
    let count = 0;
    for (let index = 0; index < tokens.length; index++) {
      if (tokens[index].type !== 'heading_open') {
        continue;
      }
      const level = Number(tokens[index].tag.slice(1));
      const plain = plainText(tokens[index + 1].children ?? []);
      const marker = headingMarker.exec(plain)?.[1];
      if (level === 1) {
        inPart = sectionOf(plain.replace(headingMarker, ''), level, marker, terms) === 'APX';
      } else if (level === 2 && inPart) {
        count++;
      }
    }
    return count;
  })();
  let figureCount = 0;
  let tableCount = 0;
  let listingCount = 0;
  // numberOf returns the number of a caption and the count of its kind: the number that the file gives it, else the
  // next number, with the letter of the appendix in the appendix part.
  const numberOf = (given: string | undefined, count: number): [string, number] => {
    if (given) {
      return [given, Number(/\d+$/.exec(given)?.[0] ?? count)];
    }
    return [appendixPart && appendix >= 0 ? `${letter(appendix)}${count + 1}` : String(count + 1), count + 1];
  };
  const figureCaption = captionPattern('Figure', terms.figure);
  const tableCaption = captionPattern('Table', terms.table);
  const listingCaption = captionPattern('Listing', terms.listing);
  // captionChildren returns the inline tokens of a caption: its label, and its text without the word and the number.
  const captionChildren = (label: string, kids: Token[], pattern: RegExp): Token[] => {
    const first = kids.find((child) => child.type === 'text');
    if (first) {
      first.content = first.content.replace(pattern, '');
    }
    return [html(`<span class="caption-label">${escapeHtml(label)}</span><span class="caption-separator">: </span><span class="caption-text">`), ...kids, html('</span>')];
  };
  // generated is the list section that the rule is in, until the next heading of its level or above; inList is true
  // between the markers of the list of the section.
  let generated: GeneratedList | undefined;
  let generatedLevel = 0;
  let inList = false;
  // listLinks are the links of the lists of the sections, which the rule checks as entries.
  const listLinks = new Map<Token, { list: GeneratedList; line: number }>();
  // references is the level of the heading of the reference list while the rule is in it, else 0.
  let references = 0;
  // part is the part of the document that the rule is in, from its first heading of the level 1 on.
  let part: Part | undefined;
  const links: InternalLink[] = [];
  const output: Token[] = [];

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === 'inline') {
      links.push(...internalLinks(token.children ?? [], token.map?.[0] ?? 0));
    }
    if (token.type === 'heading_open') {
      const level = Number(token.tag.slice(1));
      if (generated && level <= generatedLevel) {
        generated = undefined;
        inList = false;
      }
      if (references && level <= references) {
        output.push(html('</section>\n', true));
        references = 0;
      }
      const inline = tokens[index + 1];
      // The ID of a heading is the ID that GitHub gives it, from its text as the file writes it, so that a Markdown
      // link such as [Kapitel 2](#methoden) works on GitHub and on the pages. An anchor at the end of the heading,
      // `<a id="sec-methods"></a>`, stays as a second target.
      const children = inline.children ?? [];
      const anchor = trailingAnchor(children);
      const id = unique(slug(headingText(children)) || 'section');
      if (anchor) {
        ids.add(anchor.id);
      }
      const last = withoutTrailingSpace(anchor ? children.slice(0, anchor.start) : children).at(-1);
      let marker: string | undefined;
      if (last?.type === 'text' && headingMarker.test(last.content)) {
        marker = headingMarker.exec(last.content)?.[1];
        last.content = last.content.replace(headingMarker, '');
      }
      const text = plainText(children);
      const code = sectionOf(text, level, marker, terms);
      if (level === 1) {
        appendixPart = code === 'APX';
        const next: Part = appendixPart ? 'appendix' : (part === undefined || part === 'front') && code && frontSections.includes(code) ? 'front' : 'body';
        if (next !== part) {
          if (part) {
            output.push(html('</div>\n', true));
          }
          output.push(html(`<div class="paper-part paper-${next}">\n`, true));
          part = next;
        }
      }
      if (unnumberedBelow && level <= unnumberedBelow) {
        unnumberedBelow = 0;
      }
      let number = '';
      token.attrSet('id', id);
      let section: string | undefined = code;
      if (code) {
        token.attrJoin('class', `section-${code.toLowerCase()}`);
      }
      if (appendixPart && level === 2) {
        // APA 7: the figures and tables of an appendix are numbered A1, A2, also when it is the only appendix.
        appendix++;
        figureCount = 0;
        tableCount = 0;
        listingCount = 0;
        number = appendixCount > 1 ? `${terms.appendix} ${letter(appendix)}` : terms.appendix;
        section = `APX-${letter(appendix)}`;
        token.attrJoin('class', 'appendix');
        inline.children = [html(`<span class="appendix-label">${escapeHtml(number)}</span> `), ...children];
      } else if (((marker || code) && !(code && part === 'body' && layout.numberedSections.includes(code))) || appendixPart || patterns.some((pattern) => pattern.test(text))) {
        unnumberedBelow = level;
        token.attrJoin('class', 'unnumbered');
      } else if (unnumberedBelow) {
        token.attrJoin('class', 'unnumbered');
      } else if (layout.numbered && !numberedByHand && level <= layout.depth) {
        counters[level - 1]++;
        counters.fill(0, level);
        number = counters.slice(0, level).join('.');
        inline.children = [html(`<span class="heading-number">${number}</span> `), ...children];
      } else {
        token.attrJoin('class', 'unnumbered');
      }
      if (section) {
        token.attrSet('data-section', section);
      }
      found.headings.push({
        level,
        id,
        number,
        text,
        ...(section ? { section } : {}),
        ...(appendixPart && level === 2 ? { appendix: true } : {}),
        ...(part ? { part } : {}),
        ...(anchor ? { anchor: anchor.id } : {}),
        line: token.map?.[0] ?? 0,
      });
      output.push(token, inline, tokens[index + 2]);
      index += 2;
      if (code && (generatedLists as readonly string[]).includes(code)) {
        generated = code as GeneratedList;
        generatedLevel = level;
        const list = new state.Token(listType, 'nav', 0);
        list.block = true;
        list.meta = { code };
        output.push(list);
      } else if (code === 'BIB') {
        references = level;
        output.push(html(layout.references.hyphenate ? '<section class="references">\n' : '<section class="references no-hyphens">\n', true));
      }
      continue;
    }
    if (generated) {
      // The list of the file between the markers of the section gives its entries; the rest of the section does not
      // show.
      const marker = token.type === 'html_block' ? listMarker.exec(token.content) : null;
      if (marker && marker[2].toUpperCase() === generated) {
        inList = marker[1] === '';
        if (inList) {
          found.lists[generated] = [];
        }
      } else if (inList && token.type === 'inline') {
        const children = token.children ?? [];
        const open = children.findIndex((child) => child.type === 'link_open' && child.attrGet('href')?.startsWith('#'));
        if (open >= 0) {
          const close = children.findIndex((child, position) => position > open && child.type === 'link_close');
          // The page of an entry comes from target-counter(), which finds the ID only without the escapes of markdown-it.
          found.lists[generated]?.push({ href: decodedTarget(children[open].attrGet('href')?.slice(1) ?? ''), text: plainText(children.slice(open + 1, close < 0 ? undefined : close)).trim() });
          listLinks.set(children[open], { list: generated, line: token.map?.[0] ?? 0 });
        }
      }
      continue;
    }
    if (token.type === 'paragraph_open' && tokens[index + 1]?.type === 'inline') {
      const inline = tokens[index + 1];
      const anchor = trailingAnchor(inline.children ?? []);
      const kept = anchor ? (inline.children ?? []).slice(0, anchor.start) : (inline.children ?? []);
      const text = plainText(kept);
      const image = imageOf(tokens, index);
      // A figure: a paragraph "Figure 1: …" directly before an image alone in its paragraph, with the anchor of the
      // figure at the end of one of the two. The caption stands above the image, as in APA 7.
      const figure = figureCaption.exec(text);
      const next = imageOf(tokens, index + 3);
      if (figure && next && !image) {
        let number: string;
        [number, figureCount] = numberOf(figure[1], figureCount);
        const named = anchor ?? next.anchor;
        if (named) {
          ids.add(named.id);
        }
        const id = named ? named.id : unique(`figure-${number.toLowerCase()}`);
        const label = `${terms.figure} ${number}`;
        const kids = withoutTrailingSpace(kept);
        token.tag = 'figure';
        token.attrJoin('class', 'figure');
        token.attrSet('id', id);
        inline.children = [html('<figcaption>'), ...captionChildren(label, kids, figureCaption), html('</figcaption>')];
        tokens[index + 2].hidden = true;
        tokens[index + 3].hidden = true;
        tokens[index + 4].children = withoutTrailingSpace(next.kept);
        tokens[index + 5].tag = 'figure';
        found.figures.push({ id, label, text: plainText(kids), line: token.map?.[0] ?? 0 });
        output.push(...tokens.slice(index, index + 6));
        index += 5;
        continue;
      }
      // An image alone in its paragraph, without a caption before it: a figure without a caption and a number.
      if (image) {
        token.tag = 'figure';
        token.attrJoin('class', 'figure');
        tokens[index + 2].tag = 'figure';
        inline.children = withoutTrailingSpace(kept);
        if (anchor) {
          ids.add(anchor.id);
          token.attrSet('id', anchor.id);
        }
      }
      // A caption of a table: "Table 1: …" directly before the table, and maybe the anchor of the table at its end.
      const table = tableCaption.exec(text);
      if (table && afterComment(tokens, index + 3)?.type === 'table_open') {
        let number: string;
        [number, tableCount] = numberOf(table[1], tableCount);
        const id = anchor ? anchor.id : unique(`table-${number.toLowerCase()}`);
        if (anchor) {
          ids.add(anchor.id);
        }
        const label = `${terms.table} ${number}`;
        token.attrSet('id', id);
        token.attrJoin('class', 'caption table-caption');
        inline.children = captionChildren(label, withoutTrailingSpace(kept), tableCaption);
        found.tables.push({ id, label, text: text.replace(tableCaption, ''), line: token.map?.[0] ?? 0 });
      }
      // A caption of a listing: "Listing 1: …" directly before the code block, or before a comment before it.
      const fence = afterComment(tokens, index + 3);
      const listing = listingCaption.exec(text);
      if (fence?.type === 'fence' && listing) {
        let number: string;
        [number, listingCount] = numberOf(listing[1], listingCount);
        const id = anchor ? anchor.id : unique(`listing-${number.toLowerCase()}`);
        if (anchor) {
          ids.add(anchor.id);
        }
        const label = `${terms.listing} ${number}`;
        // The cite of the source after the caption, which a plugin writes into an element of its own, stays after it.
        let kids = withoutTrailingSpace(kept);
        const source = kids.findIndex((child) => child.type === layoutHtmlType && child.content.startsWith(captionSource));
        const cite = source >= 0 ? kids.slice(source) : [];
        kids = source >= 0 ? kids.slice(0, source) : kids;
        token.attrSet('id', id);
        token.attrJoin('class', 'caption listing-caption');
        inline.children = [...captionChildren(label, kids, listingCaption), ...cite];
        fence.meta = { ...(fence.meta as object | undefined), layoutListing: { lineNumbers: layout.listings.lineNumbers } } satisfies ListingMeta;
        found.listings.push({ id, label, text: plainText(kids), line: token.map?.[0] ?? 0 });
      }
    }
    output.push(token);
  }
  if (references) {
    output.push(html('</section>\n', true));
  }
  if (part) {
    output.push(html('</div>\n', true));
  }
  state.tokens = output;
  // A link whose text is a word and a number gets the label of its target: the label of a figure or a table
  // ("Abbildung 1"), the label of an appendix ("Anhang A"), or the word of the link and the number of a heading
  // ("Kapitel 2.1"). A heading without a number keeps the text of its links.
  const labels = new Map([...found.figures, ...found.tables, ...found.listings].map((caption) => [caption.id, caption.label]));
  const headings = new Map(found.headings.flatMap((heading) => [[heading.id, heading] as const, ...(heading.anchor ? [[heading.anchor, heading] as const] : [])]));
  for (const link of links) {
    const target = decodedTarget(link.open.attrGet('href')?.slice(1) ?? '');
    const entry = listLinks.get(link.open);
    if (entry) {
      // An entry of a list must find its heading, figure, table or listing.
      if (!labels.has(target) && !headings.has(target) && !ids.has(target)) {
        found.problems.push({ severity: 'warning', message: `The entry #${target} of the ${entry.list} names no heading, figure, table or listing of the file.`, line: entry.line });
      }
      continue;
    }
    const heading = headings.get(target);
    const text = link.text.map((child) => child.content).join('').trim();
    const reference = link.text.length > 0 && link.text.every((child) => child.type === 'text') && referenceText.test(text);
    if (!labels.has(target) && !heading) {
      // A link of a cross reference, by its target or by its text, such as "Kapitel 2.1", must find its target.
      if ((/^(?:fig|tab|lst|sec)-/.test(target) || reference) && !ids.has(target)) {
        found.problems.push({ severity: 'warning', message: `The link #${target} names no figure, table, listing or heading of the file.`, line: link.line });
      }
      continue;
    }
    if (!reference) {
      continue;
    }
    const words = /^(\p{L}+\.?)\s/u;
    const label = labels.get(target) ?? (heading?.appendix ? heading.number : heading?.number ? `${words.exec(text)?.[1] ?? ''} ${heading.number}` : undefined);
    if (label !== undefined) {
      link.text[0].content = label;
      for (const child of link.text.slice(1)) {
        child.content = '';
      }
    }
  }
}

/**
 * extendMarkdownIt adds the rule of the layout to a markdown-it, with the rules of the rendering of its tokens.
 * @param md - The markdown-it.
 */
function extendMarkdownIt(md: MarkdownIt): void {
  md.core.ruler.push('nimblescape_layout', (state) => {
    const env = envOf(state.env);
    if (env) {
      layoutRule(state, env.layout, env.found);
    }
  });
  md.renderer.rules[layoutHtmlType] = (tokens, index) => tokens[index].content;
  md.renderer.rules[footnoteType] = (tokens, index, options, env, self) => {
    const meta = tokens[index].meta as FootnoteMeta;
    // The text of a footnote comes from the method render of markdown-it itself, not from the method of the renderer:
    // a plugin can replace that method to put its elements around the whole HTML of a rendering, for example "Markdown
    // Preview Github Styling" in the Markdown preview of VS Code, and these elements do not belong into a footnote.
    const render = (Object.getPrototypeOf(self) as typeof self).render;
    return footnoteHtml(meta.number, render.call(self, meta.tokens, options, env), meta.link);
  };
  md.renderer.rules[listType] = (tokens, index, _options, env) => {
    const layout = envOf(env);
    return layout ? listHtml((tokens[index].meta as { code: GeneratedList }).code, layout.found, layout.layout) : '';
  };
  // The code block of a listing gets its class, and the numbers of its lines when the layout asks for them.
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const rendered = fence ? fence(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
    const listing = (tokens[index].meta as ListingMeta | null)?.layoutListing;
    return listing ? listingCode(rendered, listing.lineNumbers) : rendered;
  };
}

/**
 * layoutPlugin is the plugin of the renderer that changes the text of a rendering with a layout. It comes after the
 * other plugins, so that its rule runs after theirs.
 */
export const layoutPlugin: RenderPlugin = { name: 'layout', apiVersion: 1, extendMarkdownIt };

/**
 * createLayoutRenderer returns a renderer for the text of the pages: with the plugins, and the plugin of the layout
 * after them.
 * @param options - The options of the renderer, with its plugins.
 */
export function createLayoutRenderer(options: Omit<RendererOptions, 'footnotes'> = {}): MarkdownRenderer {
  return new MarkdownRenderer({ ...options, plugins: [...(options.plugins ?? []), layoutPlugin], footnotes: 'end' });
}

/** LayoutText is the HTML of the text of a document in its layout, and what the layout found in it. */
export interface LayoutText extends TextFound {
  html: string;
  /** slots are the tokens that plugins show, by the index of their placeholders in the HTML. */
  slots: ReturnType<MarkdownRenderer['toHtml']>['slots'];
}

/**
 * renderText returns the HTML of the text of a document in its layout, with soft hyphens when the layout asks for them.
 * @param renderer - The renderer, from createLayoutRenderer.
 * @param text - The text of the file; the renderer leaves its front matter out.
 * @param layout - The layout of the document.
 * @param hyphenate - The hyphenation of a text, or undefined for no hyphens.
 * @param env - Values that the plugins find in the environment of markdown-it, as in the Markdown preview of VS Code.
 */
export function renderText(renderer: MarkdownRenderer, text: string, layout: Layout, hyphenate?: (text: string) => string, env: Readonly<Record<string, unknown>> = {}): LayoutText {
  const found = emptyFound();
  const rendering = renderer.toHtml(text, { ...env, [layoutEnvKey]: { layout, found } satisfies LayoutEnv });
  return { ...found, html: hyphenate ? hyphenateHtml(rendering.html, hyphenate) : rendering.html, slots: rendering.slots };
}
