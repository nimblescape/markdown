// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The build of the npm packages of the workspaces (docs/specification.md, R-ARCH-002, R-GEN-007). In the folder of a
// package, `node ../../esbuild.mjs` builds an ES module dist/<name>.js for each entry point src/<name>.ts that the
// exports of its package.json name with the condition of the sources, for example dist/index.js from src/index.ts, and
// dist/<name>.css from each file src/styles/<name>.css (npm run build of the package); a stylesheet holds the styles that
// it imports from another package of the workspaces, for example the styles of rendered content of the renderer in the
// styles of the editor. The modules use no API of Node.js, so that they run in browsers, in the webviews of VS Code and
// in the extension host of VS Code; only an entry point whose export has the condition `node` runs in Node.js, for
// example `@nimblescape/markdownlayout/pdf`, and esbuild builds it for Node.js. A package bundles only its own code: the other packages of the workspaces, Tiptap,
// ProseMirror and markdown-it stay dependencies, so that the page that uses the editor has one copy of ProseMirror with
// its plugins. An import with the suffix `?raw` is the text of its file, which the bundle holds, for example a built-in
// layout. A package that exports `./paged.polyfill.js` holds a copy of the script of Paged.js in dist/, with the notices
// of the packages in it in dist/THIRD-PARTY-NOTICES.md. tsc writes the declarations. The code is readable JavaScript, not minified, so that anyone can compare the package with the source;
// only a development build writes a source map.
//
// In the root of the repository, --demo builds the example page in demo/dist/ with all libraries, from the sources of
// the packages and the script of Paged.js, and writes the notices of the licenses of the libraries in
// demo/dist/THIRD-PARTY-NOTICES.md. --serve
// serves the example page on http://localhost:8000 and builds it again after each change.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as esbuild from 'esbuild';
import { thirdPartyNotices } from './scripts/third-party-notices.mjs';

const production = process.argv.includes('--production');
const demo = process.argv.includes('--demo') || process.argv.includes('--serve');
const serve = process.argv.includes('--serve');

/** source is the condition of the exports of the packages of the workspaces that points to their sources. */
const source = 'nimblescape-source';

/**
 * raw is the plugin of esbuild for the imports with the suffix `?raw`: the module is the text of the file, for example
 * the files of the built-in layouts and the script of the page of the layout part (packages/markdownlayout).
 */
const raw = {
  name: 'raw',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, (args) => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -'?raw'.length)), namespace: 'raw' }));
    build.onLoad({ filter: /.*/, namespace: 'raw' }, (args) => ({ contents: fs.readFileSync(args.path, 'utf8'), loader: 'text' }));
  },
};

const common = { bundle: true, sourcemap: !production, minify: false, logLevel: 'info', target: 'es2022', plugins: [raw] };

/** pagedJs is the script of Paged.js, which the page of a document in its layout loads (packages/markdownlayout). */
const pagedJs = 'node_modules/pagedjs/dist/paged.polyfill.js';

/**
 * pagedJsPackages are the packages whose code the script of Paged.js holds: pagedjs with event-emitter and the packages
 * that it uses, css-tree with the packages that it uses, and clear-cut.
 */
const pagedJsPackages = ['pagedjs', 'event-emitter', 'd', 'es5-ext', 'type', 'es6-symbol', 'css-tree', 'mdn-data', 'source-map', 'clear-cut'];

/**
 * pagedJsInputs returns the inputs of a metafile of esbuild for the packages of the script of Paged.js, so that the
 * notices name them.
 * @param root - The root folder of the repository.
 */
const pagedJsInputs = (root) => Object.fromEntries(pagedJsPackages.map((name) => [path.join(root, 'node_modules', name, 'package.json'), {}]));

/**
 * copyPagedJs copies the script of Paged.js, unchanged, into a folder.
 * @param folder - The folder.
 * @param root - The root folder of the repository.
 */
function copyPagedJs(folder, root) {
  fs.mkdirSync(folder, { recursive: true });
  fs.copyFileSync(path.join(root, pagedJs), path.join(folder, 'paged.polyfill.js'));
}

/**
 * notices returns the plugin of esbuild that writes the notices of the licenses of the libraries in a bundle.
 * @param file - The file of the notices.
 * @param about - The sentence that names the bundle.
 * @param inputs - The inputs of more packages, which a file beside the bundle holds.
 */
function notices(file, about, inputs = {}) {
  return {
    name: 'third-party-notices',
    setup(build) {
      build.onEnd((result) => {
        if (!result.metafile) {
          return;
        }
        const { text, missing } = thirdPartyNotices({ inputs: { ...result.metafile.inputs, ...inputs } }, `# Third-party notices\n\n${about}`);
        fs.writeFileSync(file, text);
        if (missing.length > 0) {
          console.warn(`No text of the license in: ${missing.join(', ')}`);
        }
      });
    },
  };
}

if (!demo) {
  // The build of the package in the current folder.
  if (production) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  const exports = Object.values(JSON.parse(fs.readFileSync('package.json', 'utf8')).exports ?? {});
  const entries = (node) => exports.filter((target) => !!target?.node === node).map((target) => target?.[source]).filter((file) => typeof file === 'string' && file.endsWith('.ts'));
  await esbuild.build({ ...common, entryPoints: entries(false), outdir: 'dist', outbase: 'src', format: 'esm', platform: 'browser', packages: 'external' });
  // An entry point with the condition `node` runs in Node.js only, for example the PDF of the layout part.
  if (entries(true).length > 0) {
    await esbuild.build({ ...common, entryPoints: entries(true), outdir: 'dist', outbase: 'src', format: 'esm', platform: 'node', packages: 'external' });
  }
  // A package that exports the script of Paged.js holds a copy of it, with the notices of the packages in it.
  if (exports.includes('./dist/paged.polyfill.js')) {
    copyPagedJs('dist', '../..');
    const { name } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const about = `The file \`dist/paged.polyfill.js\` of the npm package ${name} is the script of Paged.js, unchanged. It holds these packages.`;
    fs.writeFileSync('dist/THIRD-PARTY-NOTICES.md', thirdPartyNotices({ inputs: pagedJsInputs('../..') }, `# Third-party notices\n\n${about}`).text);
  }
  const styles = fs.existsSync('src/styles') ? fs.readdirSync('src/styles').filter((file) => file.endsWith('.css')) : [];
  for (const style of styles) {
    await esbuild.build({ ...common, entryPoints: [path.join('src/styles', style)], outfile: path.join('dist', style), conditions: [source] });
  }
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
  copyPagedJs('demo/dist', '.');
  const pageNotices = notices(
    'demo/dist/THIRD-PARTY-NOTICES.md',
    'The example page `demo/dist/demo.js` of nimblescape Markdown holds these packages; `demo/dist/paged.polyfill.js`, the script of Paged.js for the view of the pages, holds pagedjs and the packages that it uses.',
    pagedJsInputs('.'),
  );
  if (serve) {
    const context = await esbuild.context({ ...options, plugins: [raw, pageNotices] });
    await context.watch();
    const { port } = await context.serve({ servedir: 'demo', port: 8000 });
    console.log(`The example page: http://localhost:${port}/`);
  } else {
    await esbuild.build({ ...options, plugins: [raw, pageNotices] });
  }
}
