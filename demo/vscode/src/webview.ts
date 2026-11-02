// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The script of the page of the example extension: it connects to the document of VS Code and creates the editor with
// the source of the connection (docs/platforms.md, R-VSC-001; docs/editor.md, R-EDIT-002).

import { MarkdownEditor } from '@nimblescape/markdowneditor';
import { connectVsCode } from '@nimblescape/markdownvscode/webview';

void connectVsCode().then((connection) => {
  new MarkdownEditor(connection.element, { source: connection.source, editable: connection.editable, id: 'webview' });
});
