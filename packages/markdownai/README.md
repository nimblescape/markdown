<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# @nimblescape/markdownai

The AI of nimblescape Markdown without a view
([docs/ai.md](../../docs/ai.md)). The package runs in the page, in the
extension host of VS Code and on a server. It has no provider of its own AI.

A provider makes an AI pluggable
([R-AI-002](../../docs/ai.md#r-ai-002)): it has a name, its models, and one
function that takes a request with the messages, the context of the
document and the tools, and returns the events of the answer. `runChat`
runs one answer of a chat: it asks the provider, gives each change that the
AI proposes with the tool `propose_change` to the editor, runs the other
tools, and asks again until the AI finishes. The editor shows each proposed
change as a tracked change ([R-AI-006](../../docs/ai.md#r-ai-006)).

```ts
import { runChat, type AiMessage } from '@nimblescape/markdownai';

const messages: AiMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'Shorten the first paragraph.' }] }];
for await (const event of runChat({
  provider,
  model: 'a-model',
  messages,
  context: () => ({ document: { name: 'paper.md', text: source.text } }),
  propose: (change) => editor.proposeChange({ ...change, origin: { kind: 'ai', name: provider.name } }),
})) {
  if (event.type === 'text') {
    show(event.text);
  } else if (event.type === 'message') {
    messages.push(event.message);
  }
}
```

The API key must never reach the page
([R-AI-005](../../docs/ai.md#r-ai-005)). The page uses a provider of the
other side of a channel of messages, for example the channel of a plugin,
and the other side answers with the real provider:

```ts
import { remoteProvider, serveProvider } from '@nimblescape/markdownai';

const provider = remoteProvider(channel, 'claude'); // in the page
const stop = serveProvider(channel, [claude]); // in the extension host
```

The package is not on npmjs.com before the release.
[CONTRIBUTING.md](../../CONTRIBUTING.md) explains how another repository
installs it from GitHub.

## License

[MIT](LICENSE) © 2026 Hannes Stauss (scalarion@nimblescape.com)
