// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The loop of a chat (docs/ai.md, R-AI-001, R-AI-002): runChat asks the provider for an answer, runs the calls of tools
// of the answer, gives their results to the AI and asks again, until the AI finishes. A call of the tool
// `propose_change` becomes a proposed change, which the integrating code shows in the editor; the result of the tool
// says the AI whether the user accepted it. Each request has the context as it is then, so that the AI knows the text
// after an accepted change. The loop runs where the editor is, for example in the page; the provider may run in another
// process (src/remote.ts).

import { changeOf, proposeChangeTool, type RangeChange } from './changeTool';
import type { AiContent, AiContext, AiEndReason, AiMessage, AiProvider, AiTool, AiToolCall, AiToolResult } from './provider';

/** ProposalResult is the end of a proposed change: as the editor gives it. */
export type ProposalResult = 'accepted' | 'rejected' | 'outdated';

/** ChatChange is a proposed change of the AI: the range of the text of the file, the new text, and the ID of the call. */
export interface ChatChange extends RangeChange {
  readonly id: string;
}

/** ChatTool is a tool of the integrating code, with the function that runs it, for example the tool of the memory. */
export interface ChatTool extends AiTool {
  /**
   * run runs a call of the tool.
   * @param input - The input of the call.
   * @param signal - The signal that stops the answer.
   * @returns The result for the AI; an exception is a failed call, whose message the AI gets.
   */
  run(input: unknown, signal: AbortSignal): Promise<string>;
}

/** ChatOptions are the options of one answer of a chat. */
export interface ChatOptions {
  readonly provider: AiProvider;
  /** model is the ID of the model. */
  readonly model: string;
  /** instructions are the instructions of the integrating code; without them, the AI has the default instructions. */
  readonly instructions?: string;
  /** messages are the messages of the chat so far, the last one the message of the user. */
  readonly messages: readonly AiMessage[];
  /** context returns the context of the document as it is now. */
  readonly context: () => AiContext;
  /** propose shows a proposed change, for example with proposeChange of the editor, and returns its result. */
  readonly propose: (change: ChatChange) => Promise<ProposalResult>;
  readonly tools?: readonly ChatTool[];
  /** signal stops the answer; a proposed change that is open stays open. */
  readonly signal?: AbortSignal;
  /** maxTurns is the most requests of one answer; the default is 20. */
  readonly maxTurns?: number;
}

/**
 * ChatEvent is an event of an answer: a part of its text, a proposed change and its result, the call of a tool with its
 * result, a new message of the chat, which the integrating code keeps for the next answer, the end, or an error.
 */
export type ChatEvent =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'change'; readonly change: ChatChange }
  | { readonly type: 'changeResult'; readonly id: string; readonly result: ProposalResult }
  | { readonly type: 'tool'; readonly call: AiToolCall; readonly result: AiToolResult }
  | { readonly type: 'message'; readonly message: AiMessage }
  | { readonly type: 'end'; readonly reason: AiEndReason | 'turns' }
  | { readonly type: 'error'; readonly message: string };

/** resultTexts are the results of the tool `propose_change` for the AI. */
const resultTexts: Readonly<Record<ProposalResult, string>> = {
  accepted: 'The user accepted the change; the document has the new text.',
  rejected: 'The user rejected the change; the document is unchanged.',
  outdated: 'The change was not applied, because the text of the document changed meanwhile or the editor closed. The context of the next request has the text as it is now.',
};

/** stoppedText is the result of a call that did not run, because the user stopped the answer. */
const stoppedText = 'The user stopped the answer before the call ran.';

/** messageOf returns the message of an exception. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * runChat runs one answer of a chat: the requests to the provider and the calls of tools, until the AI finishes, the
 * user stops it, or an error.
 * @param options - The options.
 * @returns The events of the answer.
 */
export async function* runChat(options: ChatOptions): AsyncGenerator<ChatEvent, void> {
  const signal = options.signal ?? new AbortController().signal;
  const own = options.tools ?? [];
  if (own.some((tool) => tool.name === proposeChangeTool.name)) {
    yield { type: 'error', message: `A tool of the integrating code has the name ${proposeChangeTool.name}, which the chat has.` };
    return;
  }
  const tools: AiTool[] = [proposeChangeTool, ...own.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))];
  const messages = [...options.messages];
  const maxTurns = options.maxTurns ?? 20;
  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal.aborted) {
      yield { type: 'end', reason: 'stopped' };
      return;
    }
    const content: AiContent[] = [];
    let reason: AiEndReason | undefined;
    try {
      const request = { model: options.model, instructions: options.instructions, messages: [...messages], context: options.context(), tools };
      for await (const event of options.provider.stream(request, signal)) {
        if (event.type === 'text') {
          // The parts of a text of the answer become one text of the message.
          const last = content[content.length - 1];
          if (last?.type === 'text') {
            content[content.length - 1] = { type: 'text', text: last.text + event.text };
          } else {
            content.push({ type: 'text', text: event.text });
          }
          yield event;
        } else if (event.type === 'toolCall') {
          content.push({ type: 'toolCall', id: event.id, name: event.name, input: event.input });
        } else if (event.type === 'end') {
          reason = event.reason;
          break;
        } else {
          yield { type: 'error', message: event.message };
          return;
        }
      }
    } catch (error) {
      yield { type: 'error', message: messageOf(error) };
      return;
    }
    if (content.length > 0) {
      const message: AiMessage = { role: 'assistant', content };
      messages.push(message);
      yield { type: 'message', message };
    }
    const calls = content.filter((part): part is AiToolCall => part.type === 'toolCall');
    if (calls.length === 0) {
      yield { type: 'end', reason: reason ?? (signal.aborted ? 'stopped' : 'done') };
      return;
    }
    // Each call gets a result, also when the user stopped the answer, so that the chat can go on.
    const results: AiToolResult[] = [];
    for (const call of calls) {
      if (signal.aborted || reason !== 'toolCalls') {
        results.push({ type: 'toolResult', id: call.id, text: stoppedText, isError: true });
      } else if (call.name === proposeChangeTool.name) {
        const found = changeOf(options.context().document.text, call.input);
        if ('error' in found) {
          results.push({ type: 'toolResult', id: call.id, text: found.error, isError: true });
          continue;
        }
        const change: ChatChange = { id: call.id, ...found };
        yield { type: 'change', change };
        const result = await options.propose(change).catch((): ProposalResult => 'outdated');
        yield { type: 'changeResult', id: call.id, result };
        results.push({ type: 'toolResult', id: call.id, text: resultTexts[result] });
      } else {
        const tool = own.find((one) => one.name === call.name);
        let result: AiToolResult;
        try {
          result = tool ? { type: 'toolResult', id: call.id, text: await tool.run(call.input, signal) } : { type: 'toolResult', id: call.id, text: `There is no tool ${call.name}.`, isError: true };
        } catch (error) {
          result = { type: 'toolResult', id: call.id, text: messageOf(error), isError: true };
        }
        yield { type: 'tool', call, result };
        results.push(result);
      }
    }
    const message: AiMessage = { role: 'user', content: results };
    messages.push(message);
    yield { type: 'message', message };
    if (signal.aborted || reason !== 'toolCalls') {
      yield { type: 'end', reason: signal.aborted ? 'stopped' : (reason ?? 'done') };
      return;
    }
  }
  yield { type: 'end', reason: 'turns' };
}
