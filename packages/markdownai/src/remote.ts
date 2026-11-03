// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// A provider in another process (docs/ai.md, R-AI-005): the API key must never reach the page, so the provider runs in
// the extension host of VS Code or on the server of a page, and the page uses it through a channel of messages, for
// example the channel of a plugin (docs/plugins.md, R-PLUGIN-001). remoteProvider is the provider in the page, which
// sends each request through the channel; serveProvider answers the requests on the other side with the real provider.
// The messages are JSON values whose types start with `ai.`, so that the channel may carry other messages too. Each
// side checks the messages of the other side.

import type { AiEvent, AiModel, AiProvider, AiRequest } from './provider';

/** AiChannel is a channel of messages to the other process, as the channel of a plugin. */
export interface AiChannel {
  post(message: unknown): unknown;
  /** onMessage adds a listener of the messages from the other side and returns the function that removes it. */
  onMessage(listener: (message: unknown) => void): () => void;
}

/** PageMessage is a message of the page: a request for the models, for an answer, or the stop of an answer. */
type PageMessage =
  | { readonly type: 'ai.models'; readonly request: number; readonly provider: string }
  | { readonly type: 'ai.stream'; readonly request: number; readonly provider: string; readonly body: AiRequest }
  | { readonly type: 'ai.stop'; readonly request: number };

/** HostMessage is a message of the other side: the models, or an event of an answer. */
type HostMessage =
  | { readonly type: 'ai.models'; readonly request: number; readonly models?: readonly AiModel[]; readonly error?: string }
  | { readonly type: 'ai.event'; readonly request: number; readonly event: AiEvent };

/** isObject returns true for an object that is no array. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** isRequestId returns true for the ID of a request. */
function isRequestId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

/**
 * pageMessage returns a message of the page, or undefined for another value.
 * @param value - The message.
 */
function pageMessage(value: unknown): PageMessage | undefined {
  if (!isObject(value) || !isRequestId(value.request)) {
    return undefined;
  }
  if (value.type === 'ai.stop') {
    return { type: 'ai.stop', request: value.request };
  }
  if (typeof value.provider !== 'string') {
    return undefined;
  }
  if (value.type === 'ai.models') {
    return { type: 'ai.models', request: value.request, provider: value.provider };
  }
  const body = value.body;
  if (value.type !== 'ai.stream' || !isObject(body) || typeof body.model !== 'string' || !Array.isArray(body.messages) || !Array.isArray(body.tools)) {
    return undefined;
  }
  const context = body.context;
  if (!isObject(context) || !isObject(context.document) || typeof context.document.name !== 'string' || typeof context.document.text !== 'string') {
    return undefined;
  }
  if (!body.messages.every((message) => isObject(message) && (message.role === 'user' || message.role === 'assistant') && Array.isArray(message.content))) {
    return undefined;
  }
  return { type: 'ai.stream', request: value.request, provider: value.provider, body: body as unknown as AiRequest };
}

/** eventTypes are the types of the events of an answer. */
const eventTypes = new Set(['text', 'toolCall', 'end', 'error']);

/**
 * hostMessage returns a message of the other side, or undefined for another value.
 * @param value - The message.
 */
function hostMessage(value: unknown): HostMessage | undefined {
  if (!isObject(value) || !isRequestId(value.request)) {
    return undefined;
  }
  if (value.type === 'ai.models') {
    const models = Array.isArray(value.models) ? value.models.filter((model): model is AiModel => isObject(model) && typeof model.id === 'string' && typeof model.name === 'string') : undefined;
    return { type: 'ai.models', request: value.request, models, error: typeof value.error === 'string' ? value.error : undefined };
  }
  if (value.type === 'ai.event' && isObject(value.event) && eventTypes.has(value.event.type as string)) {
    return { type: 'ai.event', request: value.request, event: value.event as unknown as AiEvent };
  }
  return undefined;
}

/** lastRequest is the ID of the last request of the page; the IDs of all remote providers of the page differ. */
let lastRequest = 0;

/**
 * remoteProvider returns the provider of a name that runs on the other side of a channel.
 * @param channel - The channel.
 * @param name - The name of the provider.
 */
