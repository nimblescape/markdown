// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The browser that prints the PDF (docs/rendering.md, R-LAYOUT-002): the program that the integrating code names, else
// the program of an environment variable, else an installed Google Chrome, Chromium, Microsoft Edge or Brave. Without
// one, the error NoBrowserError says where to get Chrome and how to name another program. nimblescape Markdown Paper
// uses this search, with its own environment variable, and also downloads Chromium when the user agrees; the layout
// part downloads nothing. The module runs in Node.js.

import * as fs from 'node:fs';
import * as path from 'node:path';

/** NoBrowserError is the error of a computer without an installed browser. */
export class NoBrowserError extends Error {}

/** browserVariable is the default environment variable that names the program of the browser. */
export const browserVariable = 'NIMBLESCAPE_BROWSER';

/**
 * candidates returns the places of the programs of the browsers on a system, in the order of the search.
 * @param platform - The platform, as `process.platform` names it.
 * @param env - The environment variables.
 */
export function candidates(platform: string, env: Readonly<Record<string, string | undefined>>): string[] {
  if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter((root): root is string => !!root);
    return [
      ...roots.map((root) => path.win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      ...roots.map((root) => path.win32.join(root, 'Chromium', 'Application', 'chrome.exe')),
      ...roots.map((root) => path.win32.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
    ];
  }
  if (platform === 'darwin') {
    const apps = ['Google Chrome.app/Contents/MacOS/Google Chrome', 'Chromium.app/Contents/MacOS/Chromium', 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Brave Browser.app/Contents/MacOS/Brave Browser'];
    return [...apps.map((app) => `/Applications/${app}`), ...(env.HOME ? apps.map((app) => path.posix.join(env.HOME as string, 'Applications', app)) : [])];
  }
  const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser'];
  const folders = (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  return [...names.flatMap((name) => folders.map((folder) => path.posix.join(folder, name))), '/opt/google/chrome/chrome', '/snap/bin/chromium'];
}

/**
 * isProgram tells whether a file exists and can be run.
 * @param file - The path of the file.
 */
function isProgram(file: string): boolean {
  try {
    fs.accessSync(file, process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * findBrowser returns the path of the program of the browser: the configured path, else the environment variable,
 * else the first installed browser of the search.
 * @param configured - The path that the integrating code names, for example from a setting, or empty.
 * @param variable - The environment variable that names the program.
 * @throws When the configured program does not exist; a NoBrowserError when no browser is installed.
 */
export function findBrowser(configured = '', variable = browserVariable): string {
  const named = configured.trim() || (process.env[variable] ?? '').trim();
  if (named) {
    if (!isProgram(named)) {
      throw new Error(`The browser program ${named} does not exist or cannot be run.`);
    }
    return named;
  }
  const found = candidates(process.platform, process.env).find(isProgram);
  if (!found) {
    throw new NoBrowserError(
      `No Google Chrome, Chromium or Microsoft Edge was found for the PDF. Install Google Chrome (https://www.google.com/chrome/), or name the program of the browser in the environment variable ${variable}.`,
    );
  }
  return found;
}
