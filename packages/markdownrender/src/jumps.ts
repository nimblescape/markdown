// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The way back after a jump in a rendered page (docs/rendering.md, R-REN-004), the entry point
// `@nimblescape/markdownrender/jumps`: a click on a link to a place of the page itself, such as an entry of the table of
// contents, a reference to a figure, a citation or a footnote, moves the page; the page keeps the place where it was.
// "Go Back" returns to that place and "Go Forward" goes to the place of the link again, as in a browser: with the keys
// that the integrating code gives, for example those of Go Back and Go Forward of VS Code, with the back and forward
// buttons of the mouse, and with the buttons "Back" and "Forward" that show at the bottom right while there is a place
// to go to. The editor of nimblescape Markdown has its own places, which move with the changes of the text
// (docs/editor.md, R-EDIT-014); it uses the keys and the names of the keys of this module.
//
// The module has no imports and changes nothing of the page outside its own element, so that a script of a page can
// bundle it, for example the scripts of the Markdown preview of VS Code of Markdown Notes and Markdown Paper. The first
// script of a page that installs the jumps installs them; a second one gets the same jumps, so that two scripts with
// the jumps in one page make no two places of one jump.

/** JumpKeys are the keys of Go Back and Go Forward, in the notation of ProseMirror, for example `Ctrl-Alt--`. */
export interface JumpKeys {
  readonly back: readonly string[];
  readonly forward: readonly string[];
}

/** Platform is the system of the user, for the keys of a platform. */
export type Platform = 'mac' | 'windows' | 'linux';

/**
 * platformOf returns the system of the user from the data of the browser.
 * @param navigator - The navigator of the browser, or of a test.
 */
export function platformOf(navigator: { readonly platform?: string; readonly userAgent?: string }): Platform {
  const text = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
  return /Mac|iPhone|iPad/i.test(text) ? 'mac' : /Win/i.test(text) ? 'windows' : 'linux';
}

/**
 * vscodeJumpKeys returns the keys of the commands Go Back and Go Forward of VS Code on a platform, with the keys
 * BrowserBack and BrowserForward of some keyboards, which VS Code also binds to them.
 * @param platform - The platform.
 */
export function vscodeJumpKeys(platform: Platform): JumpKeys {
  switch (platform) {
    case 'mac':
      return { back: ['Ctrl--', 'BrowserBack'], forward: ['Ctrl-Shift--', 'BrowserForward'] };
    case 'windows':
      return { back: ['Alt-ArrowLeft', 'BrowserBack'], forward: ['Alt-ArrowRight', 'BrowserForward'] };
    default:
      return { back: ['Ctrl-Alt--', 'BrowserBack'], forward: ['Ctrl-Shift--', 'BrowserForward'] };
  }
}

/** KeyEvent is the part of a keyboard event that the keys compare. */
export type KeyEvent = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>;

/**
 * partsOf returns the modifiers and the key of a key in the notation of ProseMirror: `Ctrl-Alt--` has the key `-`.
 * @param key - The key.
 */
function partsOf(key: string): { modifiers: Set<string>; name: string } {
  const parts = key.split(/-(?!$)/);
  const name = parts.pop() ?? '';
  return { modifiers: new Set(parts.map((part) => part.toLowerCase())), name };
}

/**
 * matchesKey returns whether a keyboard event is a key in the notation of ProseMirror, with exactly its modifiers. The
 * minus key matches by its place on the keyboard too, since Shift changes its character, for example to `_`.
 * @param event - The event.
 * @param key - The key, for example `Ctrl-Shift--`.
 */
export function matchesKey(event: KeyEvent, key: string): boolean {
  const { modifiers, name } = partsOf(key);
  if (
    event.ctrlKey !== modifiers.has('ctrl') ||
    event.altKey !== modifiers.has('alt') ||
    event.shiftKey !== modifiers.has('shift') ||
    event.metaKey !== (modifiers.has('meta') || modifiers.has('cmd'))
  ) {
    return false;
  }
  if (name === '-') {
    return event.key === '-' || event.key === '_' || event.code === 'Minus' || event.code === 'NumpadSubtract';
  }
  return event.key.toLowerCase() === name.toLowerCase();
}

/**
 * keyLabel returns the name of a key for a tooltip, for example `Ctrl+Alt+-` for `Ctrl-Alt--`.
 * @param key - The key in the notation of ProseMirror.
 * @param platform - The platform, which names Meta as Cmd on macOS.
 */
