// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The provider API (docs/ai.md, R-AI-002): a provider has a name, its models, and one function that takes the messages,
// the context and the tools and returns a stream of events. The types are the same for every AI, so that the chat, the
// context and the tools do not depend on one AI; a provider translates them to the API of its AI.

import type { JsonSchema } from '@nimblescape/markdowntext';

/** AiModel is a model of a provider. */
export interface AiModel {
  /** id is the ID of the model in the API of the AI. */
  readonly id: string;
  /** name is the name of the model for the user. */
  readonly name: string;
}

/** AiText is text of a message. */
export interface AiText {
  readonly type: 'text';
  readonly text: string;
}

/** AiToolCall is the call of a tool by the AI. */
export interface AiToolCall {
  readonly type: 'toolCall';
  /** id is the ID of the call, which the result names. */
  readonly id: string;
  readonly name: string;
  /** input is the input of the call, the JSON value that the schema of the tool describes. */
  readonly input: unknown;
}

/** AiToolResult is the result of the call of a tool, for the AI. */
export interface AiToolResult {
  readonly type: 'toolResult';
  /** id is the ID of the call. */
  readonly id: string;
  readonly text: string;
  /** isError is true when the call failed; the text says why. */
  readonly isError?: boolean;
}

/** AiContent is a part of a message. */
export type AiContent = AiText | AiToolCall | AiToolResult;

/** AiMessage is a message of a chat: of the user, with the results of tools, or of the AI, with the calls of tools. */
export interface AiMessage {
  readonly role: 'user' | 'assistant';
  readonly content: readonly AiContent[];
}

/** AiTool is a tool that the AI may call. */
export interface AiTool {
  /** name is the name of the tool, of letters, digits, `_` and `-`. */
  readonly name: string;
  /** description says the AI what the tool does and when to call it. */
  readonly description: string;
  /** inputSchema is the JSON schema of the input. */
  readonly inputSchema: JsonSchema;
}

/** AiSelection is a range of the text of the file, as the source counts the text. */
export interface AiSelection {
  readonly from: number;
  readonly to: number;
}

/**
 * AiContext is what the AI knows of the document (R-AI-001): the file with its text, the selection, the JSON schema of
 * the front matter, and the format rules of the active plugins.
 */
export interface AiContext {
  readonly document: {
    /** name is the path or the name of the file. */
    readonly name: string;
    /** text is the text of the file. */
    readonly text: string;
  };
  readonly selection?: AiSelection;
  readonly frontMatterSchema?: JsonSchema;
  /** formatRules are the format rules of the active plugins, each a text in Markdown. */
  readonly formatRules?: readonly string[];
}

/** AiRequest is one request to an AI: the model, the instructions, the messages, the context and the tools. */
export interface AiRequest {
  /** model is the ID of the model. */
  readonly model: string;
  /** instructions are the instructions of the integrating code; instructionsOf adds the context to them. */
  readonly instructions?: string;
  readonly messages: readonly AiMessage[];
  readonly context: AiContext;
  readonly tools: readonly AiTool[];
}

/**
 * AiEndReason is why an answer ended: `done` when the AI finished, `toolCalls` when it waits for the results of its
 * calls of tools, `length` at the limit of the length of an answer, `refusal` when the AI refused to answer, `stopped`
 * when the user stopped it.
 */
export type AiEndReason = 'done' | 'toolCalls' | 'length' | 'refusal' | 'stopped';

/**
 * AiEvent is an event of the stream of an answer: a part of its text, the call of a tool, the end, or an error. The
 * stream ends after the end or an error.
 */
export type AiEvent =
  | AiText
  | AiToolCall
  | { readonly type: 'end'; readonly reason: AiEndReason }
  | { readonly type: 'error'; readonly message: string };

/** AiProvider is an AI that the integrating code registers (R-AI-002). */
export interface AiProvider {
  /** name is the name of the provider, for example `claude`. */
  readonly name: string;
  /** models returns the models of the provider. */
  models(): Promise<readonly AiModel[]>;
  /**
   * stream asks the AI for an answer and returns its events. A provider gives a failure as an event `error`, not as an
   * exception of the stream.
   * @param request - The request.
   * @param signal - The signal that stops the answer; the stream then ends with the reason `stopped`.
   */
  stream(request: AiRequest, signal: AbortSignal): AsyncIterable<AiEvent>;
}
