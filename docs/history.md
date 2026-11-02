<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the history

This document defines the history: a product of its own beside nimblescape
Markdown ([R-ARCH-003](specification.md#r-arch-003)) that records every
action on any file, saves it through a pluggable backend and replays it, and
the history extension of VS Code, the base of all editing in VS Code. The
evaluation plugin of the history has a document of its own,
[evaluation.md](evaluation.md). Until the history has a repository of its
own, this document stays with the [specification](specification.md) of
nimblescape Markdown and is normative in the same way.
[Section 6](#6-open-questions) lists its open questions.

## 1. Steps

### R-AI-004

**A history of every action.** The history must record every action on a
file, in its order, as a saved history of undo and redo. It must work for
every file, not only for Markdown: text documents, source code, notebooks
and other files. It must not depend on nimblescape Markdown. The history
must stay after the file is closed.

### R-HIST-001

**Steps.** Each action is one step:

- an edit of a file: typed text grouped as the undo of an editor groups it,
  for example a word or a pause; a command, for example a moved row; a
  change of the file by another program;
- a selection: the selected text; a move of the cursor without selected text
  is no step;
- a question to the AI: the prompt, the selection and the context that the
  AI got, the provider and the model;
- an answer of the AI: its text and the changes that it proposes;
- a change of the workspace: a file created, deleted or renamed, a setting,
  or a command in the terminal;
- the decision of the user on a proposed change: accepted or rejected.

Each step must record its time, its author and its origin: user, AI or other
program. A change of the user to text that the AI wrote is an edit of the
user. An editor or an AI tool that uses the history reports its own edits
through the API of the history ([R-HIST-010](#r-hist-010)); a change by
another program gets the origin "other program", and the user may mark it as
an edit of the AI.

### R-HIST-010

**The API for actions.** The history must have an API through which an
editor, an extension or a tool reports its actions with their origin, for
example the source of nimblescape Markdown, Markdown Notes, Markdown Paper,
or an AI tool through its hooks. The history must record by itself every
action that the platform shows and that no one reports, for example a
change of a file on disk ([R-VSC-004](#r-vsc-004)), so that no change of a
file is missing from the history.

### R-HIST-011

**AI agents in cloud sessions.** The history should also record the changes
of AI agents that work in cloud sessions, for example Claude Code on the
web, the cloud agent of GitHub Copilot and OpenAI Codex, and this should
need only configuration in the repository. *(proposal)* Each such agent
delivers its changes through Git, so the history records each commit that
reaches the repository as a step, with the origin AI and the name of the
agent when the commit or its pull request shows them: by its author, by its
trailers, for example `Co-Authored-By` and a link to the session, or by its
branch. This needs no configuration. For the details, hooks in the
repository record the prompts, answers and tool calls of the session into
the history file of the repository ([R-HIST-006](#r-hist-006)), and a hook
at the end of each turn adds this file to the next commit, so that the
details travel with the commits of the agent. The repository holds these
hooks and the script that they run: `.claude/settings.json` for Claude Code,
which the Copilot CLI also reads, `.github/hooks/*.json` for Copilot, and
`.codex/hooks.json` for Codex where it runs hooks. Claude Code runs the
hooks of `.claude/settings.json` in a cloud session with one repository
outside a project, but not in a thread of a project or in a session with
several repositories; there only the commits record the session. The other
way is an HTTP hook that sends each step to a server backend of the history
([R-HIST-002](#r-hist-002)). It stays an option, because it needs settings
outside the repository: an allowed host in the network settings of the cloud
environment and a token as a secret of that environment.

## 2. Storage

### R-HIST-002

**Storage backends.** The history must save its steps through a storage
backend, and the backends must be pluggable. A backend stores the log of the
steps of a document and has one small interface: append steps, read the
steps from a given step on, and list and delete the histories that it holds.
Every backend must store the same steps in the same form, so that a history
can move from one backend to another. The integrating code chooses the
backend for each document, and a setting of the user may choose it. A
backend uses the platform adapter for files and storage, and no platform API
directly. Examples: a file in the repository of the document, which Git
keeps and shares, for example with a supervisor; a local store on the
computer of the user (in VS Code the storage of the extension, on the web
IndexedDB); a server backend: a program on a server that receives the steps
over HTTP and stores them, for example in a database.

### R-HIST-006

*(proposal)* **The first backends.** The first backend is a JSON Lines file,
`.workhistory/<path of the file>.jsonl` in the repository of the document
([R-GEN-007](specification.md#r-gen-007)), with one step per line and the
change of each edit as a text patch. A second backend keeps the history in
the local store of the platform. When the user goes back and then acts
again, the later steps stay as a branch.

## 3. Back, forward and replay

### R-HIST-003

**Back and forward.** The user must be able to move back and forward through
the steps. The text and the selection follow, as with undo and redo, and
each position shows the document as it was after that step and the action of
that step: the selection marked, the question and the answer beside the
text, the changes of an edit marked. The history must tell the steps of the
user and the steps of the AI apart, and a view mode must mark the text by
its origin.

### R-HIST-004

**Replay.** Replay must play the steps from the start or from a chosen step,
one after the other. It applies the recorded results and does not ask the AI
again. "Run again" sends a recorded question to the AI as a new question.

## 4. Use of the history

### R-HIST-005

**The prompt protocol of Paper.** Markdown Paper uses the history for the
prompt protocol of a paper; `mp build` may add the history, or a list of the
questions to the AI, with the evaluation and the declaration of the use of
AI of the evaluation plugin ([R-EVAL-009](evaluation.md#r-eval-009)), as an
appendix of the PDF.

### R-HIST-007

**Plugins of the history.** Plugins of the history read the steps through
the API of the history and may add data of their own to a step, for example
a class and its reason. The evaluation plugin is such a plugin: it
classifies each step as original work or as routine work, gives each part of
a step a role (direct, produce or judge), shows the result in views, and
gives feedback on work and learning, also for student assignments and for
source code. Its methods rest on published scientific work
([R-EVAL-019](evaluation.md#r-eval-019)). It is one product with the
history, and the history extension of VS Code holds it
([R-EVAL-017](evaluation.md#r-eval-017)); its specification is
[evaluation.md](evaluation.md).

### R-HIST-008

**A history without the editor.** The history must have an API that reads
the steps of a history, with their texts, changes, times and origins, on
every platform, and the file form of a history must be readable without the
editor, so that a plugin can evaluate a history on its own, for example the
history that a student submits with an assignment.

## 5. The history extension of VS Code

### R-VSC-004

**The history extension.** The history extension of VS Code is an extension
of its own ([R-ARCH-003](specification.md#r-arch-003)) and the base of all
editing in VS Code: Markdown Notes and Markdown Paper build on it, as an
extension dependency, and record their actions through it. It serves every
file of the workspace, not only Markdown. It must record every change in the
workspace through the stable API of VS Code: every edit of any file, in a
text editor, in a notebook, or on disk by Git or by a program outside VS
Code; every creation, deletion and rename of a file, also by Git or by a
program outside VS Code; the selections in every text editor; the settings;
and the commands in the terminal, where the shell integration of VS Code
reports them. It shows the history for any file and for the whole workspace.
It also holds the evaluation plugin and shows its views
([R-EVAL-017](evaluation.md#r-eval-017)).

An AI tool that reports its actions through hooks gives its prompts, answers
and edits with the origin AI and the name of the tool, for example Claude
Code, the agent of GitHub Copilot in VS Code and the Copilot CLI, which
share one format of hooks. A change whose source VS Code does not report,
for example an accepted inline completion of Copilot or a change by Git,
gets the origin "other program", unless a commit shows its AI agent
([R-HIST-011](#r-hist-011)), and the user may mark it as an edit of the AI.
*(proposal)* When the user switches it on, the history extension also
receives the OpenTelemetry data of AI tools on a local port, for example the
agent runs of Copilot Chat and the events of Claude Code, with the prompts,
the answers and the tool calls. It gives a change of a file the origin AI
and the name of the tool when a tool call of that tool at the same time
names that file. It marks a change of unknown source as "probably AI" when
its form shows it, for example several lines inserted at once at the cursor,
and the user confirms it.

## 6. Open questions

1. Backends: which backend is the default ([R-HIST-002](#r-hist-002)): the
   file in the repository of the document, so that others such as
   supervisors see it through Git (proposal), or the local store on the
   computer of the author? Later steps kept as a branch (proposal) or
   dropped? The form of the file of [R-HIST-006](#r-hist-006) (proposal)?
2. Files that are not text: does the history keep the content of each
   version, or only its hash and its size (proposal)?
3. AI tools: the OpenTelemetry data of AI tools, the match of tool calls
   with the changes of files, and the mark "probably AI"
   ([R-VSC-004](#r-vsc-004), proposal)?
4. Cloud sessions: commits as steps with the origin from the commit, and
   hooks in the repository that write the details into the history file of
   the repository, which goes with the next commit
   ([R-HIST-011](#r-hist-011), proposal)? Does each agent commit this file
   reliably? This needs a test with each agent. How does the history get the
   details of a thread of a project of Claude Code, where the hooks of the
   repository do not run?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
