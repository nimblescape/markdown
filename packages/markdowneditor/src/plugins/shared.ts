// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The plugins of other bundles (docs/plugins.md, R-PLUGIN-002): the page of the editor loads the scripts of the plugins
// of other extensions, for example the plugins of Paper in the editor of Notes. Before it loads them, it puts the
// registry on its global `nimblescapeMarkdown`: the shared modules, the copies of Tiptap, ProseMirror and the editor of
// the page, and the function through which each script registers its plugins (`registerPlugin` of
// `@nimblescape/markdowneditor/bundle`). The page then creates the editor with its own plugins and with these.

import * as tiptapCore from '@tiptap/core';
import * as pmCommands from '@tiptap/pm/commands';
import * as pmHistory from '@tiptap/pm/history';
import * as pmInputRules from '@tiptap/pm/inputrules';
import * as pmKeymap from '@tiptap/pm/keymap';
import * as pmModel from '@tiptap/pm/model';
import * as pmState from '@tiptap/pm/state';
import * as pmTransform from '@tiptap/pm/transform';
import * as pmView from '@tiptap/pm/view';
import * as markdownText from '@nimblescape/markdowntext';
import { pluginGlobal, type PluginRegistry, type SharedModuleName } from '../bundle';
import * as markdownEditor from '../index';
import type { MarkdownPlugin } from './api';

/** sharedModules returns the modules of the page that the bundles of plugins use, by their names. */
export function sharedModules(): Readonly<Record<SharedModuleName, unknown>> {
  return Object.freeze({
    '@tiptap/core': tiptapCore,
    '@tiptap/pm/commands': pmCommands,
    '@tiptap/pm/history': pmHistory,
    '@tiptap/pm/inputrules': pmInputRules,
    '@tiptap/pm/keymap': pmKeymap,
    '@tiptap/pm/model': pmModel,
    '@tiptap/pm/state': pmState,
    '@tiptap/pm/transform': pmTransform,
    '@tiptap/pm/view': pmView,
    '@nimblescape/markdowneditor': markdownEditor,
    '@nimblescape/markdowntext': markdownText,
  });
}

/** isPlugin returns true for an object with the name and the version of the API of a plugin. */
const isPlugin = (value: unknown): value is MarkdownPlugin =>
  typeof value === 'object' && value !== null && typeof (value as MarkdownPlugin).name === 'string' && (value as MarkdownPlugin).apiVersion === 1;

/** LoadOptions configure the loading of the scripts of plugins. */
export interface LoadOptions {
  /** nonce is the nonce of the scripts of the page, which its policy of the content asks for. */
  readonly nonce?: string;
  /**
   * load loads one script and resolves when it ran or could not load. The default adds an element `script` with the
   * nonce to the head of the document.
   */
  readonly load?: (src: string) => Promise<void>;
}

/**
 * scriptLoader returns the function that loads a script with an element `script` with a nonce.
 * @param nonce - The nonce.
 */
function scriptLoader(nonce: string | undefined): (src: string) => Promise<void> {
  return (src) =>
    new Promise((resolve) => {
      const script = document.createElement('script');
      if (nonce) {
        script.nonce = nonce;
      }
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.append(script);
    });
}

/**
 * loadPlugins loads the scripts of plugins of other bundles, one after the other, and returns the plugins that they
 * registered, in their order. A script that does not load, and a value that is no plugin of version 1 of the API, add
 * no plugin.
 * @param scripts - The addresses of the scripts.
 * @param options - The nonce of the page, or a loader of its own.
 */
export async function loadPlugins(scripts: readonly string[], options: LoadOptions = {}): Promise<MarkdownPlugin[]> {
  const plugins: MarkdownPlugin[] = [];
  const registry: PluginRegistry = {
    apiVersion: 1,
    modules: sharedModules(),
    register: (plugin) => {
      if (isPlugin(plugin)) {
        plugins.push(plugin);
      }
    },
  };
  (globalThis as Record<string, unknown>)[pluginGlobal] = registry;
  const load = options.load ?? scriptLoader(options.nonce);
  for (const script of scripts) {
    try {
      await load(script);
    } catch {
      // A script that fails adds no plugin; the editor works without it.
    }
  }
  return plugins;
}
