// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The packages of the workspaces resolve each other to their sources, so that the tests need no build: the condition
  // comes before the default conditions of Vite, for the tests in a page and for the tests without a page.
  resolve: { conditions: ['nimblescape-source', 'module', 'browser', 'development|production'] },
  ssr: { resolve: { conditions: ['nimblescape-source', 'module', 'node', 'development|production'] } },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // The tests of the Markdown need no page; a test of the view sets `@vitest-environment happy-dom` in its file.
    environment: 'node',
    // A style sheet that a module imports as its text with the suffix `?raw` keeps its text in the tests, for example the
    // style sheet of the built-in layout `plain` (packages/markdownlayout); without this, Vitest gives an empty text.
    css: { include: [/\.css\?raw$/] },
  },
});
