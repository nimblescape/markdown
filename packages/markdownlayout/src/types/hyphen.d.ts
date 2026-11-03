// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The types of the modules of the npm package hyphen that the layout part uses: each module of a language is the
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

declare module 'hyphen/de-1996/index.js' {
  const language: HyphenLanguage;
  export default language;
}
declare module 'hyphen/en-gb/index.js' {
  const language: HyphenLanguage;
  export default language;
}
declare module 'hyphen/en-us/index.js' {
  const language: HyphenLanguage;
  export default language;
}
declare module 'hyphen/es/index.js' {
  const language: HyphenLanguage;
  export default language;
}
declare module 'hyphen/fr/index.js' {
  const language: HyphenLanguage;
  export default language;
}
declare module 'hyphen/it/index.js' {
  const language: HyphenLanguage;
  export default language;
}
