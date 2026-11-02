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
