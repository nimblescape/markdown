// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the way back after a jump in a rendered page (docs/rendering.md, R-REN-004): the keys of Go Back and Go
// Forward of VS Code, a click on a link to a place of the page that moves the page, Go Back and Go Forward with the
// keys, the mouse buttons and the buttons of the page, the places of a content over a load of the page again, and one
// set of jumps for two scripts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPageJumps, keyLabel, matchesKey, type PageJumps, platformOf, vscodeJumpKeys } from './jumps';

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });

describe('the keys', () => {
  it('are the keys of Go Back and Go Forward of VS Code on each platform', () => {
    expect(vscodeJumpKeys('linux')).toEqual({ back: ['Ctrl-Alt--', 'BrowserBack'], forward: ['Ctrl-Shift--', 'BrowserForward'] });
    expect(vscodeJumpKeys('mac')).toEqual({ back: ['Ctrl--', 'BrowserBack'], forward: ['Ctrl-Shift--', 'BrowserForward'] });
    expect(vscodeJumpKeys('windows')).toEqual({ back: ['Alt-ArrowLeft', 'BrowserBack'], forward: ['Alt-ArrowRight', 'BrowserForward'] });
  });

  it('find the platform in the data of the browser', () => {
    expect(platformOf({ platform: 'MacIntel' })).toBe('mac');
    expect(platformOf({ platform: 'Win32' })).toBe('windows');
    expect(platformOf({ platform: 'Linux x86_64' })).toBe('linux');
  });

  it('match an event with exactly the modifiers of the key, and the minus key also by its place when Shift changes it', () => {
    expect(matchesKey(key({ key: '-', code: 'Minus', ctrlKey: true, altKey: true }), 'Ctrl-Alt--')).toBe(true);
    expect(matchesKey(key({ key: '-', code: 'Minus', ctrlKey: true }), 'Ctrl-Alt--')).toBe(false);
    expect(matchesKey(key({ key: '_', code: 'Minus', ctrlKey: true, shiftKey: true }), 'Ctrl-Shift--')).toBe(true);
    expect(matchesKey(key({ key: 'ArrowLeft', altKey: true }), 'Alt-ArrowLeft')).toBe(true);
    expect(matchesKey(key({ key: 'BrowserBack' }), 'BrowserBack')).toBe(true);
  });

  it('have names for the tooltips', () => {
    expect(keyLabel('Ctrl-Alt--', 'linux')).toBe('Ctrl+Alt+-');
    expect(keyLabel('Alt-ArrowLeft', 'windows')).toBe('Alt+Left');
    expect(keyLabel('Ctrl-Shift--', 'mac')).toBe('Ctrl+Shift+-');
  });
});

