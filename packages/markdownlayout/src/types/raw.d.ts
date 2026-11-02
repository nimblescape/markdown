// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// A module with the suffix ?raw is the text of its file: esbuild.mjs and vitest read it so.
declare module '*?raw' {
  const text: string;
  export default text;
}
