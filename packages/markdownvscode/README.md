<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# @nimblescape/markdownvscode

The adapter of nimblescape Markdown for VS Code
([docs/platforms.md](../../docs/platforms.md)).
An extension, for example nimblescape Markdown Notes, registers the editor
of rendered Markdown as a custom text editor of VS Code. The file stays a
text document of VS Code: saving, the dirty mark, hot exit, Git, the
timeline and the other extensions work as for the text editor. The package
also holds the theme of VS Code for the editor.

The package is not on npmjs.com before the release; see
[CONTRIBUTING.md](../../CONTRIBUTING.md) for how another repository installs
it from GitHub, and for the example extension of this repository.

## The extension

The extension registers the editor with its own view type and gives the
script of its page and the style sheets
([R-VSC-001](../../docs/platforms.md#r-vsc-001)). The adapter gets the API of VS
Code as a parameter and uses no API of Node.js, so the extension may run in
the extension host of the web as well.

```ts
import * as vscode from 'vscode';
import { registerMarkdownEditor } from '@nimblescape/markdownvscode';

export function activate(context: vscode.ExtensionContext): void {
  const dist = vscode.Uri.joinPath(context.extensionUri, 'dist');
  context.subscriptions.push(
    registerMarkdownEditor(vscode, {
      viewType: 'publisher.extension.editor',
      script: vscode.Uri.joinPath(dist, 'webview.js'),
      // markdown.css of @nimblescape/markdowneditor, then vscode.css of this package.
      styles: [vscode.Uri.joinPath(dist, 'markdown.css'), vscode.Uri.joinPath(dist, 'vscode.css')],
      // A setting of the extension decides which files open in the editor.
      opens: (document) => true,
      openTextCommand: 'publisher.extension.openText',
    }),
  );
}
```

The `package.json` of the extension contributes the custom editor, the
command and its button in the title of the editor:

```json
{
  "contributes": {
    "customEditors": [
      {
        "viewType": "publisher.extension.editor",
        "displayName": "Rendered Markdown",
        "selector": [{ "filenamePattern": "*.md" }],
        "priority": "default"
      }
    ],
    "commands": [
      {
        "command": "publisher.extension.openText",
        "title": "Open Text Editor to the Side",
        "icon": "$(go-to-file)"
      }
    ],
    "menus": {
      "editor/title": [
        {
          "command": "publisher.extension.openText",
          "when": "activeCustomEditorId == publisher.extension.editor",
          "group": "navigation"
        }
      ]
    }
  },
  "capabilities": {
    "untrustedWorkspaces": { "supported": true },
    "virtualWorkspaces": true
  }
}
```

The type declarations of the extension side use the types of VS Code from
`@types/vscode`, which the extension has as a development tool.

## The page

The script of the page connects to the document and creates the editor with
the source of the connection. The extension bundles it for the browser.

```ts
import { MarkdownEditor } from '@nimblescape/markdowneditor';
import { connectVsCode } from '@nimblescape/markdownvscode/webview';

void connectVsCode().then((connection) => {
  new MarkdownEditor(connection.element, { source: connection.source, editable: connection.editable });
});
```

Each change of the user goes to the document, one at a time, and a change
of the document at the same time merges with it
([R-VSC-005](../../docs/platforms.md#r-vsc-005)). Each change of the
document that the page did not make reaches the editor with the origin
`program` and the name `vscode`. Undo and Redo with the keys undo the steps
of the editor; a key that the editor handles starts no key binding of VS
Code ([R-VSC-006](../../docs/platforms.md#r-vsc-006)).

## The theme

`@nimblescape/markdownvscode/vscode.css` sets the variables `--nsmd-*` of
the editor from the variables `--vscode-*` of the active color theme, the
palette from the chart colors of the theme, the text from the fonts of the
settings of the Markdown preview, and code from the font of the text
editor ([R-THEME-001](../../docs/platforms.md#r-theme-001),
[R-THEME-003](../../docs/platforms.md#r-theme-003)).

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
