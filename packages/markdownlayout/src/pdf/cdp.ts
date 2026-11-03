// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// A connection to a browser without a window over the Chrome DevTools Protocol through two pipes (docs/rendering.md,
// R-LAYOUT-002): the browser starts with `--remote-debugging-pipe`, reads the messages of the program from its file
// descriptor 3 and writes its own to the file descriptor 4, each a JSON text that ends with a zero byte. The pipes
// need no network port and no package such as Puppeteer, which would download its own Chromium. The same code is in
// nimblescape Markdown Paper. The module runs in Node.js.

import { type ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Readable, Writable } from 'node:stream';

/** Message is a message of the protocol. */
interface Message {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  sessionId?: string;
  result?: Record<string, unknown>;
  error?: { message: string };
}

/** Browser is a running browser without a window. */
export class Browser {
  private nextId = 1;
  private readonly pending = new Map<number, { resolve(result: Record<string, unknown>): void; reject(error: Error): void }>();
  private readonly listeners = new Set<(message: Message) => void>();
  private buffer = '';
  private closed = false;
  private errorOutput = '';

  private constructor(
    private readonly process: ChildProcess,
    private readonly input: Writable,
    output: Readable,
    private readonly profile: string,
  ) {
    output.setEncoding('utf8');
    output.on('data', (chunk: string) => this.receive(chunk));
    process.stderr?.setEncoding('utf8');
    process.stderr?.on('data', (chunk: string) => {
      this.errorOutput = (this.errorOutput + chunk).slice(-4000);
    });
    process.on('exit', () => {
      this.closed = true;
      for (const { reject } of this.pending.values()) {
        reject(new Error(`The browser stopped. ${this.errorOutput.trim()}`.trim()));
      }
      this.pending.clear();
    });
  }

  /**
   * launch starts a browser without a window, with a new empty profile in the temporary folder.
   * @param program - The path of the program of the browser.
   */
  static async launch(program: string): Promise<Browser> {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nimblescape-browser-'));
    const args = [
      '--headless=new',
      '--remote-debugging-pipe',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
      // A local page may load the images and the style sheets of its folder.
      '--allow-file-access-from-files',
      // The sandbox of Chromium does not start for the user root, for example in a container.
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      'about:blank',
    ];
    const child = spawn(program, args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], windowsHide: true });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', (error) => reject(new Error(`The browser ${program} did not start: ${error.message}`)));
    });
    const input = child.stdio[3] as Writable;
    const output = child.stdio[4] as Readable;
    return new Browser(child, input, output, profile);
  }

  /**
   * receive reads the messages of the browser from its output.
   * @param chunk - The next part of the output.
   */
  private receive(chunk: string): void {
    this.buffer += chunk;
    let end = this.buffer.indexOf('\0');
    while (end >= 0) {
      const text = this.buffer.slice(0, end);
      this.buffer = this.buffer.slice(end + 1);
      end = this.buffer.indexOf('\0');
      let message: Message;
      try {
        message = JSON.parse(text) as Message;
      } catch {
        continue;
      }
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          pending?.reject(new Error(message.error.message));
        } else {
          pending?.resolve(message.result ?? {});
        }
      } else {
        for (const listener of this.listeners) {
          listener(message);
        }
      }
    }
  }

  /**
   * send sends a command and returns its result.
   * @param method - The method, for example Page.navigate.
   * @param params - The parameters.
   * @param sessionId - The session of a page, or undefined for the browser.
   */
  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
    if (this.closed) {
      return Promise.reject(new Error('The browser is closed.'));
    }
    const id = this.nextId++;
    const result = new Promise<Record<string, unknown>>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.input.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
    return result;
  }

  /**
   * once waits for the next event of a method in a session.
   * @param method - The method of the event, for example Page.loadEventFired.
   * @param sessionId - The session.
   */
  once(method: string, sessionId?: string): Promise<Record<string, unknown>> {
    return new Promise((resolve) => {
      const listener = (message: Message): void => {
        if (message.method === method && (!sessionId || message.sessionId === sessionId)) {
          this.listeners.delete(listener);
          resolve(message.params ?? {});
        }
      };
      this.listeners.add(listener);
    });
  }

  /**
   * on calls a function for each event of a method, until the returned function is called.
   * @param method - The method of the event.
   * @param listener - The function.
   */
  on(method: string, listener: (params: Record<string, unknown>) => void): () => void {
    const wrapped = (message: Message): void => {
      if (message.method === method) {
        listener(message.params ?? {});
      }
    };
    this.listeners.add(wrapped);
    return () => this.listeners.delete(wrapped);
  }

  /** close ends the browser and removes its profile. */
  async close(): Promise<void> {
    if (!this.closed) {
      const exited = new Promise<void>((resolve) => this.process.once('exit', () => resolve()));
      this.send('Browser.close').catch(() => undefined);
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
      await Promise.race([exited, timeout]);
      if (!this.closed) {
        this.process.kill();
      }
    }
    fs.rmSync(this.profile, { recursive: true, force: true, maxRetries: 3 });
  }
}
