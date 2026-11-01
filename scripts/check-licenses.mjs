// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The check of the licenses of the libraries (docs/specification.md, R-GEN-011, decision 22): the license of each
// library is decided one by one, and licenses.json lists each package that the editor depends on at run time with the
// license that was decided for it. The check reads the packages from package-lock.json, without the development
// tools, and fails for a package that licenses.json does not list or whose license is not the decided one. CI runs it
// with npm run licenses; --write adds the missing packages to licenses.json with their license, for a review in the
// pull request.

import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * runtimePackages returns the packages of a lock file that the editor needs at run time: name, version and license.
 * @param lock - The content of package-lock.json.
 */
export function runtimePackages(lock) {
  return Object.entries(lock.packages)
    .filter(([key, entry]) => key.startsWith('node_modules/') && !entry.dev && !entry.devOptional)
    .map(([key, entry]) => ({ name: key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length), version: entry.version, license: entry.license ?? 'unknown' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * problems returns the packages whose license licenses.json does not hold as decided.
 * @param packages - The packages that the editor needs at run time.
 * @param decided - The content of licenses.json.
 */
export function problems(packages, decided) {
  return packages
    .filter((item) => decided.packages[item.name]?.license !== item.license)
    .map((item) =>
      decided.packages[item.name]
        ? `${item.name} ${item.version}: the license is ${item.license}, licenses.json decided ${decided.packages[item.name].license}`
        : `${item.name} ${item.version}: licenses.json has no decision for its license ${item.license}`,
    );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const packages = runtimePackages(JSON.parse(fs.readFileSync('package-lock.json', 'utf8')));
  const decided = JSON.parse(fs.readFileSync('licenses.json', 'utf8'));
  if (process.argv.includes('--write')) {
    for (const item of packages) {
      decided.packages[item.name] ??= { license: item.license };
    }
    decided.packages = Object.fromEntries(Object.entries(decided.packages).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync('licenses.json', `${JSON.stringify(decided, null, 2)}\n`);
  }
  const found = problems(packages, decided);
  for (const problem of found) {
    console.error(problem);
  }
  console.log(`${packages.length} packages, ${found.length} without a decided license.`);
  process.exitCode = found.length > 0 ? 1 : 0;
}
