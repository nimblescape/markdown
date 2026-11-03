// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the plugins of other bundles (docs/plugins.md, R-PLUGIN-002): the page gives the bundles its modules and
// takes the plugins that they register, and the plugin of esbuild builds a bundle that reads the modules of the page.

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { pluginGlobal, registerPlugin, sharedModuleNames, sharedModulesPlugin } from '../bundle';
import { MarkdownEditor } from '../index';
import type { MarkdownPlugin } from './api';
import { loadPlugins, sharedModules } from './shared';

const packageFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let editors: MarkdownEditor[] = [];
afterEach(() => {
  editors.forEach((editor) => editor.destroy());
  editors = [];
  delete (globalThis as Record<string, unknown>)[pluginGlobal];
  document.body.replaceChildren();
});

/**
 * build builds a bundle of plugins from its source with the plugin of esbuild of the shared modules, and returns its
 * script.
 * @param source - The source of the bundle, TypeScript.
 */
async function build(source: string): Promise<string> {
  const result = await esbuild.build({
    stdin: { contents: source, resolveDir: packageFolder, loader: 'ts', sourcefile: 'plugin.ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    conditions: ['nimblescape-source'],
    plugins: [sharedModulesPlugin()],
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

/**
 * runner returns the loader of loadPlugins that runs scripts by their names, as the page runs the scripts of its
 * elements `script`.
 * @param scripts - The scripts by their names.
 */
const runner =
  (scripts: Record<string, string>) =>
  async (src: string): Promise<void> => {
    if (!(src in scripts)) {
      throw new Error(`No script ${src}`);
    }
    new Function(scripts[src])();
  };

describe('the shared modules', () => {
  it('are the modules of the page, by their names', () => {
    const modules = sharedModules();
    expect(Object.keys(modules).sort()).toEqual([...sharedModuleNames].sort());
    expect((modules['@tiptap/pm/state'] as { TextSelection: unknown }).TextSelection).toBe(TextSelection);
    expect((modules['@nimblescape/markdowneditor'] as { MarkdownEditor: unknown }).MarkdownEditor).toBe(MarkdownEditor);
    expect(Object.isFrozen(modules)).toBe(true);
  });
});

describe('loadPlugins', () => {
  it('returns the plugins that the scripts register, in their order, and leaves out other values and scripts that fail', async () => {
    const first: MarkdownPlugin = { name: 'first', apiVersion: 1 };
    const second: MarkdownPlugin = { name: 'second', apiVersion: 1 };
    const load = async (src: string): Promise<void> => {
      if (src === 'a.js') {
        expect(registerPlugin(first)).toBe(true);
        registerPlugin({ name: 'old', apiVersion: 2 });
        registerPlugin('no plugin');
      } else if (src === 'b.js') {
        throw new Error('The script did not load.');
      } else {
        registerPlugin(second);
      }
    };
    expect(await loadPlugins(['a.js', 'b.js', 'c.js'], { load })).toEqual([first, second]);
  });

  it('adds an element script with the nonce of the page for each script', async () => {
    // The page of the tests loads no files; it reports each script as loaded.
    const { settings } = (window as unknown as { happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: boolean } } }).happyDOM;
    settings.handleDisabledFileLoadingAsSuccess = true;
    const loading = loadPlugins(['plugin.js'], { nonce: 'n0nce' });
    const script = document.head.querySelector<HTMLScriptElement>('script[src="plugin.js"]');
    expect(script?.nonce).toBe('n0nce');
    expect(await loading).toEqual([]);
    script!.remove();
    settings.handleDisabledFileLoadingAsSuccess = false;
  });

  it('is the only way of a script to register a plugin', () => {
    expect(registerPlugin({ name: 'alone', apiVersion: 1 })).toBe(false);
  });
});

describe('a bundle built with sharedModulesPlugin', () => {
  it('holds no copy of the shared modules and uses the classes of the page in the editor', async () => {
    const script = await build(`
      import { TextSelection } from '@tiptap/pm/state';
      import { Selection } from 'prosemirror-state';
      import { MarkdownEditor } from '@nimblescape/markdowneditor';
      import { registerPlugin } from '@nimblescape/markdowneditor/bundle';
      registerPlugin({
        name: 'bundled',
        apiVersion: 1,
        generated: () => [],
        activate(editor) {
          const state = editor.tiptap.state;
          globalThis.bundledResult = {
            textSelection: state.selection instanceof TextSelection,
            selection: state.selection instanceof Selection,
            editor: typeof MarkdownEditor,
          };
        },
      });
    `);
    // The bundle reads the modules from the global of the page; it holds none of their code.
    expect(script).toContain(`globalThis["${pluginGlobal}"].modules["@tiptap/pm/state"]`);
    expect(script).not.toContain('class TextSelection');
    expect(script.length).toBeLessThan(5000);
    const plugins = await loadPlugins(['bundled.js'], { load: runner({ 'bundled.js': script }) });
    expect(plugins.map((plugin) => plugin.name)).toEqual(['bundled']);
    const element = document.createElement('div');
    document.body.append(element);
    editors.push(new MarkdownEditor(element, { markdown: 'Text\n', plugins }));
    expect((globalThis as Record<string, unknown>).bundledResult).toEqual({ textSelection: true, selection: true, editor: 'function' });
    delete (globalThis as Record<string, unknown>).bundledResult;
  });
});
