// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The entry point `@nimblescape/markdownvscode/webview`, the side of the page in the webview of VS Code
// (docs/platforms.md, R-VSC-001, R-VSC-002): the script of the page of an extension connects to the document and
// creates the editor with the source of the connection, for example
// `new MarkdownEditor(connection.element, { source: connection.source, editable: connection.editable })`, and shows
// the pages of the file in `connection.pagesFrame` with the host `connection.pages` (docs/rendering.md, R-LAYOUT-003).
// `followDiff(connection, editor)` shows the rendered changes while the page is a side of a diff (docs/platforms.md,
// R-VSC-009).

export {
  connectVsCode,
  followDiff,
  vscodeOrigin,
  type ConnectOptions,
  type DiffChanges,
  type DiffEditor,
  type VsCodeConnection,
  type VsCodeDiff,
  type VsCodePagesHost,
  type VsCodePluginChannel,
  type VsCodePluginHost,
  type VsCodeWebviewApi,
} from './webview/connection';
export {
  editorElementId,
  type DiffLayout,
  type DiffPosition,
  type DiffSide,
  pagesElementId,
  type HostMessage,
  type PageFiles,
  type PageFolder,
  type PageFonts,
  type PageMessage,
  type PageView,
  type PluginMessage,
} from './messages';
