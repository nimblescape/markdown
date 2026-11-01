// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The build of the npm package @nimblescape/markdown (docs/specification.md, R-GEN-007): dist/index.js, an ES module
// for browsers and the webviews of VS Code, and dist/markdown.css. The package bundles only its own code: Tiptap,
// ProseMirror and markdown-it stay dependencies, so that the page that uses the editor has one copy of ProseMirror with
// its plugins. tsc writes the declarations (npm run build). The code is readable JavaScript, not minified, so that
// anyone can compare the package with the source; only a development build writes a source map.
//
// --demo also builds the example page in demo/dist/ with all libraries, and writes the notices of their licenses in
// demo/dist/THIRD-PARTY-NOTICES.md. --serve serves the example page on http://localhost:8000 and builds it again
// after each change.

import * as fs from 'node:fs';
import * as esbuild from 'esbuild';
import { thirdPartyNotices } from './scripts/third-party-notices.mjs';

const production = process.argv.includes('--production');
const demo = process.argv.includes('--demo') || process.argv.includes('--serve');
const serve = process.argv.includes('--serve');

const common = { bundle: true, sourcemap: !production, minify: false, logLevel: 'info', target: 'es2022' };

if (production) {
  fs.rmSync('dist', { recursive: true, force: true });
}
await esbuild.build({ ...common, entryPoints: ['src/index.ts'], outfile: 'dist/index.js', format: 'esm', platform: 'browser', packages: 'external' });
await esbuild.build({ ...common, entryPoints: ['src/styles/markdown.css'], outfile: 'dist/markdown.css' });

if (demo) {
  const options = {
    ...common,
    entryPoints: { demo: 'demo/main.ts', markdown: 'src/styles/markdown.css' },
    outdir: 'demo/dist',
    format: 'iife',
    platform: 'browser',
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
