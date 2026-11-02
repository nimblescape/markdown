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
  },
});