export function remoteProvider(channel: AiChannel, name: string): AiProvider {
  return {
    name,
    models: () =>
      new Promise((resolve, reject) => {
        const request = ++lastRequest;
        const stop = channel.onMessage((value) => {
          const message = hostMessage(value);
          if (message?.type === 'ai.models' && message.request === request) {
            stop();
            if (message.models) {
              resolve(message.models);
            } else {
              reject(new Error(message.error ?? `The provider ${name} gave no models.`));
            }
          }
        });
        channel.post({ type: 'ai.models', request, provider: name });
      }),
    stream: (request: AiRequest, signal: AbortSignal): AsyncIterable<AiEvent> => ({
      async *[Symbol.asyncIterator]() {
        if (signal.aborted) {
          yield { type: 'end', reason: 'stopped' };
          return;
        }
        const id = ++lastRequest;
        const queue: AiEvent[] = [];
        let wake: (() => void) | undefined;
        const push = (event: AiEvent) => {
          queue.push(event);
          wake?.();
        };
        const stop = channel.onMessage((value) => {
          const message = hostMessage(value);
          if (message?.type === 'ai.event' && message.request === id) {
            push(message.event);
          }
        });
        // A stop ends the answer at once, also when the other side does not answer any more.
        const onAbort = () => {
          channel.post({ type: 'ai.stop', request: id });
          push({ type: 'end', reason: 'stopped' });
        };
        signal.addEventListener('abort', onAbort, { once: true });
        try {
          channel.post({ type: 'ai.stream', request: id, provider: name, body: request });
          for (;;) {
            while (queue.length === 0) {
              await new Promise<void>((resolve) => (wake = resolve));
            }
            const event = queue.shift() as AiEvent;
            yield event;
            if (event.type === 'end' || event.type === 'error') {
              return;
            }
          }
        } finally {
          stop();
          signal.removeEventListener('abort', onAbort);
        }
      },
    }),
  };
}

/**
 * serveProvider answers the requests of the page on a channel with the providers of this side.
 * @param channel - The channel.
 * @param providers - The providers, by their names.
 * @returns The function that stops the service and the answers that run.
 */
export function serveProvider(channel: AiChannel, providers: readonly AiProvider[]): () => void {
  const running = new Map<number, AbortController>();
  const post = (message: HostMessage) => channel.post(message);
  const stop = channel.onMessage((value) => {
    const message = pageMessage(value);
    if (!message) {
      return;
    }
    const { request } = message;
    if (message.type === 'ai.stop') {
      running.get(request)?.abort();
      return;
    }
    const provider = providers.find((one) => one.name === message.provider);
    if (message.type === 'ai.models') {
      if (!provider) {
        post({ type: 'ai.models', request, error: `There is no provider ${message.provider}.` });
      } else {
        provider.models().then(
          (models) => post({ type: 'ai.models', request, models: models.map(({ id, name }) => ({ id, name })) }),
          (error: unknown) => post({ type: 'ai.models', request, error: error instanceof Error ? error.message : String(error) }),
        );
      }
      return;
    }
    if (!provider) {
      post({ type: 'ai.event', request, event: { type: 'error', message: `There is no provider ${message.provider}.` } });
      return;
    }
    const controller = new AbortController();
    running.set(request, controller);
    void (async () => {
      let ended = false;
      try {
        for await (const event of provider.stream(message.body, controller.signal)) {
          post({ type: 'ai.event', request, event });
          if (event.type === 'end' || event.type === 'error') {
            ended = true;
            break;
          }
        }
      } catch (error) {
        ended = true;
        post({ type: 'ai.event', request, event: { type: 'error', message: error instanceof Error ? error.message : String(error) } });
      } finally {
        running.delete(request);
      }
      // The page waits for the end of each answer.
      if (!ended) {
        post({ type: 'ai.event', request, event: { type: 'end', reason: controller.signal.aborted ? 'stopped' : 'done' } });
      }
    })();
  });
  return () => {
    stop();
    running.forEach((controller) => controller.abort());
    running.clear();
  };
}
