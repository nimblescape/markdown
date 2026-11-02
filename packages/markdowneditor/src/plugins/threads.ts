// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The threads beside the text (docs/editor.md, R-GEN-014): a plugin returns the passages of the document that have a
// thread, for example a note or an AI chat. The editor shows an icon beside the first line of each passage, at the right
// of the text, with the number of answers. A click on the icon opens the panel of the thread beside the text, at the
// height of the passage, and marks the passage; the plugin fills the panel. The close button, Escape in the panel and a
// second click on the icon close it. The integrating code may leave the icons out and show the threads in a view of its
// own; the API of the editor still opens and closes the panel.

import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { button, element, icon } from '../ui/dom';
import { dispose, type Disposable, type MarkdownPlugin, type PluginEditor, type PluginThreads, type ThreadMarker } from './api';
import type { DocCache } from './cache';

/** ThreadEntry is a thread of a plugin. */
export interface ThreadEntry {
  readonly threads: PluginThreads;
  readonly marker: ThreadMarker;
}

/** ThreadsState is the state of the threads: the ID of the open thread, and the version of the threads. */
interface ThreadsState {
  readonly open: string | undefined;
  readonly version: number;
}

/** threadsKey is the key of the plugin of the threads. Its meta `{ open }` opens or closes a thread, `{ refresh }` asks again. */
export const threadsKey = new PluginKey<ThreadsState>('nsmdThreads');

/**
 * threadEntries returns the threads of the plugins of a document, with positions inside the document.
 * @param plugins - The plugins.
 * @param doc - The document.
 */
export function threadEntries(plugins: readonly MarkdownPlugin[], doc: Node): ThreadEntry[] {
  const size = doc.content.size;
  const entries: ThreadEntry[] = [];
  for (const plugin of plugins) {
    const threads = plugin.threads;
    if (!threads) {
      continue;
    }
    for (const marker of threads.find(doc)) {
      if (marker.from >= 0 && marker.to <= size && marker.from <= marker.to) {
        entries.push({ threads, marker });
      }
    }
  }
  return entries.sort((a, b) => a.marker.from - b.marker.from);
}

/** ThreadsHost is what the threads need from the editor. */
export interface ThreadsHost {
  /** box is the box of the editor, which holds the icons and the panel. */
  readonly box: HTMLElement;
  /** icons false leaves the icons out. */
  readonly icons: boolean;
  /** entries are the threads of each document. */
  readonly entries: DocCache<ThreadEntry[]>;
  /** editor returns the API of the editor for the plugins. */
  readonly editor: () => PluginEditor;
}

/** labelOf returns the name of a thread for its icon. */
function labelOf(marker: ThreadMarker): string {
  const name = marker.label ?? (marker.kind === 'chat' ? 'AI chat' : 'Note');
  return marker.count ? `${name}, ${marker.count} ${marker.count === 1 ? 'answer' : 'answers'}` : name;
}

/** topOf returns the top of the line of a position, relative to the box of the editor. */
function topOf(view: EditorView, box: HTMLElement, pos: number): number {
  try {
    return view.coordsAtPos(pos).top - box.getBoundingClientRect().top + box.scrollTop;
  } catch {
    return 0;
  }
}

/** ThreadsView shows the icons and the panel of the threads of one editor. */
class ThreadsView {
  private readonly gutter: HTMLElement;
  private panel: { readonly id: string; readonly dom: HTMLElement; readonly disposable: void | Disposable } | undefined;
  private shownDoc: Node | undefined;
  private shownVersion = -1;

