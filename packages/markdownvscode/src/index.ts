// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The npm package @nimblescape/markdownvscode, the adapter of nimblescape Markdown for VS Code (docs/specification.md,
// R-ARCH-002; docs/platforms.md, R-GEN-004, R-VSC-001 to R-VSC-003, R-THEME-001, R-THEME-003). This entry point is the
// side of the extension: it registers the editor as a custom text editor and connects each page of a webview to its
// document. The entry point `@nimblescape/markdownvscode/webview` is the side of the page, and
// `@nimblescape/markdownvscode/vscode.css` is the theme of VS Code for the editor.

export { registerMarkdownEditor, type MarkdownEditorRegistration, type PluginPanelChannel, type VsCode } from './extension/editor';
export { escaped, newNonce, pageHtml, type PageOptions } from './extension/page';
export { editorElementId, pageMessage, type HostMessage, type PageFonts, type PageMessage, type PluginMessage } from './messages';
