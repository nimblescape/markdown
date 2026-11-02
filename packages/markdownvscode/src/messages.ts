// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The messages between the extension and the page of its webview (docs/platforms.md, R-VSC-001, R-VSC-002). The
// document of VS Code holds the text of the file; the page holds a TextSource with the same text. Each message that
// changes the text gives the patches against the text of a version that the other side knows, so that a message holds
// only the change and not the whole text:
//
// - The page sends `ready` when it starts; the extension answers with `init`, the whole text and its version.
// - The page sends each change of the user as `edit`, with the patches against the text of the version `base`, and
//   sends the next change only after the answer `applied`. The extension merges the change with the changes of the
//   document since `base` and answers with `applied`: the patches from the version that it sent last to the version
//   of the document after the change.
// - The extension sends each other change of the document as `text`, with the patches from the version that it sent
//   last.
// - A message whose patches do not start at the version that the page knows makes the page send `ready` again.
// - The message `plugin` carries a message of a plugin of the editor between its part on the page and its part in the
//   extension, in both directions (docs/plugins.md, R-PLUGIN-001).

import type { TextPatch, TextSelection } from '@nimblescape/markdowntext';

/** editorElementId is the ID of the element of the page that holds the editor. */
export const editorElementId = 'nsmd-editor';

/** PageFonts are the fonts of the text, from the settings of the Markdown preview of VS Code (R-THEME-003). */
export interface PageFonts {
  /** fontFamily is the font family of the text, as CSS. */
  readonly fontFamily?: string;
  /** fontSize is the size of the text in pixels. */
  readonly fontSize?: number;
  /** lineHeight is the line height of the text, relative to the size. */
  readonly lineHeight?: number;
}

/** HostMessage is a message from the extension to the page. */
export type HostMessage =
  | { readonly type: 'init'; readonly text: string; readonly version: number; readonly editable: boolean; readonly fonts: PageFonts }
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
  | PluginMessage;

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
