// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The types of the examples of the CommonMark specification, which the tests of the round trip read.

declare module 'commonmark-spec' {
  const spec: { text: string; tests: { markdown: string; html: string; section: string; number: number }[] };
  export default spec;
}
