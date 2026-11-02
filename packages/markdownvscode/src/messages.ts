// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The messages between the extension and the page of its webview (docs/platforms.md, R-VSC-001, R-VSC-002). The
// document of VS Code holds the text of the file; the page holds a TextSource with the same text. Each message that
// changes the text gives the patches against the text of a version that the other side knows, so that a message holds
// only the change and not the whole text:
//
// - The page sends `ready` when it starts; the extension answers with `init`, the whole text and its version, and the
//   scripts of the plugins of the editor of other extensions (docs/plugins.md, R-PLUGIN-002), which the page loads
//   before it creates the editor.
// - The page sends each change of the user as `edit`, with the patches against the text of the version `base`, and
//   sends the next change only after the answer `applied`. The extension merges the change with the changes of the
//   document since `base` and answers with `applied`: the patches from the version that it sent last to the version
//   of the document after the change.
// - The extension sends each other change of the document as `text`, with the patches from the version that it sent
//   last.
// - A message whose patches do not start at the version that the page knows makes the page send `ready` again.
// - The message `plugin` carries a message of a plugin of the editor between its part on the page and its part in the
//   extension, in both directions (docs/plugins.md, R-PLUGIN-001).
// - The message `view` switches the page between the views "Edit" and "Pages" (docs/rendering.md, R-LAYOUT-003), in
//   both directions: the extension sends it for its commands, the page for a switch of its own, for example after a
//   double click on a page.
// - For the pages, the page asks with `read` for a file of a layout, and the extension answers with `file`, the bytes
//   of the file in Base64 or nothing: VS Code gives the page the messages as JSON, which has no bytes. The extension
//   reads only the files of the folders from which the page may load files.

import type { TextPatch, TextSelection } from '@nimblescape/markdowntext';

/** editorElementId is the ID of the element of the page that holds the editor. */
export const editorElementId = 'nsmd-editor';

/** pagesElementId is the ID of the frame of the page that holds the pages of the file. */
export const pagesElementId = 'nsmd-pages';

/** PageFonts are the fonts of the text, from the settings of the Markdown preview of VS Code (R-THEME-003). */
export interface PageFonts {
  /** fontFamily is the font family of the text, as CSS. */
  readonly fontFamily?: string;
  /** fontSize is the size of the text in pixels. */
  readonly fontSize?: number;
  /** lineHeight is the line height of the text, relative to the size. */
  readonly lineHeight?: number;
}

/** PageView is a view of the page: the editor ("Edit") or the pages of the file in its layout ("Pages"). */
export type PageView = 'edit' | 'pages';

/** PageFolder is a folder from which the page may load files, with its address in the webview. */
export interface PageFolder {
  /** folder is the URI of the folder, with a slash at its end. */
  readonly folder: string;
  /** webview is the address of the folder in the webview, with a slash at its end. */
  readonly webview: string;
}

/** PageFiles are what the pages of the file need from the extension (docs/rendering.md, R-LAYOUT-003). */
export interface PageFiles {
  /** document is the URI of the file. */
  readonly document: string;
  /** top is the URI of the top folder of the search for a layout: the workspace folder of the file, else its folder. */
  readonly top?: string;
  /** folders are the folders from which the page may load files. */
  readonly folders: readonly PageFolder[];
  /** sources is the source of the webview for the policy of a page. */
  readonly sources: string;
  /** scripts are the addresses of the scripts of the pages in the webview, Paged.js last. */
  readonly scripts: readonly string[];
}

/** HostMessage is a message from the extension to the page. */
export type HostMessage =
  | {
      readonly type: 'init';
      readonly text: string;
      readonly version: number;
      readonly editable: boolean;
      readonly fonts: PageFonts;
      readonly view: PageView;
      readonly files: PageFiles;
      /** plugins are the addresses of the scripts of the plugins of the editor of other extensions in the webview. */
      readonly plugins: readonly string[];
    }
  | { readonly type: 'text'; readonly from: number; readonly version: number; readonly patches: readonly TextPatch[] }
  | {
      readonly type: 'applied';
      readonly id: number;
      readonly done: boolean;
      readonly from: number;
      readonly version: number;
      readonly patches: readonly TextPatch[];
    }
  | { readonly type: 'fonts'; readonly fonts: PageFonts }
  | { readonly type: 'view'; readonly view: PageView }
  | { readonly type: 'file'; readonly id: number; readonly base64?: string }
  | PluginMessage;

/** PluginMessage is a message of a plugin of the editor, by the name of the plugin, in both directions. */
export interface PluginMessage {
  readonly type: 'plugin';
  readonly plugin: string;
  readonly message: unknown;
}

/** pluginName matches the name of a plugin of the editor. */
export const pluginName = /^[A-Za-z][\w-]*$/;

/** PageMessage is a message from the page to the extension. */
export type PageMessage =
  | { readonly type: 'ready' }
  | { readonly type: 'edit'; readonly id: number; readonly base: number; readonly patches: readonly TextPatch[] }
  | { readonly type: 'selection'; readonly selection: TextSelection }
  | { readonly type: 'openText' }
  | { readonly type: 'view'; readonly view: PageView }
  | { readonly type: 'read'; readonly id: number; readonly url: string }
  | PluginMessage;

/**
 * toBase64 returns the bytes of a file as Base64, in parts, so that a large file does not exceed the number of the
 * arguments of a function.
 * @param bytes - The bytes.
 */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary);
}

/**
 * fromBase64 returns the bytes of a text in Base64.
 * @param text - The text.
 */
export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** isRecord is true for an object that is no array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** isCount is true for an integer of 0 or more. */
function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/** isPatches is true for a list of text patches. */
export function isPatches(value: unknown): value is TextPatch[] {
  return Array.isArray(value) && value.every((patch) => isRecord(patch) && isCount(patch.from) && isCount(patch.to) && typeof patch.insert === 'string');
}

/**
 * pageMessage returns a message of the page, or undefined for a message of another form. The extension checks each
 * message, because the page shows the content of a file.
 * @param value - The data of the message.
 */
export function pageMessage(value: unknown): PageMessage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  switch (value.type) {
    case 'ready':
    case 'openText':
      return { type: value.type };
    case 'edit':
      return isCount(value.id) && isCount(value.base) && isPatches(value.patches) ? { type: 'edit', id: value.id, base: value.base, patches: value.patches } : undefined;
    case 'plugin':
      return typeof value.plugin === 'string' && pluginName.test(value.plugin) ? { type: 'plugin', plugin: value.plugin, message: value.message } : undefined;
    case 'view':
      return value.view === 'edit' || value.view === 'pages' ? { type: 'view', view: value.view } : undefined;
    case 'read':
      return isCount(value.id) && typeof value.url === 'string' ? { type: 'read', id: value.id, url: value.url } : undefined;
    case 'selection': {
      const selection = value.selection;
      return isRecord(selection) && isCount(selection.anchor) && isCount(selection.head)
        ? { type: 'selection', selection: { anchor: selection.anchor, head: selection.head } }
        : undefined;
    }
    default:
      return undefined;
  }
}
