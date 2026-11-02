// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the loop of a chat (docs/ai.md, R-AI-001, R-AI-002) with a provider that gives prepared answers: the
// text, a proposed change and its result for the AI, the context after an accepted change, the tools of the integrating
// code, the stop by the user, the errors and the limit of the requests.

import { describe, expect, it } from 'vitest';
import { runChat, type ChatEvent, type ChatOptions, type ProposalResult } from './chat';
import type { AiEvent, AiProvider, AiRequest } from './provider';

/** scripted returns a provider that gives one prepared answer for each request, and keeps the requests. */
function scripted(answers: AiEvent[][]): AiProvider & { requests: AiRequest[] } {
  const requests: AiRequest[] = [];
  return {
    name: 'scripted',
    requests,
    models: async () => [{ id: 'one', name: 'One' }],
    stream: (request) => ({
      async *[Symbol.asyncIterator]() {
        requests.push(request);
        yield* answers[requests.length - 1] ?? [{ type: 'end', reason: 'done' }];
      },
    }),
  };
}

/** collect returns the events of an answer. */
async function collect(options: ChatOptions): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of runChat(options)) {
    events.push(event);
  }
  return events;
}

/** chat returns the options of a chat on a document, whose proposed changes end with a result. */
function chat(provider: AiProvider, result: ProposalResult = 'accepted'): ChatOptions & { document: { text: string } } {
  const document = { text: '# Title\n\nFirst paragraph.\n' };
  return {
    document,
    provider,
    model: 'one',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'Change the paragraph.' }] }],
    context: () => ({ document: { name: 'a.md', text: document.text } }),
    propose: async (change) => {
      if (result === 'accepted') {
        document.text = document.text.slice(0, change.from) + change.text + document.text.slice(change.to);
      }
      return result;
    },
  };
}

const call = { type: 'toolCall', id: 'call-1', name: 'propose_change', input: { old_text: 'First paragraph.', new_text: 'First part.' } } as const;

