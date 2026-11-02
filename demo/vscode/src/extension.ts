// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The example extension of nimblescape Markdown (CONTRIBUTING.md, "The example extension for VS Code"): it registers
// the editor of rendered Markdown as the custom text editor of each Markdown file, with the adapter
// @nimblescape/markdownvscode (docs/platforms.md, R-VSC-001, R-VSC-002). An extension such as Notes does the same with
// its own view type, its own page script and its own setting of the files that open in the editor.

import * as vscode from 'vscode';
import { registerMarkdownEditor } from '@nimblescape/markdownvscode';

/** activate registers the editor, the command that opens the text editor to the side and the commands of the views. */
export function activate(context: vscode.ExtensionContext): void {
  const dist = vscode.Uri.joinPath(context.extensionUri, 'dist');
  context.subscriptions.push(
    registerMarkdownEditor(vscode, {
      viewType: 'nimblescape.markdownExample.editor',
      script: vscode.Uri.joinPath(dist, 'webview.js'),
      styles: [vscode.Uri.joinPath(dist, 'markdown.css'), vscode.Uri.joinPath(dist, 'vscode.css')],
      openTextCommand: 'nimblescape.markdownExample.openText',
      showPagesCommand: 'nimblescape.markdownExample.showPages',
      showEditCommand: 'nimblescape.markdownExample.showEdit',
      // The build copies the script of Paged.js of @nimblescape/markdownlayout to dist/.
      pagesScripts: [vscode.Uri.joinPath(dist, 'paged.polyfill.js')],
    }),
  );
}
