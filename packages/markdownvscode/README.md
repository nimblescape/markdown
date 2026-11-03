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
      // The buttons of a diff with the editor on both sides (R-VSC-009).
      nextChangeCommand: 'publisher.extension.nextChange',
      previousChangeCommand: 'publisher.extension.previousChange',
    }),
  );
}
```

The `package.json` of the extension contributes the custom editor, the
commands and their buttons in the title of the editor. The priority of the
editor names the diff editor as well, so that VS Code opens a diff of a file
with the editor on both sides
([R-VSC-009](../../docs/platforms.md#r-vsc-009)); this needs VS Code 1.133 or
newer. The adapter sets the context key `<viewType>.diff` while the active
tab is such a diff, for the buttons to the previous and the next change:

```json
{
  "contributes": {
    "customEditors": [
      {
        "viewType": "publisher.extension.editor",
        "displayName": "Rendered Markdown",
        "selector": [{ "filenamePattern": "*.md" }],
        "priority": { "textEditor": "default", "diffEditor": "default" }
      }
    ],
    "commands": [
      {
        "command": "publisher.extension.openText",
        "title": "Open Text Editor to the Side",
        "icon": "$(go-to-file)"
      },
      { "command": "publisher.extension.previousChange", "title": "Previous Change", "icon": "$(arrow-up)" },
      { "command": "publisher.extension.nextChange", "title": "Next Change", "icon": "$(arrow-down)" }
    ],
    "menus": {
      "editor/title": [
        {
          "command": "publisher.extension.openText",
          "when": "activeCustomEditorId == publisher.extension.editor",
          "group": "navigation"
        },
        { "command": "publisher.extension.previousChange", "when": "publisher.extension.editor.diff", "group": "navigation@1" },
        { "command": "publisher.extension.nextChange", "when": "publisher.extension.editor.diff", "group": "navigation@2" }
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
import { connectVsCode, followDiff } from '@nimblescape/markdownvscode/webview';

void connectVsCode().then((connection) => {
  const editor = new MarkdownEditor(connection.element, {
    source: connection.source,
    editable: connection.editable,
    host: connection.host,
    plugins: [],
  });
  // While the page is a side of a diff, the editor shows the changes against the other side.
  followDiff(connection, editor);
});
```

Each change of the user goes to the document, one at a time, and a change
of the document at the same time merges with it
([R-VSC-005](../../docs/platforms.md#r-vsc-005)). Each change of the
document that the page did not make reaches the editor with the origin
`program` and the name `vscode`. Undo and Redo with the keys undo the steps
of the editor; a key that the editor handles starts no key binding of VS
Code ([R-VSC-006](../../docs/platforms.md#r-vsc-006)).

## The pages

The page of the webview also has a frame for the pages of the file in its
layout ([R-VSC-007](../../docs/platforms.md#r-vsc-007)). The registration
names two commands, one for each view, and the scripts of the pages, for
example the script of Paged.js of `@nimblescape/markdownlayout`, which the
extension copies to its folder `dist/`:

```ts
registerMarkdownEditor(vscode, {
  // …
  showPagesCommand: 'publisher.extension.showPages',
  showEditCommand: 'publisher.extension.showEdit',
  pagesScripts: [vscode.Uri.joinPath(dist, 'paged.polyfill.js')],
});
```

The context key `publisher.extension.editor.pages`, the view type with
`.pages`, is true while the active editor shows the pages, so that the title
of the editor shows the button of the other view:

```json
{
  "command": "publisher.extension.showPages",
  "when": "activeCustomEditorId == publisher.extension.editor && !publisher.extension.editor.pages",
  "group": "navigation"
}
```

On the page, `connection.pages` is the host of the pages, which reads the
files of the layouts through the extension, and `connection.pagesFrame` is
the frame. `connection.view` is the view, `connection.onView` tells each
change of it, and `connection.setView` changes it:

```ts
import { createLayoutRenderer, LivePages } from '@nimblescape/markdownlayout';

const host = connection.pages;
const pages = new LivePages(connection.pagesFrame, {
  host,
  renderer: createLayoutRenderer({ plugins }),
  document: host.document,
  embed: host.embed,
  source: connection.source,
  onDoubleClick: ({ offset }) => {
    connection.setView('edit');
    editor.goToText(offset);
  },
});
const follow = (view: string) => (view === 'pages' ? pages.show() : pages.hide());
connection.onView(follow);
follow(connection.view);
```

## The plugins

`connection.host` is the API of the platform for the plugins of the editor
([R-PLUGIN-001](../../docs/plugins.md#r-plugin-001)). The part of a plugin
on the page sends messages to its part in the extension through
`host.channel(name)`, and the extension connects that part with `plugins` of
the registration. The page shows the content of a file, so the extension
checks each message of the page before it uses it.

```ts
registerMarkdownEditor(vscode, {
  // …
  plugins: {
    notes: (channel) => channel.onMessage((message) => {
      if (isLoginRequest(message)) {
        void channel.post({ login: currentLogin() });
      }
    }),
  },
});
```

### The plugins of other extensions

Another extension can contribute plugins of the editor
([R-VSC-008](../../docs/platforms.md#r-vsc-008),
[R-PLUGIN-002](../../docs/plugins.md#r-plugin-002)): its package.json names
their scripts, and the extension that registers the editor asks for them
with `contributedPlugins`. The page loads them before it creates the
editor. The part of such a plugin in the other extension connects with
`addPlugin` of the handle of the registration, also after panels opened;
the messages that the page sent before wait for it.

```jsonc
// The package.json of the other extension, for example Paper.
"contributes": {
  "nimblescape.markdown.extensions": { "editorScripts": ["dist/editorPlugins.js"] }
}
```

```ts
// The extension that registers the editor, for example Notes.
const editor = registerMarkdownEditor(vscode, { /* … */ contributedPlugins: true });
// Its API gives the other extensions `editor.addPlugin(name, connect)`.

// The page of the editor.
const connection = await connectVsCode();
const extra = await loadPlugins(connection.pluginScripts, { nonce: connection.nonce });
const markdownEditor = new MarkdownEditor(connection.element, { source: connection.source, host: connection.host, plugins: [...ownPlugins, ...extra] });
```

## The theme

`@nimblescape/markdownvscode/vscode.css` sets the variables `--nsmd-*` of
the editor from the variables `--vscode-*` of the active color theme, the
palette from the chart colors of the theme, the text from the fonts of the
settings of the Markdown preview, and code from the font of the text
editor ([R-THEME-001](../../docs/platforms.md#r-theme-001),
[R-THEME-003](../../docs/platforms.md#r-theme-003)).

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
