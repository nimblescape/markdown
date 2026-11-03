// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// ESLint for the sources: the recommended rules of ESLint and of typescript-eslint, for the TypeScript of the packages,
// their tests and the demo page, and the build scripts. CI runs it with npm run lint.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // The built files and the installed packages are no sources.
    ignores: ['packages/*/dist/', 'demo/dist/', 'demo/vscode/dist/', '**/node_modules/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // A parameter or a variable with a leading underscore is unused on purpose.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    // The scripts of the pages, also the script of the page of the layout part, which the page holds as its text.
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.js', 'demo/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    // The tests, the build scripts, and the entry points for Node.js, for example the PDF of the layout part.
    files: ['**/*.mjs', '**/*.mts', 'packages/*/src/**/*.test.ts', 'packages/*/src/pdf/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
);
