// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The build of the npm packages of the workspaces (docs/specification.md, R-ARCH-002, R-GEN-007). In the folder of a
// package, `node ../../esbuild.mjs` builds an ES module dist/<name>.js for each entry point src/<name>.ts that the
// exports of its package.json name with the condition of the sources, for example dist/index.js from src/index.ts, and
// dist/<name>.css from each file src/styles/<name>.css (npm run build of the package); a stylesheet holds the styles that
// it imports from another package of the workspaces, for example the styles of rendered content of the renderer in the
// styles of the editor. The modules use no API of Node.js, so that they run in browsers, in the webviews of VS Code and
// in the extension host of VS Code. A package bundles only its own code: the other packages of the workspaces, Tiptap,
// ProseMirror and markdown-it stay dependencies, so that the page that uses the editor has one copy of ProseMirror with
// its plugins. tsc writes the declarations. The code is readable JavaScript, not minified, so that anyone can compare the package with the source;
// only a development build writes a source map.
//
// In the root of the repository, --demo builds the example page in demo/dist/ with all libraries, from the sources of
// the packages, and writes the notices of the licenses of the libraries in demo/dist/THIRD-PARTY-NOTICES.md. --serve
// serves the example page on http://localhost:8000 and builds it again after each change. --vscode builds the example
// extension for VS Code in demo/vscode/dist/: the extension, the script of its page with its notices, and the styles.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as esbuild from 'esbuild';
import { thirdPartyNotices } from './scripts/third-party-notices.mjs';

const production = process.argv.includes('--production');
const demo = process.argv.includes('--demo') || process.argv.includes('--serve');
const serve = process.argv.includes('--serve');
const vscode = process.argv.includes('--vscode');

/** source is the condition of the exports of the packages of the workspaces that points to their sources. */
const source = 'nimblescape-source';

const common = { bundle: true, sourcemap: !production, minify: false, logLevel: 'info', target: 'es2022' };

/**
 * notices returns the plugin of esbuild that writes the notices of the licenses of the libraries in a bundle.
 * @param file - The file of the notices.
 * @param about - The sentence that names the bundle.
 */
function notices(file, about) {
  return {
    name: 'third-party-notices',
    setup(build) {
      build.onEnd((result) => {
        if (!result.metafile) {
          return;
        }
        const { text, missing } = thirdPartyNotices(result.metafile, `# Third-party notices\n\n${about}`);
        fs.writeFileSync(file, text);
        if (missing.length > 0) {
          console.warn(`No text of the license in: ${missing.join(', ')}`);
        }
      });
    },
  };
}

if (!demo && !vscode) {
  // The build of the package in the current folder.
  if (production) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  const exports = Object.values(JSON.parse(fs.readFileSync('package.json', 'utf8')).exports ?? {});
  const entryPoints = exports.map((target) => target?.[source]).filter((file) => typeof file === 'string' && file.endsWith('.ts'));
  await esbuild.build({ ...common, entryPoints, outdir: 'dist', outbase: 'src', format: 'esm', platform: 'browser', packages: 'external' });
  const styles = fs.existsSync('src/styles') ? fs.readdirSync('src/styles').filter((file) => file.endsWith('.css')) : [];
  for (const style of styles) {
    await esbuild.build({ ...common, entryPoints: [path.join('src/styles', style)], outfile: path.join('dist', style), conditions: [source] });
  }
} else if (vscode) {
  const out = 'demo/vscode/dist';
  fs.rmSync(out, { recursive: true, force: true });
  // The extension runs in the extension host of the desktop and of the web, so it is one CommonJS module without an API
  // of Node.js; VS Code gives the module `vscode`.
  await esbuild.build({
    ...common,
    entryPoints: ['demo/vscode/src/extension.ts'],
    outfile: `${out}/extension.cjs`,
    format: 'cjs',
    platform: 'browser',
    external: ['vscode'],
    conditions: [source],
  });
  await esbuild.build({
    ...common,
    entryPoints: {
      webview: 'demo/vscode/src/webview.ts',
      markdown: 'packages/markdowneditor/src/styles/markdown.css',
      vscode: 'packages/markdownvscode/src/styles/vscode.css',
    },
    outdir: out,
    format: 'iife',
    platform: 'browser',
    conditions: [source],
    metafile: true,
    plugins: [notices(`${out}/THIRD-PARTY-NOTICES.md`, 'The script `demo/vscode/dist/webview.js` of the example extension of nimblescape Markdown holds these packages.')],
  });
} else {
  const options = {
    ...common,
    entryPoints: { demo: 'demo/main.ts', markdown: 'packages/markdowneditor/src/styles/markdown.css' },
    outdir: 'demo/dist',
    format: 'iife',
    platform: 'browser',
    conditions: [source],
    metafile: true,
  };
  const pageNotices = notices('demo/dist/THIRD-PARTY-NOTICES.md', 'The example page `demo/dist/demo.js` of nimblescape Markdown holds these packages.');
  if (serve) {
    const context = await esbuild.context({ ...options, plugins: [pageNotices] });
    await context.watch();
    const { port } = await context.serve({ servedir: 'demo', port: 8000 });
    console.log(`The example page: http://localhost:${port}/`);
  } else {
    await esbuild.build({ ...options, plugins: [pageNotices] });
  }
}
