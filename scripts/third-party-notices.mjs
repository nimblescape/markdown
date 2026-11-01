// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The notices of the packages of a bundle, written from the installed packages: esbuild.mjs writes them for the bundle
// of the example page (demo/dist/THIRD-PARTY-NOTICES.md), which holds the editor with all its libraries. The same script
// is in nimblescape Markdown Paper. For each package of the metafile of esbuild, the notices name its version, its license
// as its manifest names it and the place of its source code, and hold the texts of its license and notice files, or
// the section "License" of its README when it has no license file. Nothing comes from another source.
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * packageFolders returns the folders of the packages of the inputs of a metafile of esbuild: the part of the path up to
 * the name after the last node_modules.
 * @param metafile - The metafile.
 */
export function packageFolders(metafile) {
  const folders = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const folder = /^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(input)?.[1];
    if (folder) {
      folders.add(folder);
    }
  }
  return [...folders];
}

/**
 * sourceOf returns the address of the source code of a package from its manifest.
 * @param manifest - The manifest.
 */
function sourceOf(manifest) {
  const repository = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url;
  if (repository) {
    const shorthand = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(repository);
    if (shorthand) {
      return `https://github.com/${shorthand[1]}`;
    }
    return repository.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/^ssh:\/\/git@/, 'https://').replace(/\.git$/, '');
  }
  return manifest.homepage ?? `https://www.npmjs.com/package/${manifest.name}/v/${manifest.version}`;
}

/**
 * licenseTexts returns the texts of the license and notice files of a package, or the section "License" of its README.
 * @param folder - The folder of the package.
 */
function licenseTexts(folder) {
  const files = fs
    .readdirSync(folder)
    .filter((file) => /^(licen[sc]e|copying|notice)(?![\w-]*\.(?:m?js|ts)$)/i.test(file) && fs.statSync(path.join(folder, file)).isFile())
    .sort();
  if (files.length > 0) {
    return files.map((file) => fs.readFileSync(path.join(folder, file), 'utf8').trim());
  }
  const readme = fs.readdirSync(folder).find((file) => /^readme(\.md)?$/i.test(file));
  const section = readme ? /^#+\s*licen[sc]e\s*$([\s\S]*?)(?=^#+\s|(?![\s\S]))/im.exec(fs.readFileSync(path.join(folder, readme), 'utf8'))?.[1].trim() : undefined;
  return section ? [section] : [];
}

/**
 * anchorOf returns the anchor of a heading as GitHub writes it.
 * @param heading - The text of the heading.
 */
const anchorOf = (heading) => `#${heading.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-')}`;

/**
 * thirdPartyNotices returns the text of the notices of the packages of a bundle.
 * @param metafile - The metafile of esbuild of the bundle.
 * @param introduction - The text before the list, which names the files of the bundle.
 * @returns The text, and the packages without the text of a license.
 */
export function thirdPartyNotices(metafile, introduction) {
  const packages = packageFolders(metafile)
    .map((folder) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
      const texts = licenseTexts(folder);
      const license = typeof manifest.license === 'string' ? manifest.license : (texts[0]?.split('\n')[0].trim() ?? 'unknown');
      return { name: manifest.name, version: manifest.version, license, source: sourceOf(manifest), texts };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true }));
  const rows = packages.map((item) => `| [${item.name}](${anchorOf(`${item.name} ${item.version}`)}) | ${item.version} | ${item.license} |`);
  const sections = packages.map((item) =>
    [
      `## ${item.name} ${item.version}`,
      '',
      `Source code: <${item.source}>. ${item.texts.length > 0 ? 'Its license:' : 'The package holds no text of its license.'}`,
      ...item.texts.flatMap((text) => ['', '```text', text.replace(/```/g, "'''"), '```']),
    ].join('\n'),
  );
  const text = [introduction.trim(), '', '| Package | Version | License |', '| --- | --- | --- |', ...rows, '', ...sections.flatMap((section) => [section, ''])].join('\n');
  return { text, missing: packages.filter((item) => item.texts.length === 0).map((item) => item.name) };
}
