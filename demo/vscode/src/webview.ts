// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The script of the page of the example extension: it connects to the document of VS Code and creates the editor with
// the source of the connection (docs/platforms.md, R-VSC-001; docs/editor.md, R-EDIT-002), with the plugin of the
// example pages and the API of the platform for the plugins (docs/plugins.md, R-PLUGIN-001). In the view "Pages", the
// pages of the file in its layout follow the text, with the same plugin, and a double click on a page goes to that
// place in "Edit" (docs/rendering.md, R-LAYOUT-003). In a diff of VS Code, the editor shows the rendered changes
// against the other side (docs/platforms.md, R-VSC-009).

import { MarkdownEditor } from '@nimblescape/markdowneditor';
import { createLayoutRenderer, LivePages } from '@nimblescape/markdownlayout';
import { connectVsCode, followDiff } from '@nimblescape/markdownvscode/webview';
import { examplePlugin } from '../../examplePlugin';

void connectVsCode().then((connection) => {
  const plugin = examplePlugin();
  const editor = new MarkdownEditor(connection.element, {
    source: connection.source,
    editable: connection.editable,
    id: 'webview',
    host: connection.host,
    plugins: [plugin],
  });
  followDiff(connection, editor);
  const host = connection.pages;
  const pages = new LivePages(connection.pagesFrame, {
    host,
    renderer: createLayoutRenderer({ plugins: [plugin] }),
    document: host.document,
    embed: host.embed,
    source: connection.source,
    onError: (error) => console.error('The pages could not be made.', error),
    onDoubleClick: ({ offset }) => {
      connection.setView('edit');
      editor.goToText(offset);
    },
  });
  const follow = (view: string) => (view === 'pages' ? pages.show() : pages.hide());
  connection.onView(follow);
  follow(connection.view);
});
