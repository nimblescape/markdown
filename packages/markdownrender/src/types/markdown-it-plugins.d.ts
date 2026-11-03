// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The types of the markdown-it plugins without types of their own.

declare module 'markdown-it-footnote' {
  import type { PluginSimple } from 'markdown-it';
  const footnote: PluginSimple;
  export default footnote;
}

declare module 'markdown-it-task-lists' {
  import type { PluginWithOptions } from 'markdown-it';
  const taskLists: PluginWithOptions<{ enabled?: boolean; label?: boolean; labelAfter?: boolean }>;
  export default taskLists;
}