describe('the jumps of a page', () => {
  let jumps: PageJumps | undefined;
  let source = 'file:///a.md';

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<p><a id="link" href="#target">Go</a></p><h2 id="target">Target</h2><a id="outside" href="other.md">Other</a>';
    // The page moves to the place of the link, as the browser or a script of the page does.
    document.addEventListener('click', (event) => {
      const link = (event.target as Element).closest('a[href^="#"]');
      if (link) {
        event.preventDefault();
        window.scrollTo(0, 800);
      }
    });
    window.scrollTo(0, 100);
    sessionStorage.clear();
  });

  afterEach(() => {
    jumps?.dispose();
    jumps = undefined;
    vi.useRealTimers();
  });

  /** clickLink clicks the link and waits until the page moved. */
  const clickLink = (id = 'link') => {
    document.getElementById(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(100);
  };

  /** buttons returns the buttons Back and Forward of the page. */
  const buttons = () => {
    const host = document.querySelector('nimblescape-jumps') as HTMLElement;
    const [back, forward] = Array.from(host.shadowRoot!.querySelectorAll('button'));
    return { host, back, forward };
  };

  it('keeps the place before a click on a link to a place of the page that moved the page, and goes back and forward', () => {
    jumps = installPageJumps(window, { keys: vscodeJumpKeys('linux') });
    clickLink();
    expect(window.scrollY).toBe(800);
    expect(jumps.canGoBack).toBe(true);
    expect(jumps.back()).toBe(true);
    expect(window.scrollY).toBe(100);
    expect(jumps.canGoForward).toBe(true);
    expect(jumps.forward()).toBe(true);
    expect(window.scrollY).toBe(800);
  });

  it('goes back to the same content when the page became higher, for example by a zoom of its pages', () => {
    let height = 2000;
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => height });
    jumps = installPageJumps(window);
    clickLink();
    height = 4000;
    expect(jumps.back()).toBe(true);
    expect(window.scrollY).toBe(200);
    delete (document.documentElement as { scrollHeight?: number }).scrollHeight;
  });

  it('keeps no place for a link to another file or a click that does not move the page', () => {
    jumps = installPageJumps(window);
    clickLink('outside');
    window.scrollTo(0, 800);
    clickLink();
    expect(jumps.canGoBack).toBe(false);
  });

  it('goes back with the key and keeps the key from the platform, and leaves the key to the platform without a place', () => {
    jumps = installPageJumps(window, { keys: vscodeJumpKeys('linux') });
    const platform = vi.fn();
    window.addEventListener('keydown', platform);
    const before = key({ key: '-', code: 'Minus', ctrlKey: true, altKey: true });
    document.body.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(false);
    expect(platform).toHaveBeenCalledTimes(1);
    clickLink();
    const back = key({ key: '-', code: 'Minus', ctrlKey: true, altKey: true });
    document.body.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(platform).toHaveBeenCalledTimes(1);
    expect(window.scrollY).toBe(100);
    document.body.dispatchEvent(key({ key: '_', code: 'Minus', ctrlKey: true, shiftKey: true }));
    expect(window.scrollY).toBe(800);
    window.removeEventListener('keydown', platform);
  });

  it('goes back and forward with the buttons of the mouse, unless the platform takes them', () => {
    jumps = installPageJumps(window);
    clickLink();
    document.body.dispatchEvent(new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true }));
    expect(window.scrollY).toBe(100);
    document.body.dispatchEvent(new MouseEvent('mouseup', { button: 4, bubbles: true, cancelable: true }));
    expect(window.scrollY).toBe(800);
    jumps.dispose();
    jumps = installPageJumps(window, { mouseButtons: false });
    window.scrollTo(0, 100);
    clickLink();
    document.body.dispatchEvent(new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true }));
    expect(jumps.canGoBack).toBe(true);
  });

  it('shows the buttons Back and Forward only while there is a place in their direction', () => {
    jumps = installPageJumps(window, { keys: vscodeJumpKeys('windows'), platform: 'windows' });
    const { host, back, forward } = buttons();
    expect(host.parentElement).toBe(document.documentElement);
    expect(host.style.display).toBe('none');
    expect(back.title).toBe('Go Back (Alt+Left)');
    clickLink();
    expect(host.style.display).toBe('flex');
    expect(back.style.display).toBe('');
    expect(forward.style.display).toBe('none');
    back.click();
    expect(window.scrollY).toBe(100);
    expect(back.style.display).toBe('none');
    expect(forward.style.display).toBe('');
  });

  it('keeps the places of the content over a load of the page again, and starts without places for another content', () => {
    const key = () => source;
    jumps = installPageJumps(window, { key });
    clickLink();
    jumps.dispose();
    jumps = installPageJumps(window, { key });
    expect(jumps.canGoBack).toBe(true);
    source = 'file:///b.md';
    expect(jumps.canGoBack).toBe(false);
    source = 'file:///a.md';
  });

  it('installs the jumps once for two scripts of the page', () => {
    jumps = installPageJumps(window);
    expect(installPageJumps(window, { keys: vscodeJumpKeys('mac') })).toBe(jumps);
    expect(document.querySelectorAll('nimblescape-jumps')).toHaveLength(1);
  });
});
