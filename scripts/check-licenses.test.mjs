// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the check of the licenses (docs/specification.md, R-GEN-011).

import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { problems, runtimePackages } from './check-licenses.mjs';

const lock = {
  packages: {
    '': { name: 'nimblescape-markdown', workspaces: ['packages/text'] },
    'node_modules/@nimblescape/text': { resolved: 'packages/text', link: true },
    'packages/text': { name: '@nimblescape/text', version: '0.1.0', license: 'MIT' },
    'packages/text/node_modules/d': { version: '6.0.0', license: 'MIT' },
    'node_modules/a': { version: '1.0.0', license: 'MIT' },
    'node_modules/b': { version: '2.0.0', license: 'ISC' },
    'node_modules/a/node_modules/c': { version: '3.0.0' },
    'node_modules/tool': { version: '4.0.0', license: 'MIT', dev: true },
    'node_modules/optional-tool': { version: '5.0.0', license: 'MIT', devOptional: true },
  },
};

describe('the check of the licenses', () => {
  it('reads the packages of the run time from the lock file, without the development tools and the workspaces', () => {
    expect(runtimePackages(lock)).toEqual([
      { name: 'a', version: '1.0.0', license: 'MIT' },
      { name: 'b', version: '2.0.0', license: 'ISC' },
      { name: 'c', version: '3.0.0', license: 'unknown' },
      { name: 'd', version: '6.0.0', license: 'MIT' },
    ]);
  });

  it('names each package without a decision and each package whose license changed', () => {
    const decided = { packages: { a: { license: 'MIT' }, b: { license: 'MIT' }, d: { license: 'MIT' } } };
    expect(problems(runtimePackages(lock), decided)).toEqual([
      'b 2.0.0: the license is ISC, licenses.json decided MIT',
      'c 3.0.0: licenses.json has no decision for its license unknown',
    ]);
  });

  it('finds a decision for every package of the libraries', () => {
    const packages = runtimePackages(JSON.parse(fs.readFileSync('package-lock.json', 'utf8')));
    expect(problems(packages, JSON.parse(fs.readFileSync('licenses.json', 'utf8')))).toEqual([]);
  });
});
