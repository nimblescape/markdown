<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the AI

This document defines the AI: the chats with an AI and its proposed changes,
the pluggable providers, the API key and the memory. The AI is one more
editor of a file, which proposes changes of the text
([R-EDIT-002](editor.md#r-edit-002)). It is part of the
[specification](specification.md) of nimblescape Markdown and normative in
the same way. [Section 4](#4-open-questions) lists its open questions.

## 1. AI chats

### R-AI-001

**AI chats are notes.** The AI chat must work as Claude Code does: it knows
the document, the selection, the front matter with its schema, and the
format rules of the active plugins, and it proposes changes that the user
accepts or rejects. Nothing changes the file before the user accepts it, and
each accepted change is one step of undo with the origin "AI". An AI chat is
a thread of a note of Markdown Notes: the AI answers in the thread as one
more author. Notes integrates the chat; the libraries have no chat of their
own.

*(proposal)* The editor gives this context with `aiContext`: the text of the
file, the selection as places in the text, the schema of the front matter,
and the format rules of the plugins, which each plugin gives in its member
`formatRules` ([R-PLUGIN-001](plugins.md#r-plugin-001)).

### R-AI-006

*(proposal)* **Tracked changes.** The editor shows each proposed change as a
tracked change: the removed text struck through, the new text marked, with
"Accept" and "Reject".

*(proposal)* These are the details.

- A proposed change is `{ id, from, to, text, origin? }`: the range of the
  text of the file that it replaces, as the source counts the text, the new
  Markdown text, and who proposes it, the AI when it has no origin. The
  integrating code gives it to `proposeChange` of the editor, and a plugin
  to `proposeChange` of the API of the editor for the plugins
  ([R-PLUGIN-001](plugins.md#r-plugin-001)). The result says how the
  proposal ended: `accepted`, `rejected` or `outdated`.
- A change inside the text of one paragraph or heading, with no line break
  in its new text, shows in the line: the removed text struck through in
  red, the new text with a green background after it, then the buttons. A
  place right after the marks that open a mark, for example after `**`, is
  a place of the text too. Every other change shows the blocks that it
  touches struck through and their new blocks below them, rendered; a change
  between two blocks shows only the new blocks.
- "Accept" applies the change to the text as one step of undo. The change
  goes to the source with the origin of the proposal
  ([R-SRC-001](source.md#r-src-001)), and it may change generated parts
  ([R-EDIT-011](editor.md#r-edit-011)), as a change from outside does.
  "Reject" removes the proposal and leaves the text.
- A change of the user or from outside in the blocks of a proposal makes the
  proposal outdated: it goes away. So does a new text of the editor, a new
  proposal with the same ID, and the closing of the editor. A change in
  other blocks keeps the proposal.
- In read-only mode, the editor shows the proposals without the buttons, and
  nothing accepts a change.

## 2. Providers

### R-AI-002

**Pluggable AI.** A provider API must make any AI pluggable. A provider has
a name, its models, and one function that takes the messages, the context
and the tools and returns a stream of events: text, a proposed change, the
end, or an error. The integrating code registers the providers, and the user
picks one. The first and for now only provider is the Claude API, with
streaming and tool use.

*(proposal)* These are the details, in the package
`@nimblescape/markdownai` ([R-ARCH-002](specification.md#r-arch-002)).

- A provider is `{ name, models(), stream(request, signal) }`. A request has
  the ID of the model, the instructions of the integrating code, the
  messages, the context and the tools. A message of the user or of the AI
  holds text, calls of tools by the AI and the results of the calls. The
  stream gives parts of the text of the answer, the calls of tools, and the
  end with its reason (`done`, `toolCalls`, `length`, `refusal`,
  `stopped`), or an error. A provider gives a failure as an event of the
  stream.
- The context is the name and the text of the file, the selection, the JSON
  schema of the front matter and the format rules of the active plugins
  ([R-AI-001](#r-ai-001)). Every provider gives the AI the instructions with
  the context in the same text: the document in a fenced code block, the
  selected text or the line of the cursor, the schema and the rules.
- The AI proposes a change with the tool `propose_change`, as the tool to
  edit a file of Claude Code: it gives a part of the text that occurs once
  in the document and its new text, not the places in the text. The chat
  finds the range of that part in the text of the file, with the line
  breaks of the file, and keeps only the words that change, so that a
  change of some words shows in the line ([R-AI-006](#r-ai-006)). A part
  that does not occur, or occurs more than once, is an error for the AI,
  which then tries again.
- The loop of a chat asks the provider, gives each proposed change to the
  editor and waits for its result, runs the other tools of the integrating
  code, for example the memory ([R-AI-003](#r-ai-003)), and asks again with
  the results, until the AI finishes, at most 20 requests for one answer.
  Each request has the context as it is then, so that the AI knows the text
  after an accepted change. The result of `propose_change` says the AI
  whether the user accepted or rejected the change. A stop of the user ends
  the answer; each call of the answer still gets a result, so that the chat
  can go on.
- The loop runs where the editor is. A provider in another process is a
  remote provider: the page sends each request through a channel of
  messages, for example the channel of a plugin
  ([R-PLUGIN-001](plugins.md#r-plugin-001)), and the other side answers
  with the real provider ([R-AI-005](#r-ai-005)). Each side checks the
  messages of the other side.

### R-AI-005

**The key stays off the page.** The API key must never reach the page. In VS
Code, the extension host makes the call with the key from the secret storage
of VS Code. On the web, the page calls its own server.

## 3. Memory

### R-AI-003

**Memory.** The AI must use a memory, so that a decision in a chat has the
context of the other decisions and chats. *(proposal)* The memory is a
folder of the repository of the document, `.markdownnotes/memory/`, with one
Markdown file for each subject, read and written through the memory tool of
the Claude API; a second tool searches the other notes and chats.

## 4. Open questions

1. Tracked changes: does the editor show proposed changes as tracked changes,
   with the details of [R-AI-006](#r-ai-006) (proposal)?
2. Providers: the details of the provider API, the tool `propose_change`
   and the loop of a chat ([R-AI-002](#r-ai-002), proposal)?
3. Memory: the memory in the repository of the document (proposal) or for
   each user ([R-AI-003](#r-ai-003))? May the AI write the memory without
   asking (proposal: yes, with a setting that makes it ask)?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
