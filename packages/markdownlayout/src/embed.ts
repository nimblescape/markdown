// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The files of a page that the page in the frame cannot load itself (docs/rendering.md, R-LAYOUT-003). In a webview
// of VS Code, the service worker of the webview gives the files of the webview only to a page with the address of the
// webview; the page in the frame of the pages has the address `about:srcdoc`, so it gets no file. VS Code also blocks
// a frame in a webview that loads another page. So the view loads these files in the page that holds the frame, which
// gets them, and gives the page in the frame their contents as `blob:` URLs: the scripts, the images, the style sheets
// and the addresses in `url()` of the styles, also the relative addresses, which the base of the page resolves.

/** Embedded is a page whose files are `blob:` URLs. */
export interface Embedded {
  /** html is the HTML of the page. */
  readonly html: string;
  /** urls are the `blob:` URLs of the files, which the integrating code revokes when the page goes. */
  readonly urls: readonly string[];
}

/** FetchFile loads a file, and returns its contents, or undefined when it cannot load it. */
export type FetchFile = (url: string) => Promise<Blob | undefined>;

/** fetchFile loads a file with fetch. */
const fetchFile: FetchFile = async (url) => {
  try {
    const response = await fetch(url);
    return response.ok ? await response.blob() : undefined;
  } catch {
    return undefined;
  }
};

/** cssUrl matches an address in `url()` of a style sheet. */
const cssUrl = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

/** urlAttributes are the attributes of the elements of a page whose addresses name the files that the page loads. */
const urlAttributes: readonly [string, string][] = [
  ['img', 'src'],
  ['script', 'src'],
  ['link[rel~="stylesheet"]', 'href'],
  ['source', 'src'],
  ['video', 'src'],
  ['video', 'poster'],
  ['audio', 'src'],
  ['image', 'href'],
  ['use', 'href'],
];

/**
 * embedFiles returns a page whose files under some addresses are `blob:` URLs.
 * @param html - The HTML of the page.
 * @param prefixes - The starts of the addresses of the files that the page cannot load itself.
 * @param load - The loading of a file; the default is fetch in the page of the code.
 */
export async function embedFiles(html: string, prefixes: readonly string[], load: FetchFile = fetchFile): Promise<Embedded> {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const base = parsed.querySelector('base')?.getAttribute('href') ?? undefined;
  const absolute = (address: string): string | undefined => {
    try {
      return new URL(address, base).href;
    } catch {
      return undefined;
    }
  };
  // The addresses compare in the form of the browser, which, for example, decodes the host `file%2B.…` to `file+.…`.
  const starts = prefixes.map((prefix) => absolute(prefix) ?? prefix);
  const matches = (address: string | undefined): address is string => address !== undefined && starts.some((start) => address.startsWith(start));
  // The addresses that the page needs, each loaded once.
  const wanted = new Set<string>();
  const want = (address: string) => {
    const url = absolute(address.trim());
    if (matches(url)) {
      wanted.add(url);
    }
  };
  for (const [selector, attribute] of urlAttributes) {
    for (const element of parsed.querySelectorAll(selector)) {
      const value = element.getAttribute(attribute);
      if (value) {
        want(value);
      }
    }
  }
  const styled = [...parsed.querySelectorAll('style')];
  const withStyle = [...parsed.querySelectorAll('[style]')];
  for (const css of [...styled.map((element) => element.textContent ?? ''), ...withStyle.map((element) => element.getAttribute('style') ?? '')]) {
    for (const found of css.matchAll(cssUrl)) {
      want(found[2]);
    }
  }
  const blobs = new Map<string, string>();
  await Promise.all(
    [...wanted].map(async (url) => {
      const blob = await load(url);
      if (blob) {
        blobs.set(url, URL.createObjectURL(blob));
      }
    }),
  );
  const replaced = (address: string): string => {
    const url = absolute(address.trim());
    return (url && blobs.get(url)) ?? address;
  };
  const replaceCss = (css: string) => css.replace(cssUrl, (all, quote: string, address: string) => (blobs.has(absolute(address.trim()) ?? '') ? `url(${quote || '"'}${replaced(address)}${quote || '"'})` : all));
  for (const [selector, attribute] of urlAttributes) {
    for (const element of parsed.querySelectorAll(selector)) {
      const value = element.getAttribute(attribute);
      if (value) {
        element.setAttribute(attribute, replaced(value));
      }
    }
  }
  for (const element of styled) {
    element.textContent = replaceCss(element.textContent ?? '');
  }
  for (const element of withStyle) {
    element.setAttribute('style', replaceCss(element.getAttribute('style') ?? ''));
  }
  const doctype = parsed.doctype ? `<!DOCTYPE ${parsed.doctype.name}>\n` : '';
  return { html: `${doctype}${parsed.documentElement.outerHTML}`, urls: [...blobs.values()] };
}
