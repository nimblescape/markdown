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

### R-AI-006

*(proposal)* **Tracked changes.** The editor shows each proposed change as a
tracked change: the removed text struck through, the new text marked, with
"Accept" and "Reject".

## 2. Providers

### R-AI-002

**Pluggable AI.** A provider API must make any AI pluggable. A provider has
a name, its models, and one function that takes the messages, the context
and the tools and returns a stream of events: text, a proposed change, the
end, or an error. The integrating code registers the providers, and the user
picks one. The first and for now only provider is the Claude API, with
streaming and tool use.

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

1. Tracked changes: does the editor show proposed changes as tracked changes
   ([R-AI-006](#r-ai-006), proposal)?
2. Memory: the memory in the repository of the document (proposal) or for
   each user ([R-AI-003](#r-ai-003))? May the AI write the memory without
   asking (proposal: yes, with a setting that makes it ask)?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
