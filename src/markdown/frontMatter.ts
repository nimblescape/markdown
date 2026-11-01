// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The front matter at the start of a file (docs/specification.md, R-FM-001): YAML between two lines `---` (the last
// one can also be `...`), TOML between two lines `+++`, or JSON as an object whose first line is `{` and whose last
// line is `}` (decision 7).

/** FrontMatterFormat is the syntax of a front matter (decision 7). */
export type FrontMatterFormat = 'yaml' | 'toml' | 'json';

/** FrontMatter is a front matter that starts a text. */
export interface FrontMatter {
  /** format is the syntax of the front matter. */
  format: FrontMatterFormat;
  /** lines is the number of lines of the front matter, with its fences. */
  lines: number;
}

/**
 * frontMatterOf returns the front matter at the start of the lines of a text, or undefined when the text has none.
 * @param lines - The lines of the text, without their line breaks.
 */
export function frontMatterOf(lines: readonly string[]): FrontMatter | undefined {
  const first = lines[0]?.trimEnd();
  const closing = (test: (line: string) => boolean): number => {
    for (let index = 1; index < lines.length; index++) {
      if (test(lines[index].trimEnd())) {
        return index + 1;
      }
    }
    return 0;
  };
  if (first === '---') {
    const end = closing((line) => line === '---' || line === '...');
    return end > 0 ? { format: 'yaml', lines: end } : undefined;
  }
  if (first === '+++') {
    const end = closing((line) => line === '+++');
    return end > 0 ? { format: 'toml', lines: end } : undefined;
  }
  if (first === '{') {
    const end = closing((line) => line === '}');
    return end > 0 ? { format: 'json', lines: end } : undefined;
  }
  return undefined;
}
