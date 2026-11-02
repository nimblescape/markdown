// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The built-in layouts (docs/rendering.md, R-LAYOUT-001): the layout `plain` of a document without the field `layout`.
// Its files are in layouts/plain/ of the package, and the package holds their texts, so that the layout works in a
// browser and in the command line without a file of the package. A built-in layout has only its layout.json, its style
// sheets and its templates, no fonts and no images.

import plainLayout from '../layouts/plain/layout.json?raw';
import plainPage from '../layouts/plain/page.css?raw';
import plainTitle from '../layouts/plain/title.html?raw';

/** builtinFolder is the URL of the folder of the built-in layouts, with a slash at its end. */
export const builtinFolder = 'nimblescape-layout:/';

/** builtinFiles are the texts of the files of the built-in layouts, by their URLs. */
const builtinFiles: ReadonlyMap<string, string> = new Map([
  [`${builtinFolder}plain/layout.json`, plainLayout],
  [`${builtinFolder}plain/page.css`, plainPage],
  [`${builtinFolder}plain/title.html`, plainTitle],
]);

/** builtinLayouts are the names of the built-in layouts. */
export const builtinLayouts: readonly string[] = ['plain'];

/**
 * builtinFile returns the text of a file of a built-in layout, or undefined for another URL.
 * @param url - The URL of the file.
 */
export const builtinFile = (url: string): string | undefined => builtinFiles.get(url);
