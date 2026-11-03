// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The npm package @nimblescape/markdownai, the AI of nimblescape Markdown without a view (docs/ai.md, proposal of
// docs/specification.md, R-ARCH-002): the provider API that makes any AI pluggable (R-AI-002), the context of the
// document for the AI (R-AI-001), the tool with which the AI proposes a change of the text, which the editor shows as a
// tracked change (R-AI-006), the loop of a chat with its tools, and the provider in another process, so that the API
// key never reaches the page (R-AI-005). The package has no provider of its own AI; it runs in browsers, in the
// webviews and the extension host of VS Code, and in Node.js.

export type { AiContent, AiContext, AiEndReason, AiEvent, AiMessage, AiModel, AiProvider, AiRequest, AiSelection, AiText, AiTool, AiToolCall, AiToolResult } from './provider';
export { contextText, defaultInstructions, instructionsOf } from './context';
export { changeOf, proposeChangeTool, type ChangeOf, type RangeChange } from './changeTool';
export { runChat, type ChatChange, type ChatEvent, type ChatOptions, type ChatTool, type ProposalResult } from './chat';
export { remoteProvider, serveProvider, type AiChannel } from './remote';
