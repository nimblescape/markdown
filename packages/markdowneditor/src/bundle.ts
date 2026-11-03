// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The entry point `@nimblescape/markdowneditor/bundle`, for the bundles of the plugins of other extensions
// (docs/plugins.md, R-PLUGIN-002). A page that uses the editor loads such a bundle with `loadPlugins` of
// `@nimblescape/markdowneditor`; the bundle registers its plugins with `registerPlugin`. The bundle must use the same
// copy of Tiptap, ProseMirror and the editor as the page, because the editor compares their classes, for example of a
// selection: `sharedModulesPlugin` is the plugin of esbuild that makes each import of a shared module in the bundle read
// the module of the page. The module imports nothing, so that the build of a bundle in Node.js can use it.

/** pluginGlobal is the name of the global of the page through which the bundles of plugins reach the editor. */
export const pluginGlobal = 'nimblescapeMarkdown';

/**
 * sharedModuleNames are the modules that the page gives the bundles of plugins: a bundle imports them from the page and
 * holds no copy of them.
 */
export const sharedModuleNames = [
  '@tiptap/core',
  '@tiptap/pm/commands',
  '@tiptap/pm/history',
  '@tiptap/pm/inputrules',
  '@tiptap/pm/keymap',
  '@tiptap/pm/model',
  '@tiptap/pm/state',
  '@tiptap/pm/transform',
  '@tiptap/pm/view',
  '@nimblescape/markdowneditor',
  '@nimblescape/markdowntext',
] as const;

/** SharedModuleName is the name of a module that the page gives the bundles of plugins. */
export type SharedModuleName = (typeof sharedModuleNames)[number];

/**
 * sharedModuleAliases are the packages of ProseMirror whose modules `@tiptap/pm` gives: a bundle that imports such a
 * package directly also reads the module of the page.
 */
export const sharedModuleAliases: Readonly<Record<string, SharedModuleName>> = {
  'prosemirror-commands': '@tiptap/pm/commands',
  'prosemirror-history': '@tiptap/pm/history',
  'prosemirror-inputrules': '@tiptap/pm/inputrules',
  'prosemirror-keymap': '@tiptap/pm/keymap',
  'prosemirror-model': '@tiptap/pm/model',
  'prosemirror-state': '@tiptap/pm/state',
  'prosemirror-transform': '@tiptap/pm/transform',
  'prosemirror-view': '@tiptap/pm/view',
};

/**
 * PluginRegistry is the global of the page for the bundles of plugins: the version of the API, the shared modules, and
 * the function that registers a plugin.
 */
export interface PluginRegistry {
  readonly apiVersion: 1;
  readonly modules: Readonly<Record<SharedModuleName, unknown>>;
  /** register registers a plugin of the editor (docs/plugins.md, R-PLUGIN-001) for the editors of the page. */
  register(plugin: unknown): void;
}

/**
 * registerPlugin registers a plugin of the editor from a bundle of plugins, while the page loads the bundle. Outside such
 * a page, it does nothing.
 * @param plugin - The plugin, a MarkdownPlugin of `@nimblescape/markdowneditor`.
 * @returns true when the page took the plugin.
 */
export function registerPlugin(plugin: unknown): boolean {
  const registry = (globalThis as Record<string, unknown>)[pluginGlobal] as PluginRegistry | undefined;
  if (registry?.apiVersion !== 1) {
    return false;
  }
  registry.register(plugin);
  return true;
}

/** EsbuildPluginBuild is the part of the build of esbuild that sharedModulesPlugin uses. */
interface EsbuildPluginBuild {
  onResolve(options: { filter: RegExp }, callback: (args: { path: string }) => { path: string; namespace: string }): void;
  onLoad(options: { filter: RegExp; namespace: string }, callback: (args: { path: string }) => { contents: string; loader: 'js' }): void;
}

/** sharedNamespace is the namespace of esbuild of the shared modules. */
const sharedNamespace = 'nimblescape-shared-module';

/**
 * sharedModulesPlugin returns the plugin of esbuild that makes each import of a shared module in a bundle of plugins
 * read the module of the page, for example `plugins: [sharedModulesPlugin()]` in the options of the build. The bundle
 * must be a script (`format: 'iife'`) that the page loads with `loadPlugins`.
 */
export function sharedModulesPlugin(): { name: string; setup(build: EsbuildPluginBuild): void } {
  const names = [...sharedModuleNames, ...Object.keys(sharedModuleAliases)];
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'));
  const filter = new RegExp(`^(?:${escaped.join('|')})$`);
  return {
    name: 'nimblescape-shared-modules',
    setup(build) {
      build.onResolve({ filter }, (args) => ({ path: sharedModuleAliases[args.path] ?? args.path, namespace: sharedNamespace }));
      build.onLoad({ filter: /.*/, namespace: sharedNamespace }, (args) => ({
        contents: `module.exports = globalThis[${JSON.stringify(pluginGlobal)}].modules[${JSON.stringify(args.path)}];`,
        loader: 'js',
      }));
    },
  };
}
