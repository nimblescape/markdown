<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->


# Specification of the history

This document defines the history: the part that records every action on a
text document, saves it through a pluggable backend and replays it
([section 3](specification.md#3-architecture) of the specification), and the
history extension of VS Code, the base of all editing in VS Code. The
evaluation plugin of the history has a document of its own,
[evaluation.md](evaluation.md). It is part of the
[specification](specification.md) of nimblescape Markdown and normative in
the same way. [Section 6](#6-open-questions) lists its open questions.

## 1. Steps

### R-AI-004

**A history of every action.** The history must record every action on a
text document, in its order, as a saved history of undo and redo. It must
work for every text document, also for source code, and depend only on the
source. The history must stay after the file is closed.

### R-HIST-001

**Steps.** Each action is one step:

- an edit: typed text grouped as the undo of an editor groups it, for
  example a word or a pause; a command, for example a moved row;
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
user. An editor or an AI tool that uses the history reports its own edits; a
change by another program gets the origin "other program", and the user may
mark it as an edit of the AI.

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
IndexedDB); a server or a database.

### R-HIST-006

*(proposal)* **The first backends.** The first backend is a JSON Lines file,
`.nimblescape/history/<path of the file>.jsonl` in the repository of the
document, with one step per line and the change of each edit as a text
patch. A second backend keeps the history in the local store of the
platform. When the user goes back and then acts again, the later steps stay
as a branch.

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
([R-EVAL-019](evaluation.md#r-eval-019)). Its specification is
[evaluation.md](evaluation.md).

### R-HIST-008

**A history without the editor.** The history must have an API that reads
the steps of a history, with their texts, changes, times and origins, on
every platform, and the file form of a history must be readable without the
editor, so that a plugin can evaluate a history on its own, for example the
history that a student submits with an assignment.

## 5. The history extension of VS Code

### R-VSC-004

**The history extension.** The history extension of VS Code is the base of
all editing in VS Code: Markdown Notes and Markdown Paper build on it, as an
extension dependency, and record their actions through it. It must record
every change in the workspace through the stable API of VS Code, not only
the edits of a file: the edits and selections in every text editor and
notebook; files that are created, deleted or renamed, also by Git or by
programs outside VS Code; the settings; and the commands in the terminal,
where the shell integration of VS Code reports them. It shows the history
for any file and for the whole workspace.

An AI tool that reports its actions through hooks, for example Claude Code
or the agent of GitHub Copilot, gives its prompts, answers and edits with
the origin AI and the name of the tool. A change whose source VS Code does
not report, for example an accepted inline completion of Copilot or a change
by Git, gets the origin "other program", and the user may mark it as an
edit of the AI. *(proposal)* The history marks a change of unknown source as
"probably AI" when its form shows it, for example several lines inserted at
once at the cursor, and the user confirms it.

## 6. Open questions

1. Backends: which backend is the default ([R-HIST-002](#r-hist-002)): the
   file in the repository of the document, so that others such as
   supervisors see it through Git (proposal), or the local store on the
   computer of the author? Later steps kept as a branch (proposal) or
   dropped? The form of the file of [R-HIST-006](#r-hist-006) (proposal)?

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