export function keyLabel(key: string, platform: Platform): string {
  const { modifiers, name } = partsOf(key);
  const names: Record<string, string> = { ctrl: 'Ctrl', alt: platform === 'mac' ? 'Option' : 'Alt', shift: 'Shift', meta: platform === 'mac' ? 'Cmd' : 'Meta', cmd: 'Cmd' };
  return [...[...modifiers].map((modifier) => names[modifier] ?? modifier), name.replace(/^Arrow/, '')].join('+');
}

/** PagePlace is a place of a page: how far it was scrolled. */
export interface PagePlace {
  readonly x: number;
  readonly y: number;
}

/** PageJumpsOptions configure the jumps of a page. */
export interface PageJumpsOptions {
  /** keys are the keys of Go Back and Go Forward; without them, only the mouse and the buttons go back and forward. */
  readonly keys?: JumpKeys;
  /**
   * mouseButtons false leaves the back and forward buttons of the mouse to the platform, for example to VS Code on
   * Windows, which gives them to its own commands Go Back and Go Forward also over a webview. The default is true.
   */
  readonly mouseButtons?: boolean;
  /** platform names the keys in the tooltips; the default comes from the browser. */
  readonly platform?: Platform;
  /**
   * key names the content of the page, for example the URI of the file of a preview, so that the places belong to it.
   * With a key, the places stay in the storage of the session over a load of the page again; the default is none.
   */
  readonly key?: () => string | undefined;
}

/** PageJumps are the jumps of a page. */
export interface PageJumps {
  /** back returns to the place before the last jump, and returns whether there was one. */
  back(): boolean;
  /** forward goes to the place of the jump that Go Back left, and returns whether there was one. */
  forward(): boolean;
  /** canGoBack and canGoForward tell whether there is a place to go to. */
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  /** dispose removes the listeners and the buttons. */
  dispose(): void;
}

/** maximum is the number of places that each direction keeps. */
const maximum = 50;

/** storageKey is the key of the places in the storage of the session. */
const storageKey = 'nimblescape-jumps';

/** Stacks are the places of the two directions of one content. */
interface Stacks {
  key: string | undefined;
  back: PagePlace[];
  forward: PagePlace[];
}

/** isPlace is true for a place from the storage. */
const isPlace = (value: unknown): value is PagePlace =>
  typeof value === 'object' && value !== null && Number.isFinite((value as PagePlace).x) && Number.isFinite((value as PagePlace).y);

/**
 * samePageLink returns the link to a place of the page itself that a click event hit, or undefined.
 * @param event - The event.
 */
function samePageLink(event: Event): HTMLAnchorElement | undefined {
  const target = event.composedPath()[0];
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const link = element?.closest('a[href]');
  return link instanceof HTMLAnchorElement && (link.getAttribute('href') ?? '').startsWith('#') && link.getAttribute('href') !== '#' ? link : undefined;
}

/** Window with the jumps that a script of the page installed. */
type WindowWithJumps = Window & { nimblescapePageJumps?: PageJumps };

/**
 * installPageJumps installs the jumps in a page, or returns the jumps that a script of the page installed before.
 * @param win - The window of the page.
 * @param options - The keys, the mouse buttons and the key of the content.
 */
