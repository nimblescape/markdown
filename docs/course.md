<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Specification of the course module

This document defines the course module, a product of its own beside
nimblescape Markdown and the history
([R-ARCH-004](specification.md#r-arch-004)). The course module defines the
form of the files of a course in a repository: its README files and its
feedback files. With this form, people, AI agents and programs read and
write these files in the same way. It is normative in the same way as the
[specification](specification.md): "must" marks a requirement, "should" a
recommendation, and "may" an option; a requirement marked *(proposal)* is
not decided yet, and [section 7](#7-open-questions) lists these open
questions. Each requirement has an ID as its heading. Until it moves to
the repository `nimblescape/course-vscode`, this document stays in this
repository.

## 1. Scope

### R-COURSE-001

**A course in a repository.** The course module must define the form of the
files of a course in a Git repository: the README of the course, the README
of each chapter with its learning objectives, the README of each assignment
with its requirements, and the feedback file of each assignment. The README
files must be readable as structured data ([R-COURSE-009](#r-course-009)),
and each file must tell an AI agent where its rules are
([R-COURSE-004](#r-course-004), [R-COURSE-005](#r-course-005)). The module
knows no programming language: a course may teach TypeScript, HTML and CSS,
or another subject. The checks of the work of a student in a language belong
to the feedback program ([R-FEED-004](#r-feed-004)).

### R-COURSE-002

**Product, names and folders.** The course module is a product of its own,
in the same form as the nimblescape extensions with an npm package
([R-GEN-007](specification.md#r-gen-007)): the repository
`nimblescape/course-vscode` ([R-ARCH-005](specification.md#r-arch-005)), a
VS Code extension, and the folder `.course/` for the files that it keeps in
the repository of a course. *(proposal)* The npm package is
`@nimblescape/course`, its command is `course`, and the comment of the
format names the format `nimblescape-course`.

### R-COURSE-003

**The course, the history and the reflection tool.** The history extension
records the work of the student in every file of an assignment, as in any
workspace, without a report of the course extension
([R-VSC-004](history.md#r-vsc-004)). The course module is the adapter of a
course for the reflection tool ([R-REFL-021](reflection.md#r-refl-021)): it
gives the reflection tool the context of each assignment from the README
files ([R-COURSE-011](#r-course-011)). The history and the reflection tool
know no course, and the course module uses no method of the reflection tool.

## 2. Terms

- *Course:* a repository with chapters and assignments, for example
  `majikmate/module-ts-2`.
- *Chapter:* a learning step of a course, with its tutorials and its
  learning objectives.
- *Assignment:* a task of a chapter, with its README and its workspace, the
  folder of the work of the student.
- *Learning objective:* what a student can do after a chapter, with the
  level that it aims at on the six levels of the revised taxonomy of Bloom
  (Krathwohl, 2002).
- *Requirement:* a fact about the work of an assignment that a check or a
  reader can confirm, an item of the checklist of its README.
- *Feedback:* the file `FEEDBACK.md` next to the README of an assignment,
  which a feedback program writes after a push.

## 3. The comment of the format and the instructions

### R-COURSE-004

**Comment of the format.** Each README of a course and each feedback file
must hold a comment that names the format, like a DOCTYPE, in the same form
as the comment of the format of Markdown Notes
([R-NOTE-007](https://github.com/nimblescape/markdownnotes-vscode/blob/main/docs/requirements.md#r-note-007)):

- *(proposal)* The first line names the format, its version, the kind of
  the file and the address of the specification:
  `<!-- nimblescape-course v1.0.0 assignment spec=https://github.com/nimblescape/course-vscode/blob/main/docs/format.md`.
  The kind is `course`, `chapter`, `assignment` or `feedback`.
- Short lines of words follow, which tell an AI agent to print the rules of
  the kind of the file with `npx -y @nimblescape/course instructions <kind>`
  ([R-COURSE-005](#r-course-005)) before it reads, changes or writes the
  file. The last line is `-->`. GitHub and the Markdown preview do not show
  the comment.
- The comment is the first block of the file, with a blank line after it.
  The README files of a course have no front matter, because GitHub shows a
  front matter as a table.
- The version is a semantic version, with the rules of the version of the
  comment of Markdown Notes: a program writes a comment anew only when its
  own version is higher, and a program that finds a higher major version
  changes nothing in the file and says why.

### R-COURSE-005

**Instructions for AI agents.** `course instructions [topic]` must print the
rules of a topic as Markdown; without a topic, it prints the list of the
topics, in the same way as `mp instructions` of Markdown Paper
([R-CLI-003](https://github.com/nimblescape/markdownpaper-vscode/blob/main/docs/requirements.md#r-cli-003)).
The topics are `course`, `chapter`, `assignment`, `objectives` (the six
levels of the revised taxonomy with their verbs) and `feedback`. The
documents in `docs/` of the repository are the source of the instructions.
*(proposal)* These instructions replace the copies of the forms in each
course, today `.github/instructions/objectives.md`,
`.github/instructions/assignment-readme.md` and
`.github/instructions/taxonomiestufen-bloom.md` of `majikmate/module-ts-2`.
A course keeps only its own rules in its repository: its students, its
language, its conventions and the topics of its chapters. The `AGENTS.md` of
a course names the commands of the instructions.

## 4. The files of a course

### R-COURSE-006

**Sections by role.** Each kind of file has sections with fixed roles. The
name of a section is in the language of the course, and the module keeps the
names of each role for each language, for example "Anforderungen" in German
and "Requirements" in English for the role "requirements". *(proposal)* The
file `.course/course.yml` names the course and its language, for example
`course: ts-2` and `language: de`.

### R-COURSE-007

**The README of a chapter.** The README of a chapter has the sections topic
overview, learning objectives, tutorials, related assignments and
walkthrough. The section of the learning objectives is a table with the
columns number, learning objective, description and level:

- *(proposal)* The number is the full number of the objective,
  `<chapter>.<n>`, for example `08.3`. It is the ID of the objective in the
  whole course.
- *(proposal)* The level is `K<n> – <name>`, with the six levels of the
  revised taxonomy (Krathwohl, 2002): K1 Remember, K2 Understand, K3 Apply,
  K4 Analyze (Analyse in a course in British English), K5 Evaluate, K6
  Create; in German Erinnern, Verstehen, Anwenden, Analysieren, Bewerten,
  Erschaffen. A program reads the level
  only from its number; the name is for people.
- The description says how the objective shows in the work of the student.

### R-COURSE-008

**The README of an assignment.** The README of an assignment starts with its
title in bold, the scenario and a link to its chapter, and it has the
sections learning objectives, example run (or expected output), requirements,
rules and criteria:

- *(proposal)* Each item of the learning objectives names one objective of
  its own chapter or of an earlier chapter, at most once, with a link to the
  table of the chapter, the level from the table, and the concrete form of
  the objective in this assignment:
  `- [08.3](../../../10-course/10-tutorials/08-loops/README.md#lernziele-taxonomie-nach-bloom) (K3 – Anwenden): Eine Aufgabe mit einer for-Loop eine feste Anzahl von Malen wiederholen`.
- The requirements are a checklist (`- [ ] …`); a program numbers them R1 to
  Rn in their order. A larger assignment groups its requirements under
  headings of the third level inside the section of the requirements, for
  example "Teil A" and "Teil B".
- *(proposal)* A requirement or a rule names the objectives that it serves
  at the end of its first paragraph: `(Lernziel 08.3)` or
  `(Lernziele 05.4, 06.4)`, in English `(objective 08.3)` or
  `(objectives 05.4, 06.4)`, sorted, and only with numbers of the learning
  objectives of the assignment. An item that serves no objective has no
  such mark.
- The criteria are items `- **<name>:** <text>`; a program numbers them C1
  to Cm in their order.

## 5. Reading, checks and the reflection tool

### R-COURSE-009

**Structured reading.** The package must read a course into JSON, the same
on every platform: the course with its name and language; each chapter with
its number, title and learning objectives (number, text, description,
level); each assignment with its number, folder, title, chapter, learning
objectives, requirements (R1 to Rn, with their group, text and objectives),
rules (with their objectives), criteria (C1 to Cm), example run and the
files of its workspace; and the feedback of each assignment
([R-FEED-002](#r-feed-002)). The feedback program, the adapter of the
reflection tool and the course extension read the files of a course only
through this reader, so that no program reads a README by rules of its own.
*(proposal)* The functions are `readCourse(folder)`,
`readAssignment(folder)` and `readFeedback(file)`.

### R-COURSE-010

**Checks.** `course check [folder]` must report each place where a file of a
course differs from its form: a missing section, a requirement that is no
item of the checklist, an objective of an assignment that no chapter table
has, a level outside K1 to K6, or a missing comment of the format. The
course extension shows the same checks as warnings in the text editor, after
a pause in typing. *(proposal)* A workflow of the course runs
`course check` on each pull request.

### R-COURSE-011

**The adapter of the reflection tool.** The course module must give the
reflection tool the context of each assignment
([R-REFL-021](reflection.md#r-refl-021)) from the reader: the assignment as
a task; its requirements, its rules and the files of its workspace as its
parts; its learning objectives with their levels, and the requirements and
rules that serve each; and the allowed level of AI use and the goals, when
the course gives them. The README and the feedback file are not parts of the
work of the student. In VS Code, the course extension registers the adapter
with the reflection extension ([R-REFL-017](reflection.md#r-refl-017)); on
the command line and on a server, `@nimblescape/course` is the adapter
package that the reflection tool loads.

### R-COURSE-012

**The course extension.** *(proposal)* The course extension of VS Code shows
the structure of a course: its chapters, learning objectives, assignments
and requirements, each with a link to its place in the README. For an
assignment, it opens the feedback and the analysis. It writes the comment
of the format with the save of a README of a course, in the same way as
Markdown Notes writes its comment.

## 6. Feedback

### R-FEED-001

**The feedback file.** The file `FEEDBACK.md` next to the README of an
assignment must have a form that people and programs read in the same way,
in every language of a course:

- the comment of the format with the kind `feedback`
  ([R-COURSE-004](#r-course-004));
- the title `# <word>: <title of the assignment> – <time>`;
- the sections assessment, best practices, suggestions and summary. The
  assessment has one item for each requirement, in their order, with its
  status (✅ met, ⚠️ partly met, ❌ missing), its number, its short text and a
  comment; then one item for each criterion, the item of the program run and
  the number of commits. The summary holds the score;
- an update after a later push appends `---` and `## Update – <time>` with
  the same sections one level lower, and it never changes earlier text.

The headings and the fixed texts come from the language of the course
([R-COURSE-006](#r-course-006)). Only the feedback program writes the file;
students cannot change it.

### R-FEED-002

**Feedback as data.** The reader must read a feedback file into JSON: for
the first feedback and for each update, the time, the status of each
requirement, the comment on each criterion, the score, and whether a check
capped the score.

### R-FEED-003

**The feedback and the reflection tool.** The feedback says whether the work
meets the requirements; the reflection tool shows who did the intellectual
work ([R-REFL-002](reflection.md#r-refl-002)). Both use the same numbers of
the requirements and of the learning objectives. *(proposal)* The summary of
the feedback links to the analysis of the same state of the work.

### R-FEED-004

**The feedback program.** A feedback program must read the README with the
reader of the module ([R-COURSE-009](#r-course-009)) and write the feedback
file in the form of [R-FEED-001](#r-feed-001). *(proposal)* The first
feedback program is `majikmate/course-feedback`
([R-ARCH-005](specification.md#r-arch-005)): it installs
`@nimblescape/course` from GitHub at a fixed commit, and it keeps its checks,
skills, engines and prompts, its own rules of the feedback and the rules of
each course for the feedback.

## 7. Open questions

1. Names: is `course` the name of the command
   ([R-COURSE-002](#r-course-002))?
2. Level of AI use: where does an assignment state the level of AI use that
   it allows: a line at the head of its README, its chapter, or
   `.course/course.yml` ([R-COURSE-011](#r-course-011))?
3. Settings: does the language of a course move from `.github/feedback.yml`
   to `.course/course.yml`, so that the course module and the feedback
   program read it from one place ([R-COURSE-006](#r-course-006))?
4. Notes in a README: the format of Markdown Notes wants its comment on the
   first line of a file. Does a README with notes hold the comment of the
   course first and the comment of the notes after it, with a new minor
   version of the format of Markdown Notes ([R-COURSE-004](#r-course-004))?
5. Integrity: a student can change the history file in `.workhistory/`. Does
   the course protect it like `FEEDBACK.md`, or does the reflection tool
   check it against the commits ([R-COURSE-003](#r-course-003))?
6. Feedback program: does `majikmate/course-feedback` stay a program of its
   own (proposal), or does it become a part of `course-vscode`
   ([R-FEED-004](#r-feed-004))?
7. Other files: does the module also define the form of the tutorial pages,
   the walkthroughs and the cheat sheet, or only the README files of the
   course, the chapters and the assignments ([R-COURSE-001](#r-course-001))?

## Sources

- Krathwohl, D. R. (2002). A revision of Bloom's taxonomy: An overview.
  *Theory Into Practice, 41*(4), 212–218.
  <https://doi.org/10.1207/s15430421tip4104_2>
