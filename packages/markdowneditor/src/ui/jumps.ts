// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The jumps in the document of the editor (docs/editor.md, R-EDIT-014). Ctrl+click (Cmd+click on macOS) on a link to a
// place of the document goes to that place: a link `#id` to the heading with that GitHub ID, or to an element of HTML or
// a node of a plugin with that ID or name; a footnote reference to its definition, and the label of a definition to its
// first reference. A plugin jumps with `jumpTo`, for example to the target of a generated part (R-EDIT-011). The editor
// keeps the place where each jump started, and the places move with the changes of the text. "Go Back" returns to the
// place before the jump, at the same height in the view, and "Go Forward" goes to the place of the jump again: with the
// keys that the integrating code gives, for example those of Go Back and Go Forward of VS Code, with the back and
// forward buttons of the mouse, and with the buttons of the toolbar, which show once the editor has a place. A key
// without a place to go to goes on to the page, for example to Go Back of VS Code.

import { slug } from '@nimblescape/markdownrender';
import { currentKeys, type JumpKeysOption, matchesKey } from '@nimblescape/markdownrender/jumps';
import type { Node as PmNode } from '@tiptap/pm/model';
import { type EditorState, Plugin, PluginKey, Selection, TextSelection, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/** Place is a place of the document: the selection, and the height of the cursor in the view when it is known. */
export interface Place {
  readonly anchor: number;
  readonly head: number;
  /** top is the distance in pixels from the top of the scrolling area to the cursor. */
  readonly top?: number;
}

/** Jumps are the places of the two directions. */
interface Jumps {
  readonly back: readonly Place[];
  readonly forward: readonly Place[];
}

/** JumpMeta is the step of a transaction in the places: a jump, or a step back or forward from a place. */
type JumpMeta = { readonly kind: 'jump'; readonly from: Place } | { readonly kind: 'back' | 'forward'; readonly from: Place };

/** maximum is the number of places that each direction keeps. */
const maximum = 50;

/** jumpsKey is the key of the plugin of the jumps. */
export const jumpsKey = new PluginKey<Jumps>('nsmdJumps');

/**
 * mapPlace moves a place with the changes of a transaction.
 * @param place - The place.
 * @param tr - The transaction.
 */
const mapPlace = (place: Place, tr: Transaction): Place => ({ ...place, anchor: tr.mapping.map(place.anchor), head: tr.mapping.map(place.head) });

/**
 * scrollerOf returns the element that scrolls the view: the nearest element around it that scrolls, else the element of
 * the page that scrolls.
 * @param view - The view.
 */
function scrollerOf(view: EditorView): Element | undefined {
  const doc = view.dom.ownerDocument;
  for (let element = view.dom.parentElement; element; element = element.parentElement) {
    const overflow = doc.defaultView?.getComputedStyle(element).overflowY ?? '';
    if (/(auto|scroll|overlay)/.test(overflow) && element.scrollHeight > element.clientHeight) {
      return element;
    }
  }
  return doc.scrollingElement ?? undefined;
}

/**
 * topOf returns the top of the visible area of a scrolling element in the coordinates of the window.
 * @param scroller - The scrolling element.
 */
const topOf = (scroller: Element): number => (scroller === scroller.ownerDocument.scrollingElement ? 0 : scroller.getBoundingClientRect().top);

/**
 * heightAt returns the distance from the top of the scrolling area to a position, or undefined when the view cannot
 * measure it, for example without a layout.
 * @param view - The view.
 * @param pos - The position.
 */
function heightAt(view: EditorView, pos: number): number | undefined {
  const scroller = scrollerOf(view);
  try {
    const top = view.coordsAtPos(Math.min(pos, view.state.doc.content.size)).top;
    return scroller && Number.isFinite(top) ? top - topOf(scroller) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * placeAt returns the place of a position, or of the selection.
 * @param view - The view.
 * @param pos - The position; the default is the selection.
 */
export function placeAt(view: EditorView, pos?: number): Place {
  const { anchor, head } = pos === undefined ? view.state.selection : { anchor: pos, head: pos };
  const top = heightAt(view, head);
  return top === undefined ? { anchor, head } : { anchor, head, top };
}

/**
 * selectionAt returns a selection of a place, near the place when it is no place for a text cursor.
 * @param doc - The document.
 * @param anchor - The anchor.
 * @param head - The head.
 */
function selectionAt(doc: PmNode, anchor: number, head: number): Selection {
  const size = doc.content.size;
  const $anchor = doc.resolve(Math.max(0, Math.min(anchor, size)));
  const $head = doc.resolve(Math.max(0, Math.min(head, size)));
  return $anchor.parent.inlineContent && $head.parent.inlineContent ? TextSelection.between($anchor, $head) : Selection.near($head);
}

/**
 * centerAt scrolls the view so that a position stands in the middle of the visible area, as the jump of a link does.
 * @param view - The view.
 * @param pos - The position.
 */
function centerAt(view: EditorView, pos: number): void {
  try {
    const { node } = view.domAtPos(pos);
    const element = node instanceof Element ? node : node.parentElement;
    element?.scrollIntoView?.({ block: 'center' });
  } catch {
    // The transaction scrolled the position into view.
  }
}

/**
 * scrollToPlace scrolls the view so that the cursor stands at the height of its place again, or in the middle of the
 * view when the place has no height.
 * @param view - The view.
 * @param place - The place.
 */
function scrollToPlace(view: EditorView, place: Place): void {
  const scroller = scrollerOf(view);
  const now = heightAt(view, view.state.selection.head);
  if (place.top === undefined || now === undefined || !scroller) {
    centerAt(view, view.state.selection.head);
    return;
  }
  scroller.scrollTop += now - place.top;
}

/**
 * jumpTo goes to a position of the document, for example the target of a link, with the cursor there in the middle of
 * the view, and keeps the place where the jump started for "Go Back".
 * @param view - The view.
 * @param target - The position of the target.
 * @param from - The position where the jump started, for example of the clicked link; the default is the selection.
 */
export function jumpTo(view: EditorView, target: number, from?: number): void {
  const meta: JumpMeta = { kind: 'jump', from: placeAt(view, from) };
  const { state } = view;
  const selection = selectionAt(state.doc, target, target);
  view.dispatch(state.tr.setSelection(selection).setMeta(jumpsKey, meta).setMeta('addToHistory', false).scrollIntoView());
  centerAt(view, selection.head);
  view.focus();
}

/**
 * go goes to the last place of a direction, and keeps the place of now in the other direction.
 * @param view - The view.
 * @param kind - The direction.
 * @returns Whether there was a place.
 */
function go(view: EditorView, kind: 'back' | 'forward'): boolean {
  const jumps = jumpsKey.getState(view.state);
  const place = jumps?.[kind].at(-1);
  if (!place) {
    return false;
  }
  const meta: JumpMeta = { kind, from: placeAt(view) };
  const { state } = view;
  view.dispatch(state.tr.setSelection(selectionAt(state.doc, place.anchor, place.head)).setMeta(jumpsKey, meta).setMeta('addToHistory', false));
  scrollToPlace(view, place);
  view.focus();
  return true;
}

/** goBack returns to the place before the last jump, and returns whether there was one. */
export const goBack = (view: EditorView): boolean => go(view, 'back');

/** goForward goes to the place of the jump that "Go Back" left, and returns whether there was one. */
export const goForward = (view: EditorView): boolean => go(view, 'forward');

/**
 * canGo returns whether a direction has a place.
 * @param state - The state of the editor.
 * @param kind - The direction.
 */
export const canGo = (state: EditorState, kind: 'back' | 'forward'): boolean => (jumpsKey.getState(state)?.[kind].length ?? 0) > 0;

/**
 * hasPlaces returns whether the editor has a place in one of the directions, so that the toolbar shows its buttons.
 * @param state - The state of the editor.
 */
export const hasPlaces = (state: EditorState): boolean => canGo(state, 'back') || canGo(state, 'forward');

/**
 * decoded returns a fragment without its percent-encoding, or the fragment itself when its encoding is wrong.
 * @param fragment - The fragment.
 */
function decoded(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/** escaped returns a text for a regular expression. */
const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * targetOf returns the position of the place that the ID of a link names: an element of HTML or a node of a plugin
 * with that ID or name, else the heading with that GitHub ID, as the renderer gives it; or undefined.
 * @param doc - The document.
 * @param id - The ID, without "#" and without its encoding.
 */
export function targetOf(doc: PmNode, id: string): number | undefined {
  const attribute = new RegExp(`\\s(?:id|name)\\s*=\\s*(["']?)${escaped(id)}\\1(?=[\\s/>])`, 'i');
  let anchor: number | undefined;
  let heading: number | undefined;
  const ids = new Set<string>();
  doc.descendants((node, pos) => {
    if (anchor !== undefined) {
      return false;
    }
    const html = typeof node.attrs.html === 'string' ? node.attrs.html : node.type.name.startsWith('raw') && typeof node.attrs.text === 'string' ? node.attrs.text : '';
    if ((html && /^\s*</.test(html) && attribute.test(html)) || (node.isAtom && node.isInline && (node.attrs.id === id || node.attrs.name === id))) {
      // The anchor stands in its block: the jump goes to the block.
      const $pos = doc.resolve(pos);
      anchor = node.isInline ? $pos.start() : pos;
      return false;
    }
    if (node.type.name === 'heading') {
      const base = slug(node.textContent);
      let own = base;
      for (let count = 1; ids.has(own); count++) {
        own = `${base}-${count}`;
      }
      ids.add(own);
      if (own === id && heading === undefined) {
        heading = pos + 1;
      }
    }
    return true;
  });
  return anchor ?? heading;
}

/**
 * footnoteTarget returns the target of a click on a footnote: the definition of a reference, or the first reference of
 * the label of a definition.
 * @param doc - The document.
 * @param kind - The node that the user clicked.
 * @param label - The label of the footnote.
 */
function footnoteTarget(doc: PmNode, kind: 'reference' | 'definition', label: string): number | undefined {
  let found: number | undefined;
  const wanted = kind === 'reference' ? 'footnoteDefinition' : 'footnoteReference';
  doc.descendants((node, pos) => {
    if (found !== undefined) {
      return false;
    }
    if (node.type.name === wanted && node.attrs.label === label) {
      found = kind === 'reference' ? pos + 1 : pos;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * linkTarget returns the position where a Ctrl+click goes, and the position where the jump starts: a link to a place of
 * the document, a footnote reference or the label of a footnote definition; or undefined for another click.
 * @param view - The view.
 * @param pos - The position of the click.
 * @param event - The event of the click.
 */
function linkTarget(view: EditorView, pos: number, event: MouseEvent): number | undefined {
  const target = event.target instanceof Element ? event.target : null;
  const { doc } = view.state;
  const link = target?.closest('a[href]');
  const href = link && view.dom.contains(link) ? (link.getAttribute('href') ?? '') : '';
  if (href.startsWith('#') && href.length > 1) {
    return targetOf(doc, decoded(href.slice(1)));
  }
  const reference = target?.closest('.nsmd-footnote-reference');
  if (reference && view.dom.contains(reference)) {
    return footnoteTarget(doc, 'reference', reference.getAttribute('data-label') ?? '');
  }
  // The label of a definition is the start of the element of the definition, before its first block.
  const first = target?.classList.contains('nsmd-footnote') ? target.firstElementChild : null;
  if (target && first && event.clientX < first.getBoundingClientRect().left) {
    return footnoteTarget(doc, 'definition', target.getAttribute('data-label') ?? '');
  }
  return undefined;
}

/** JumpsOptions configure the jumps of an editor. */
export interface JumpsOptions {
  /**
   * keys are the keys of Go Back and Go Forward, or a function that returns the keys of now, for keys that the user can
   * change while the editor shows; without them, the mouse and the toolbar go back and forward.
   */
  readonly keys?: JumpKeysOption;
  /** mouseButtons false leaves the back and forward buttons of the mouse to the platform; the default is true. */
  readonly mouseButtons?: boolean;
}

/**
 * jumpsPlugin returns the plugin of the jumps: it keeps the places, follows the links on Ctrl+click and goes back and
 * forward with the keys and the buttons of the mouse.
 * @param options - The keys and the buttons of the mouse.
 */
export function jumpsPlugin(options: JumpsOptions = {}): Plugin<Jumps> {
  return new Plugin<Jumps>({
    key: jumpsKey,
    state: {
      init: () => ({ back: [], forward: [] }),
      apply: (tr, value) => {
        const meta = tr.getMeta(jumpsKey) as JumpMeta | undefined;
        let { back, forward } = tr.docChanged ? { back: value.back.map((place) => mapPlace(place, tr)), forward: value.forward.map((place) => mapPlace(place, tr)) } : value;
        if (meta?.kind === 'jump') {
          back = [...back, meta.from].slice(-maximum);
          forward = [];
        } else if (meta?.kind === 'back') {
          back = back.slice(0, -1);
          forward = [...forward, meta.from].slice(-maximum);
        } else if (meta?.kind === 'forward') {
          forward = forward.slice(0, -1);
          back = [...back, meta.from].slice(-maximum);
        }
        return back === value.back && forward === value.forward ? value : { back, forward };
      },
    },
    props: {
      handleClick: (view, pos, event) => {
        if (!(event.ctrlKey || event.metaKey)) {
          return false;
        }
        const target = linkTarget(view, pos, event);
        if (target === undefined) {
          return false;
        }
        jumpTo(view, target, pos);
        return true;
      },
      handleKeyDown: (view, event) => {
        const keys = currentKeys(options.keys);
        if (keys?.back.some((key) => matchesKey(event, key))) {
          return goBack(view);
        }
        if (keys?.forward.some((key) => matchesKey(event, key))) {
          return goForward(view);
        }
        return false;
      },
      handleDOMEvents: {
        mouseup: (view, event) => {
          if (options.mouseButtons === false || (event.button !== 3 && event.button !== 4)) {
            return false;
          }
          const went = event.button === 3 ? goBack(view) : goForward(view);
          if (went) {
            event.preventDefault();
          }
          return went;
        },
      },
    },
  });
}