export function installPageJumps(win: Window, options: PageJumpsOptions = {}): PageJumps {
  const known = (win as WindowWithJumps).nimblescapePageJumps;
  if (known) {
    return known;
  }
  const doc = win.document;
  const platform = options.platform ?? platformOf(win.navigator);
  const keyOf = options.key;
  const storage = (() => {
    try {
      return keyOf ? win.sessionStorage : undefined;
    } catch {
      return undefined;
    }
  })();

  const read = (): Stacks => {
    const key = keyOf?.();
    try {
      const kept = JSON.parse(storage?.getItem(storageKey) ?? 'null') as Partial<Stacks> | null;
      if (kept && kept.key === key && Array.isArray(kept.back) && Array.isArray(kept.forward)) {
        return { key, back: kept.back.filter(isPlace), forward: kept.forward.filter(isPlace) };
      }
    } catch {
      // A storage that cannot be read keeps no places.
    }
    return { key, back: [], forward: [] };
  };
  let stacks = read();
  /** current returns the places of the content that shows now: another content starts without places. */
  const current = (): Stacks => {
    if (keyOf && keyOf() !== stacks.key) {
      stacks = read();
    }
    return stacks;
  };
  const write = () => {
    try {
      storage?.setItem(storageKey, JSON.stringify(stacks));
    } catch {
      // The places stay in the page.
    }
    show();
  };
  const here = (): PagePlace => ({ x: win.scrollX, y: win.scrollY });
  const go = (place: PagePlace) => win.scrollTo({ left: place.x, top: place.y, behavior: 'instant' });

  // The buttons stand in their own shadow tree in the root element, outside the body, so that the styles of the page,
  // the scripts that change the body and the clicks on the content do not reach them, and their styles change nothing
  // of the page.
  const host = doc.createElement('nimblescape-jumps');
  host.style.cssText = 'position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; display: none; gap: 4px;';
  const shadow = host.attachShadow({ mode: 'open' });
  const button = (label: string, arrow: string, title: string, run: () => boolean) => {
    const element = doc.createElement('button');
    element.type = 'button';
    element.textContent = label === 'Back' ? `${arrow} ${label}` : `${label} ${arrow}`;
    element.title = title;
    element.setAttribute('aria-label', title);
    element.style.cssText = [
      'font: 12px/1.4 var(--vscode-font-family, system-ui, sans-serif)',
      'padding: 4px 10px',
      'margin-left: 4px',
      'border-radius: 4px',
      // The colors of the floating widgets of VS Code, such as the find widget: a solid background in each theme, also
      // over the white pages of a paper.
      'border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, rgba(128, 128, 128, 0.5)))',
      'color: var(--vscode-editorWidget-foreground, #333)',
      'background: var(--vscode-editorWidget-background, #f3f3f3)',
      'box-shadow: 0 1px 4px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.25))',
      'cursor: pointer',
    ].join('; ');
    // The press keeps the selection and the focus of the page.
    element.addEventListener('mousedown', (event) => event.preventDefault());
    element.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      run();
    });
    return element;
  };
  const label = (keys: readonly string[] | undefined) => (keys?.[0] ? ` (${keyLabel(keys[0], platform)})` : '');
  const backButton = button('Back', '←', `Go Back${label(options.keys?.back)}`, () => jumps.back());
  const forwardButton = button('Forward', '→', `Go Forward${label(options.keys?.forward)}`, () => jumps.forward());
  shadow.append(backButton, forwardButton);
  const show = () => {
    const { back, forward } = stacks;
    host.style.display = back.length > 0 || forward.length > 0 ? 'flex' : 'none';
    backButton.style.display = back.length > 0 ? '' : 'none';
    forwardButton.style.display = forward.length > 0 ? '' : 'none';
  };

  const jumps: PageJumps = {
    back() {
      const { back, forward } = current();
      const place = back.pop();
      if (!place) {
        return false;
      }
      forward.push(here());
      go(place);
      write();
      return true;
    },
    forward() {
      const { back, forward } = current();
      const place = forward.pop();
      if (!place) {
        return false;
      }
      back.push(here());
      go(place);
      write();
      return true;
    },
    get canGoBack() {
      return current().back.length > 0;
    },
    get canGoForward() {
      return current().forward.length > 0;
    },
    dispose() {
      win.removeEventListener('click', onClick, true);
      win.removeEventListener('keydown', onKey, true);
      win.removeEventListener('mouseup', onMouse, true);
      host.remove();
      delete (win as WindowWithJumps).nimblescapePageJumps;
    },
  };

  // The window gets the click before the page and its scripts, which then move the page to the place of the link. The
  // jump counts when the page moved.
  const onClick = (event: MouseEvent) => {
    if (event.button !== 0 || !samePageLink(event)) {
      return;
    }
    const before = here();
    win.setTimeout(() => {
      const after = here();
      if (after.x === before.x && after.y === before.y) {
        return;
      }
      const { back, forward } = current();
      back.push(before);
      back.splice(0, Math.max(0, back.length - maximum));
      forward.length = 0;
      write();
    }, 50);
  };
  // A key that goes back or forward stays in the page, so that the platform does not go back too; without a place, the
  // key goes on to the platform, for example to Go Back of VS Code.
  const onKey = (event: KeyboardEvent) => {
    const keys = options.keys;
    const run = keys?.back.some((key) => matchesKey(event, key)) ? jumps.back : keys?.forward.some((key) => matchesKey(event, key)) ? jumps.forward : undefined;
    if (run?.()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const onMouse = (event: MouseEvent) => {
    const run = event.button === 3 ? jumps.back : event.button === 4 ? jumps.forward : undefined;
    if (run?.()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  win.addEventListener('click', onClick, true);
  win.addEventListener('keydown', onKey, true);
  if (options.mouseButtons ?? true) {
    win.addEventListener('mouseup', onMouse, true);
  }
  doc.documentElement.append(host);
  show();
  (win as WindowWithJumps).nimblescapePageJumps = jumps;
  return jumps;
}