describe('the loop of a chat', () => {
  it('gives the text of an answer in parts and as one message', async () => {
    const provider = scripted([[{ type: 'text', text: 'Hello' }, { type: 'text', text: ' there.' }, { type: 'end', reason: 'done' }]]);
    const events = await collect(chat(provider));
    expect(events).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' there.' },
      { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'Hello there.' }] } },
      { type: 'end', reason: 'done' },
    ]);
    expect(provider.requests[0].tools.map((tool) => tool.name)).toEqual(['propose_change']);
    expect(provider.requests[0].context.document.text).toBe('# Title\n\nFirst paragraph.\n');
  });

  it('turns a call of propose_change into a proposed change and gives the AI its result and the new text', async () => {
    const provider = scripted([
      [{ type: 'text', text: 'I change it.' }, call, { type: 'end', reason: 'toolCalls' }],
      [{ type: 'text', text: 'Done.' }, { type: 'end', reason: 'done' }],
    ]);
    const options = chat(provider);
    const events = await collect(options);
    const at = '# Title\n\nFirst '.length;
    expect(events.filter((event) => event.type === 'change' || event.type === 'changeResult')).toEqual([
      { type: 'change', change: { id: 'call-1', from: at, to: at + 'paragraph'.length, text: 'part' } },
      { type: 'changeResult', id: 'call-1', result: 'accepted' },
    ]);
    expect(options.document.text).toBe('# Title\n\nFirst part.\n');
    const second = provider.requests[1];
    expect(second.context.document.text).toBe('# Title\n\nFirst part.\n');
    expect(second.messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
    expect(second.messages[1].content).toEqual([{ type: 'text', text: 'I change it.' }, call]);
    expect(second.messages[2].content).toEqual([{ type: 'toolResult', id: 'call-1', text: expect.stringContaining('accepted') }]);
    expect(events[events.length - 1]).toEqual({ type: 'end', reason: 'done' });
  });

  it('tells the AI that the user rejected a change', async () => {
    const provider = scripted([[call, { type: 'end', reason: 'toolCalls' }]]);
    const options = chat(provider, 'rejected');
    await collect(options);
    expect(options.document.text).toBe('# Title\n\nFirst paragraph.\n');
    expect(provider.requests[1].messages[2].content).toEqual([{ type: 'toolResult', id: 'call-1', text: expect.stringContaining('rejected') }]);
  });

  it('gives the AI the reason of a change that it cannot propose, without a proposed change', async () => {
    const provider = scripted([[{ ...call, input: { old_text: 'Third', new_text: 'x' } }, { type: 'end', reason: 'toolCalls' }]]);
    const events = await collect(chat(provider));
    expect(events.some((event) => event.type === 'change')).toBe(false);
    expect(provider.requests[1].messages[2].content).toEqual([{ type: 'toolResult', id: 'call-1', text: expect.stringContaining('does not occur'), isError: true }]);
  });

  it('runs the tools of the integrating code, with their failures and the tools that do not exist', async () => {
    const provider = scripted([
      [
        { type: 'toolCall', id: 'a', name: 'memory', input: { read: 'decisions' } },
        { type: 'toolCall', id: 'b', name: 'failing', input: {} },
        { type: 'toolCall', id: 'c', name: 'unknown', input: {} },
        { type: 'end', reason: 'toolCalls' },
      ],
    ]);
    const options: ChatOptions = {
      ...chat(provider),
      tools: [
        { name: 'memory', description: 'The memory.', inputSchema: { type: 'object' }, run: async (input) => `read ${JSON.stringify(input)}` },
        { name: 'failing', description: 'Fails.', inputSchema: { type: 'object' }, run: async () => Promise.reject(new Error('The disk is full.')) },
      ],
    };
    const events = await collect(options);
    expect(provider.requests[0].tools.map((tool) => tool.name)).toEqual(['propose_change', 'memory', 'failing']);
    expect(provider.requests[0].tools[1]).toEqual({ name: 'memory', description: 'The memory.', inputSchema: { type: 'object' } });
    expect(events.filter((event) => event.type === 'tool').map((event) => (event.type === 'tool' ? event.result : undefined))).toEqual([
      { type: 'toolResult', id: 'a', text: 'read {"read":"decisions"}' },
      { type: 'toolResult', id: 'b', text: 'The disk is full.', isError: true },
      { type: 'toolResult', id: 'c', text: 'There is no tool unknown.', isError: true },
    ]);
  });

  it('stops when the user stops the answer, and gives each call of the answer a result', async () => {
    const controller = new AbortController();
    const provider = scripted([[call, { type: 'toolCall', id: 'call-2', name: 'memory', input: {} }, { type: 'end', reason: 'toolCalls' }]]);
    const options = chat(provider);
    const events = await collect({
      ...options,
      signal: controller.signal,
      propose: async (change) => {
        controller.abort();
        return options.propose(change);
      },
    });
    const results = events.filter((event) => event.type === 'message').pop();
    expect(results).toEqual({
      type: 'message',
      message: { role: 'user', content: [{ type: 'toolResult', id: 'call-1', text: expect.stringContaining('accepted') }, { type: 'toolResult', id: 'call-2', text: expect.stringContaining('stopped'), isError: true }] },
    });
    expect(events[events.length - 1]).toEqual({ type: 'end', reason: 'stopped' });
    expect(provider.requests).toHaveLength(1);
  });

  it('gives the error of the provider and ends', async () => {
    expect(await collect(chat(scripted([[{ type: 'text', text: 'Hal' }, { type: 'error', message: 'The API is overloaded.' }]])))).toEqual([
      { type: 'text', text: 'Hal' },
      { type: 'error', message: 'The API is overloaded.' },
    ]);
    const throwing: AiProvider = {
      name: 'throwing',
      models: async () => [],
      stream: () => ({
        [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('No network.')) }),
      }),
    };
    expect(await collect(chat(throwing))).toEqual([{ type: 'error', message: 'No network.' }]);
  });

  it('ends after the most requests of one answer', async () => {
    const again: AiEvent[] = [{ type: 'toolCall', id: 'x', name: 'unknown', input: {} }, { type: 'end', reason: 'toolCalls' }];
    const provider = scripted([again, again, again]);
    const events = await collect({ ...chat(provider), maxTurns: 2 });
    expect(provider.requests).toHaveLength(2);
    expect(events[events.length - 1]).toEqual({ type: 'end', reason: 'turns' });
  });

  it('refuses a tool of the integrating code with the name of the tool of the chat', async () => {
    const events = await collect({ ...chat(scripted([])), tools: [{ name: 'propose_change', description: '', inputSchema: {}, run: async () => '' }] });
    expect(events).toEqual([{ type: 'error', message: expect.stringContaining('propose_change') }]);
  });
});