  constructor(
    private readonly view: EditorView,
    private readonly host: ThreadsHost,
  ) {
    this.gutter = element('div', { class: 'nsmd-threads', role: 'group', 'aria-label': 'Threads' });
    if (host.icons) {
      host.box.classList.add('nsmd-has-threads');
      host.box.append(this.gutter);
    }
    window.addEventListener('resize', this.onResize);
    // The lines move also when the text does not change, for example when the field of a source opens.
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.place());
      this.observer.observe(view.dom);
    }
    this.update(view);
  }

  private readonly observer: ResizeObserver | undefined;

  /** place shows the icons and the panel at the lines of their passages again. */
  private place(): void {
    this.draw();
    const entry = this.panel ? this.entry(this.panel.id) : undefined;
    if (this.panel && entry) {
      this.panel.dom.style.top = `${Math.round(topOf(this.view, this.host.box, entry.marker.from))}px`;
    }
  }

  update(view: EditorView): void {
    const state = threadsKey.getState(view.state);
    if (!state) {
      return;
    }
    if (view.state.doc !== this.shownDoc || state.version !== this.shownVersion) {
      this.shownDoc = view.state.doc;
      this.shownVersion = state.version;
      this.draw();
    }
    if (state.open !== this.panel?.id) {
      this.closePanel();
      if (state.open !== undefined) {
        this.openPanel(state.open);
      }
    } else if (this.panel) {
      const entry = this.entry(this.panel.id);
      if (entry) {
        this.panel.dom.style.top = `${Math.round(topOf(this.view, this.host.box, entry.marker.from))}px`;
      } else {
        // The passage of the open thread is gone.
        setTimeout(() => setOpenThread(this.view, undefined), 0);
      }
    }
  }

  /** entry returns the thread with an ID in the document now. */
  private entry(id: string): ThreadEntry | undefined {
    return this.host.entries.get(this.view.state.doc).find((each) => each.marker.id === id);
  }

  /** draw shows the icons of the threads beside the first line of their passages. */
  private draw(): void {
    if (!this.host.icons) {
      return;
    }
    const icons: HTMLElement[] = [];
    let below = -Infinity;
    for (const { marker } of this.host.entries.get(this.view.state.doc)) {
      const label = labelOf(marker);
      const shown = button(label, icon(marker.kind === 'chat' ? 'chat' : 'note'), () => this.toggle(marker.id));
      shown.classList.add('nsmd-thread-icon');
      shown.dataset.thread = marker.id;
      if (marker.count) {
        shown.append(element('span', { class: 'nsmd-thread-count' }, String(marker.count)));
      }
      // Icons of passages on the same line stand one below the other.
      const top = Math.max(topOf(this.view, this.host.box, marker.from), below);
      shown.style.top = `${Math.round(top)}px`;
      below = top + 26;
      icons.push(shown);
    }
    this.gutter.replaceChildren(...icons);
  }

  /** iconOf returns the icon of a thread. */
  private iconOf(id: string): HTMLElement | undefined {
    return [...this.gutter.querySelectorAll<HTMLElement>('.nsmd-thread-icon')].find((each) => each.dataset.thread === id);
  }

  /** toggle opens a thread, or closes it when it is open. */
  private toggle(id: string): void {
    setOpenThread(this.view, this.panel?.id === id ? undefined : id);
  }

  /** openPanel opens the panel of a thread beside the text, and gives it to the plugin. */
  private openPanel(id: string): void {
    const entry = this.entry(id);
    if (!entry) {
      return;
    }
    const body = element('div', { class: 'nsmd-thread-body' });
    const close = button('Close', icon('close'), () => setOpenThread(this.view, undefined));
    const dom = element(
      'div',
      { class: 'nsmd-thread-panel', role: 'dialog', 'aria-label': labelOf(entry.marker) },
      element('div', { class: 'nsmd-thread-header' }, element('span', { class: 'nsmd-thread-title' }, entry.marker.label ?? labelOf(entry.marker)), close),
      body,
    );
    dom.style.top = `${Math.round(topOf(this.view, this.host.box, entry.marker.from))}px`;
    dom.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpenThread(this.view, undefined);
        this.view.focus();
      }
    });
    this.host.box.append(dom);
    this.iconOf(id)?.setAttribute('aria-expanded', 'true');
    let disposable: void | Disposable = undefined;
    try {
      disposable = entry.threads.open(entry.marker, body, this.host.editor());
    } catch (error) {
      body.textContent = String(error);
    }
    this.panel = { id, dom, disposable };
  }

  /** closePanel closes the panel of the open thread. */
  private closePanel(): void {
    const panel = this.panel;
    if (!panel) {
      return;
    }
    this.panel = undefined;
    this.iconOf(panel.id)?.removeAttribute('aria-expanded');
    try {
      dispose(panel.disposable);
    } finally {
      panel.dom.remove();
    }
  }

  private readonly onResize = () => this.place();

  destroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.observer?.disconnect();
    this.closePanel();
    this.gutter.remove();
    this.host.box.classList.remove('nsmd-has-threads');
  }
}

/**
 * setOpenThread opens the panel of a thread, or closes the open panel.
 * @param view - The view of the editor.
 * @param id - The ID of the thread, or undefined to close the panel.
 */
export function setOpenThread(view: EditorView, id: string | undefined): void {
  if (!view.isDestroyed && threadsKey.getState(view.state)?.open !== id) {
    view.dispatch(view.state.tr.setMeta(threadsKey, { open: id }).setMeta('addToHistory', false));
  }
}

/** openThreadOf returns the ID of the open thread of a state. */
export const openThreadOf = (state: EditorState): string | undefined => threadsKey.getState(state)?.open;

/**
 * threadsPlugin returns the ProseMirror plugin of the threads beside the text.
 * @param host - What the threads need from the editor.
 */
export function threadsPlugin(host: ThreadsHost): Plugin<ThreadsState> {
  return new Plugin<ThreadsState>({
    key: threadsKey,
    state: {
      init: () => ({ open: undefined, version: 0 }),
      apply: (tr, value) => {
        const meta = tr.getMeta(threadsKey) as { open?: string; refresh?: boolean } | undefined;
        if (!meta) {
          return value;
        }
        return { open: 'open' in meta ? meta.open : value.open, version: meta.refresh ? value.version + 1 : value.version };
      },
    },
    view: (view) => new ThreadsView(view, host),
    props: {
      decorations: (state) => {
        const open = threadsKey.getState(state)?.open;
        const entry = open === undefined ? undefined : host.entries.get(state.doc).find((each) => each.marker.id === open);
        if (!entry || entry.marker.from === entry.marker.to) {
          return null;
        }
        return DecorationSet.create(state.doc, [Decoration.inline(entry.marker.from, entry.marker.to, { class: 'nsmd-thread-active' })]);
      },
    },
  });
}
