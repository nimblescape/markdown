<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# @nimblescape/markdownlayout

The layout part of nimblescape Markdown: the text of a file in its layout,
as pages ([docs/rendering.md](../../docs/rendering.md)). It holds the layout
code of nimblescape Markdown Paper
([R-LAYOUT-004](../../docs/rendering.md#r-layout-004)): a layout is a folder
with `layout.json`, its style sheets and the templates of its fixed pages,
in the layout folder format `nimblescape-layout` of Markdown Paper, so that
the layouts of Paper work without a change
([R-LAYOUT-001](../../docs/rendering.md#r-layout-001)).

A document names its layout with the field `layout` of its front matter: a
folder `layouts/<name>/` in the folder of the document or in a folder above
it, a layout that the integrating code finds, for example a layout on
GitHub, or a built-in layout. A document without the field gets the
built-in layout `plain`. The fields of the front matter fill the templates,
for example the title and the author on the title page.

The text gets the parts of a document for print: the numbers of the
headings, the special sections (table of contents, lists of figures, tables
and listings, the reference list), the front matter, body and appendix
parts, the captions of figures, tables and listings with their numbers, the
labels of the links to them, the footnotes at the foot of their pages, the
addresses of the links to the outside in footnotes, and soft hyphens by the
language of the layout. Paged.js makes the pages
([R-LAYOUT-003](../../docs/rendering.md#r-layout-003)).

```ts
import { createLayoutRenderer, renderPage, showPages, type Host } from '@nimblescape/markdownlayout';

const host: Host = {
  reader: { read: async (url) => readFile(url) }, // the files of the layouts, as bytes
  resource: (url) => url, // the address from which the page loads a file
  sources: location.origin, // the sources of the policy of the page for images, fonts and styles
  scripts: [{ src: new URL('paged.polyfill.js', location.href).href }],
  nonce: 'a new random text for each page',
};
const renderer = createLayoutRenderer({ plugins });
const page = await renderPage(host, renderer, 'file:///project/paper.md', text, { hold: true });
const view = showPages(document.querySelector('iframe')!, page, renderer);
await view.rendered; // Paged.js has made the pages
```

`renderPage` returns one HTML page with the layout, the text, the script of
the layout and Paged.js, the title, the name of the PDF file, the JSON
schema of the front matter of the layout
([R-FM-004](../../docs/editor.md#r-fm-004)) and the problems that it found.
`showPages` shows the page in a frame: the functions of the plugins show
their tokens in the frame, and then Paged.js makes the pages. The same page
is the page of the PDF ([R-LAYOUT-002](../../docs/rendering.md#r-layout-002)).

## Drawings and the script of the layout

The script of the layout in the page starts Paged.js when the content is
complete ([R-LAYOUT-003](../../docs/rendering.md#r-layout-003)). A script of
the page that draws, for example diagrams, tells it that a drawing still
waits: a function in `window.paperHandlers.pending` returns `true` while the
drawing waits, at most 10 seconds after the page loaded, or the time (as
`Date.now()` gives it) up to which the page waits for a slow drawing. The
functions in `window.paperHandlers.beforePages` run right before Paged.js
makes the pages, for example to copy what Paged.js would lose.

```js
window.paperHandlers.pending.push((root) => root.querySelector('.diagram:not(.drawn)') !== null);
window.paperHandlers.beforePages.push((root) => copyShadowRoots(root));
```

Code that makes the pages itself, without `renderPage`, loads the text of
`layoutScript` into its page before Paged.js, for the start of Paged.js, the
page numbers and the last lines of the justified paragraphs.

## The pages that follow the text

`LivePages` is the view "Pages" of an editor
([R-LAYOUT-003](../../docs/rendering.md#r-layout-003)). While it shows, the
pages show again 600 ms after the last change of the text of the source, at
the same place of the frame. A double click on a block of the pages gives
the line of that block in the file and the place in the text where the line
starts, so that the integrating code can go there in "Edit".

```ts
import { createLayoutRenderer, LivePages } from '@nimblescape/markdownlayout';

const pages = new LivePages(document.querySelector('iframe')!, {
  host,
  renderer: createLayoutRenderer({ plugins }),
  document: 'file:///project/paper.md',
  source, // the TextSource of the editor
  onDoubleClick: ({ offset }) => editor.goToText(offset),
});
pages.show(); // the view "Pages"
pages.hide(); // the view "Edit": the frame keeps the last pages
```

In a webview of VS Code, the page in the frame cannot load the files of the
webview itself. The option `embed` names the starts of their addresses:
the view loads these files and gives them to the page in the frame as
`blob:` URLs. The adapter of VS Code of the extension gives these
addresses, for example the connection of the page in nimblescape Markdown
Notes.

## The PDF

The entry point `@nimblescape/markdownlayout/pdf` prints the page of a
document to a PDF in Node.js, for example on the command line and in the
extension host of VS Code on the desktop
([R-LAYOUT-002](../../docs/rendering.md#r-layout-002)). An installed
browser without a window, Google Chrome, Chromium, Microsoft Edge or Brave,
loads the page, Paged.js makes the pages, and the browser prints them in the
size of the pages of the layout. The PDF gets the title, the author, the
subtitle as its subject and the language of the layout in its metadata.

```ts
import { pathToFileURL } from 'node:url';
import { createLayoutRenderer, renderPage } from '@nimblescape/markdownlayout';
import { fileHost, printPage } from '@nimblescape/markdownlayout/pdf';

const renderer = createLayoutRenderer({ plugins });
const host = fileHost({ scripts: [{ src: pathToFileURL(pageScript).href }] }); // the files of the disk
const page = await renderPage(host, renderer, pathToFileURL(file).href, text); // without hold
const { pdf, messages } = await printPage(page); // the bytes of the PDF, and the errors of the page
```

`printPage` searches an installed browser; the option `browser` names its
program, else the environment variable `NIMBLESCAPE_BROWSER`. Without a
browser, the error `NoBrowserError` says where to get Google Chrome. The
package downloads no browser. `Browser` is the connection to the browser
over the Chrome DevTools Protocol, for example for the tests of the pages
of a program.

In the page of the PDF, the page itself shows the tokens of the plugins
before Paged.js makes the pages. A script of the page registers the
functions of the plugins; the integrating code bundles it with the same
plugins as its renderer, and gives it in `scripts` of the host
(`pageScript` above):

```ts
import { registerRenders } from '@nimblescape/markdownlayout';

registerRenders(plugins);
```

## The script of Paged.js

The package holds the script of Paged.js, `paged.polyfill.js`, unchanged,
with the notices of the packages in it in `dist/THIRD-PARTY-NOTICES.md`.
The export `@nimblescape/markdownlayout/paged.polyfill.js` names the file:
the integrating code copies it to a place from which the page loads it, for
example the folder of the scripts of a webview, and gives its address in
`scripts` of the host.

The package is not on npmjs.com before the release.
[CONTRIBUTING.md](../../CONTRIBUTING.md) explains how another repository
installs it from GitHub.

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
