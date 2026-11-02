// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The types of the modules of the npm package hyphen that the renderer uses: each module of a language exports the
// hyphenation of a text with the patterns of TeX of that language.
interface HyphenOptions {
  hyphenChar?: string;
  minWordLength?: number;
  debug?: boolean;
  exceptions?: string[];
  html?: boolean;
}

interface HyphenLanguage {
  hyphenateSync(text: string, options?: HyphenOptions): string;
  hyphenate(text: string, options?: HyphenOptions): Promise<string>;
}

declare module 'hyphen/de-1996' {
  export const hyphenateSync: HyphenLanguage['hyphenateSync'];
}
declare module 'hyphen/en-gb' {
  export const hyphenateSync: HyphenLanguage['hyphenateSync'];
}
declare module 'hyphen/en-us' {
  export const hyphenateSync: HyphenLanguage['hyphenateSync'];
}
declare module 'hyphen/es' {
  export const hyphenateSync: HyphenLanguage['hyphenateSync'];
}
declare module 'hyphen/fr' {
  export const hyphenateSync: HyphenLanguage['hyphenateSync'];
}
declare module 'hyphen/it' {
  export const hyphenateSync: HyphenLanguage['hyphenateSync'];
}
