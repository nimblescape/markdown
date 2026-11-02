// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The entry point `@nimblescape/markdownvscode/webview`, the side of the page in the webview of VS Code
// (docs/platforms.md, R-VSC-001, R-VSC-002): the script of the page of an extension connects to the document and
// creates the editor with the source of the connection, for example
// `new MarkdownEditor(connection.element, { source: connection.source, editable: connection.editable })`.

export {
  connectVsCode,
  vscodeOrigin,
  type ConnectOptions,
  type VsCodeConnection,
  type VsCodePluginChannel,
  type VsCodePluginHost,
  type VsCodeWebviewApi,
} from './webview/connection';
export { editorElementId, type HostMessage, type PageFonts, type PageMessage, type PluginMessage } from './messages';
