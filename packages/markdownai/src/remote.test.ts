// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the provider in another process (docs/ai.md, R-AI-005): the models and the answers through a channel of
// messages that copies each message as JSON, the stop, the provider that does not exist, the checked messages, and an
// answer without an end.

import { describe, expect, it } from 'vitest';
import type { AiEvent, AiProvider, AiRequest } from './provider';
import { remoteProvider, serveProvider, type AiChannel } from './remote';

/** channels returns the two ends of a channel, which give each message later, as a JSON copy. */
function channels(): { page: AiChannel; host: AiChannel; fromPage: unknown[] } {
  const listeners = { page: new Set<(message: unknown) => void>(), host: new Set<(message: unknown) => void>() };
  const fromPage: unknown[] = [];
  const end = (own: keyof typeof listeners, other: keyof typeof listeners): AiChannel => ({
    post: (message) => {
      if (own === 'page') {
        fromPage.push(message);
      }
      const copy = JSON.parse(JSON.stringify(message)) as unknown;
      setTimeout(() => listeners[other].forEach((listener) => listener(copy)));
    },
    onMessage: (listener) => {
      listeners[own].add(listener);
      return () => listeners[own].delete(listener);
    },
  });
  return { page: end('page', 'host'), host: end('host', 'page'), fromPage };
}

/** request is a request of the page. */
const request: AiRequest = {
  model: 'one',
  instructions: 'Be short.',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
  context: { document: { name: 'a.md', text: '# Title\n' }, selection: { from: 2, to: 7 } },
  tools: [{ name: 'memory', description: 'The memory.', inputSchema: { type: 'object' } }],
};

/** collect returns the events of a stream. */
async function collect(stream: AsyncIterable<AiEvent>): Promise<AiEvent[]> {
  const events: AiEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

/** provider returns a provider that gives an answer, waits for its signal when asked, and keeps its requests. */
function provider(answer: AiEvent[], options: { wait?: boolean } = {}): AiProvider & { requests: AiRequest[]; signals: AbortSignal[] } {
  const requests: AiRequest[] = [];
  const signals: AbortSignal[] = [];
  return {
    name: 'claude',
    requests,
    signals,
    models: async () => [{ id: 'one', name: 'One', extra: 'not sent' } as never],
    stream: (body, signal) => ({
      async *[Symbol.asyncIterator]() {
        requests.push(body);
        signals.push(signal);
        yield* answer;
        if (options.wait) {
          await new Promise((resolve) => signal.addEventListener('abort', resolve));
          yield { type: 'end', reason: 'stopped' };
        }
      },
    }),
  };
}

describe('the provider in another process', () => {
  it('gives the models and the answers of the provider on the other side', async () => {
    const { page, host } = channels();
    const real = provider([{ type: 'text', text: 'Hi' }, { type: 'toolCall', id: 'a', name: 'memory', input: { read: 'x' } }, { type: 'end', reason: 'toolCalls' }]);
    serveProvider(host, [real]);
    const remote = remoteProvider(page, 'claude');
    expect(remote.name).toBe('claude');
    expect(await remote.models()).toEqual([{ id: 'one', name: 'One' }]);
    expect(await collect(remote.stream(request, new AbortController().signal))).toEqual([
      { type: 'text', text: 'Hi' },
      { type: 'toolCall', id: 'a', name: 'memory', input: { read: 'x' } },
      { type: 'end', reason: 'toolCalls' },
    ]);
    expect(real.requests).toEqual([request]);
  });

  it('stops the answer on the other side and ends at once on the page', async () => {
    const { page, host } = channels();
    const real = provider([{ type: 'text', text: 'Hi' }], { wait: true });
    serveProvider(host, [real]);
    const controller = new AbortController();
    const events: AiEvent[] = [];
    for await (const event of remoteProvider(page, 'claude').stream(request, controller.signal)) {
      events.push(event);
      if (event.type === 'text') {
        controller.abort();
      }
    }
    expect(events).toEqual([
      { type: 'text', text: 'Hi' },
      { type: 'end', reason: 'stopped' },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(real.signals[0].aborted).toBe(true);
  });

  it('gives an error for a provider that does not exist', async () => {
    const { page, host } = channels();
    serveProvider(host, [provider([])]);
    const remote = remoteProvider(page, 'other');
    await expect(remote.models()).rejects.toThrow('There is no provider other.');
    expect(await collect(remote.stream(request, new AbortController().signal))).toEqual([{ type: 'error', message: 'There is no provider other.' }]);
  });

  it('ends an answer that the provider ends without an end, and gives an exception of the provider as an error', async () => {
    const { page, host } = channels();
    const failing: AiProvider = {
      name: 'failing',
      models: async () => Promise.reject(new Error('No key.')),
      stream: () => ({
        [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('No network.')) }),
      }),
    };
    serveProvider(host, [provider([{ type: 'text', text: 'Hi' }]), failing]);
    expect(await collect(remoteProvider(page, 'claude').stream(request, new AbortController().signal))).toEqual([
      { type: 'text', text: 'Hi' },
      { type: 'end', reason: 'done' },
    ]);
    expect(await collect(remoteProvider(page, 'failing').stream(request, new AbortController().signal))).toEqual([{ type: 'error', message: 'No network.' }]);
    await expect(remoteProvider(page, 'failing').models()).rejects.toThrow('No key.');
  });

  it('answers only the messages of the page that it understands', async () => {
    const { page, host } = channels();
    const real = provider([{ type: 'end', reason: 'done' }]);
    serveProvider(host, [real]);
    const answers: unknown[] = [];
    page.onMessage((message) => answers.push(message));
    page.post({ type: 'ai.stream', request: 1, provider: 'claude', body: { ...request, context: { document: { name: 'a.md' } } } });
    page.post({ type: 'ai.stream', request: 2.5, provider: 'claude', body: request });
    page.post({ type: 'notes.hello' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(real.requests).toEqual([]);
    expect(answers).toEqual([]);
  });

  it('stops the answers that run when the service stops', async () => {
    const { page, host } = channels();
    const real = provider([{ type: 'text', text: 'Hi' }], { wait: true });
    const stop = serveProvider(host, [real]);
    const iterator = remoteProvider(page, 'claude').stream(request, new AbortController().signal)[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toEqual({ type: 'text', text: 'Hi' });
    stop();
    expect(real.signals[0].aborted).toBe(true);
  });

  it('ends a stream that is stopped before it starts, without a message', async () => {
    const { page, fromPage } = channels();
    const controller = new AbortController();
    controller.abort();
    expect(await collect(remoteProvider(page, 'claude').stream(request, controller.signal))).toEqual([{ type: 'end', reason: 'stopped' }]);
    expect(fromPage).toEqual([]);
  });
});
