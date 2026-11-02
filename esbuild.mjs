// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The build of the npm packages of the workspaces (docs/specification.md, R-ARCH-002, R-GEN-007). In the folder of a
// package, `node ../../esbuild.mjs` builds dist/index.js from src/index.ts, an ES module for browsers and the webviews
// of VS Code, and dist/<name>.css from each file src/styles/<name>.css (npm run build of the package). A package
// bundles only its own code: the other packages of the workspaces, Tiptap, ProseMirror and markdown-it stay
// dependencies, so that the page that uses the editor has one copy of ProseMirror with its plugins. tsc writes the
// declarations. The code is readable JavaScript, not minified, so that anyone can compare the package with the source;
// only a development build writes a source map.
//
// In the root of the repository, --demo builds the example page in demo/dist/ with all libraries, from the sources of
// the packages, and writes the notices of the licenses of the libraries in demo/dist/THIRD-PARTY-NOTICES.md. --serve
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

const common = { bundle: true, sourcemap: !production, minify: false, logLevel: 'info', target: 'es2022' };

if (!demo) {
  // The build of the package in the current folder.
  if (production) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  await esbuild.build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/index.js', format: 'esm', platform: 'browser', packages: 'external' });
  const styles = fs.existsSync('src/styles') ? fs.readdirSync('src/styles').filter((file) => file.endsWith('.css')) : [];
  for (const style of styles) {
    await esbuild.build({ ...common, entryPoints: [path.join('src/styles', style)], outfile: path.join('dist', style) });
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
  const notices = {
    name: 'third-party-notices',
    setup(build) {
      build.onEnd((result) => {
        if (!result.metafile) {
          return;
        }
        const { text, missing } = thirdPartyNotices(
          result.metafile,
          '# Third-party notices\n\nThe example page `demo/dist/demo.js` of nimblescape Markdown holds these packages.',
        );
        fs.writeFileSync('demo/dist/THIRD-PARTY-NOTICES.md', text);
        if (missing.length > 0) {
          console.warn(`No text of the license in: ${missing.join(', ')}`);
        }
      });
    },
  };
  if (serve) {
    const context = await esbuild.context({ ...options, plugins: [notices] });
    await context.watch();
    const { port } = await context.serve({ servedir: 'demo', port: 8000 });
    console.log(`The example page: http://localhost:${port}/`);
  } else {
    await esbuild.build({ ...options, plugins: [notices] });
  }
}
