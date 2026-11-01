<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Specification of the evaluation plugin

This specification defines the evaluation plugin of nimblescape Markdown.
The plugin evaluates the history of a text document
([specification](specification.md#8-history), section 8): it classifies each
step as intellectual origin or as mechanics, shows the result in views, and
gives feedback on work and learning. It is normative in the same way as the
[specification](specification.md): "must" marks a requirement, "should" a
recommendation, and "may" an option; a requirement marked *(proposal)* is
not decided yet, and [section 9](#9-open-questions) lists these open
questions. Each requirement has an ID as its heading.

## 1. Scope

### R-EVAL-001

**An evaluation of a history.** The evaluation plugin evaluates the history
of any text document: a Markdown document, a paper of Markdown Paper, or
source code of any language, which the history records in every text editor
of VS Code ([R-VSC-004](specification.md#r-vsc-004)). It serves two uses:
the author gets feedback on their own work and learning, and a teacher
evaluates student assignments, written texts as well as programming
assignments, with their histories. The plugin reads a history only through
the API and the file form of the history
([R-HIST-007](specification.md#r-hist-007),
[R-HIST-008](specification.md#r-hist-008)), so it runs without the editor:
in VS Code, on a web page, on the command line and on a server.

## 2. Terms

| Term | Meaning |
| --- | --- |
| Episode | A question to the AI, its answer, the decision of the user, and the edits that follow on the same text; or a group of edits without the AI, by the undo groups of the editor |
| Intellectual origin | Work that creates content of its own: ideas, claims and their phrasing, structure, design, new code |
| Mechanics | Work that applies given rules or finds given things: formatting, search, literature research |
| Code | A value of a coding scheme that the classifier gives an episode, with its reason |
| Role | What a party does in a part of an episode: direct, produce or judge ([R-EVAL-018](#r-eval-018), proposal) |
| Indicator | A number of the evaluation that describes the process of work and learning |
| Assignment | A document or a set of source files with its history, which a student submits |

## 3. Classification

### R-EVAL-002

**Two classes.** The plugin must classify each episode that creates or
changes content as intellectual origin or as mechanics, by the work that it
does:

- *Intellectual origin:* work that creates content of its own, for example
  an idea, a claim and the phrasing of specific claims, the structure of an
  argument, a design, or new code such as a new function that implements the
  quick sort algorithm, or the design of a module.
- *Mechanics:* work that applies given rules or finds given things, without
  content of its own, for example the reference list rewritten in APA 7,
  code formatted, a rename by a refactoring tool, a paper found that
  supports a given statement, or a literature research about
  "Industrialisierung von Dienstleistungen".

A question to the AI is classified by the work that it asks for; its answer
and the changes that the user accepts carry this class with the origin AI.
Each classification must record its reason, so that a reader can check it.

### R-EVAL-003

*(proposal)* **Three codes.** The classifier codes each episode with three
codes, and the two classes come from these codes:

- the cognitive process, after the revised taxonomy of Bloom (Krathwohl,
  2002): remember, understand, apply, analyze, evaluate, create;
- the stage of the work, after the types of automation of Parasuraman,
  Sheridan and Wickens (2000): information acquisition, information
  analysis, decision and action selection, action implementation;
- for an edit, the type of revision, after Faigley and Witte (1981): a
  surface change or a meaning change. In source code, a change that keeps
  the syntax tree, or a refactoring by a tool that keeps the behavior, is a
  surface change; a change of the behavior is a meaning change.

Intellectual origin is create, evaluate, or an analysis with a conclusion of
its own; decision selection; a meaning change. Mechanics is remember,
understand, or apply a given rule; information acquisition; an
implementation by a given rule; a surface change. New code counts as
create, also when it implements a known algorithm such as quick sort
([R-EVAL-002](#r-eval-002)).

### R-EVAL-004

**The classifier.** The classifier is pluggable and may use an AI through
the provider API of the libraries ([R-AI-002](specification.md#r-ai-002)).
Its rules are a file with a description and examples of each class and code,
so that an institution, a course or a layout of Paper can give rules of its
own. The classifier must compare the text before and after an episode, and
must not judge a question to the AI alone. *(proposal)* The library brings
default rules with the examples of [R-EVAL-002](#r-eval-002). The classifier
classifies each episode when the history records it, and again when the
rules change. An episode that holds both classes is split into its parts.

### R-EVAL-005

*(proposal)* **Corrections.** The author may correct a classification with a
reason. The correction is a step of the history, and the evaluation shows
the classification and the correction; in an assignment, the teacher sees
both.

### R-EVAL-006

**Check against people.** The classifier must be checked against people: two
people code a sample of episodes on their own, and Krippendorff's alpha
measures the agreement of the people and the classifier (Hayes &
Krippendorff, 2007). The rules and their examples improve until alpha
reaches 0.800, the usual limit for reliable data (Krippendorff, 2004). The
plugin shows the alpha of the rules in use.

### R-EVAL-018

*(proposal)* **Roles.** The classifier gives each part of an episode a role,
with the party that did it, the user or the AI:

- *direct:* set the goal, the limits and the method of a task, for example
  a question to the AI with its conditions, or the choice of an algorithm
  for a problem;
- *produce:* write the content, for example the text, the code or the list
  of the papers found;
- *judge:* check, select, correct, accept or reject content, for example
  test the code of the AI, compare two answers, or correct a claim of the
  AI.

The two classes of [R-EVAL-002](#r-eval-002) apply to the role produce.
Direct and judge are intellectual work of the party that did them, and the
evaluation shows them apart from the intellectual origin of the content:
who created the content, who directed it and who checked it. With AI,
checking information, integrating answers and steering the task become a
large part of the critical thinking of a person (Lee et al., 2025). An
accept counts as judge only when the history shows a check, for example a
test run, an edit of the answer or a question about it; an accept without
a check is recorded as such.

## 4. Evaluation

### R-EVAL-007

**Class and origin.** The evaluation must combine the class with the origin
of each episode ([R-HIST-001](specification.md#r-hist-001)): for the user
and for the AI, it gives the episodes, the time and the share of the final
text of each class, for the whole document or set of files, and for each
section or file. Changes with the origin "other program" or "probably AI"
([R-VSC-004](specification.md#r-vsc-004)) count apart until the user marks
them. *(proposal)* With the roles ([R-EVAL-018](#r-eval-018)), it also
gives the episodes that each party directed and judged.

### R-EVAL-008

**Origin of the final text.** Each character of the final text belongs to
the episode that wrote it. A later meaning change by the other party moves
the intellectual origin of that text to that party; a surface change does
not.

### R-EVAL-009

**Declaration.** The plugin must write a declaration of the use of AI from
the evaluation: the intellectual episodes of the AI, the mechanics that the
AI did, and the roles in the terms of CRediT (Brand et al., 2015) and GAIDeT
(Suchikova et al., 2025). Paper adds the declaration and the views to the
appendix of the PDF ([R-HIST-005](specification.md#r-hist-005)).
*(proposal)* With the roles ([R-EVAL-018](#r-eval-018)), the declaration
also states which work of the AI the user directed and checked.

## 5. Views

### R-EVAL-010

**The views.** The plugin must show the evaluation in views:

| View | What it shows |
| --- | --- |
| Timeline | Each episode on a time axis: the class as color, the origin as form, the cognitive process as height |
| Shares over time | For each session or week, the shares of intellectual origin and mechanics of the user and of the AI |
| Map | Each section of a document, or each file of a set of source files, with its shares of class and origin |
| Effort | Time and episodes for each class and origin, and the time of mechanics that the AI took over |
| Goals | The goals of the author, of the teacher or of the rules, beside the current shares |

A click on a mark opens its episode in the history
([R-HIST-003](specification.md#r-hist-003)). The colors come from the theme
([R-THEME-001](specification.md#r-theme-001)), and every view also tells the
classes and the origins apart without color.

## 6. Feedback on learning

### R-EVAL-011

**Formative feedback.** The views must serve as feedback on the work and the
learning of the author, along the three questions of feedback (Hattie &
Timperley, 2007): where am I going (the goals), how am I going (the shares
and their trend), and where to next (the sections, files and episodes that
hold intellectual work of the AI). They support the self-reflection of
self-regulated learning (Zimmerman, 2002), and they should lead from
awareness to reflection, sensemaking and a change of behavior (Verbert et
al., 2013).

### R-EVAL-012

**Indicators.** The evaluation must give indicators of the learning effect
and of the learning efficiency:

| Indicator | Meaning |
| --- | --- |
| The share of own intellectual origin, and its trend | Learning effect: the author does more of the intellectual work over time |
| The cognitive processes of the own episodes, and their trend | Learning effect: the author moves from remember and apply to analyze, evaluate and create |
| The share of AI answers that the author rejects or changes in their meaning | Critical evaluation of the output of the AI |
| *(proposal)* The share of AI answers that the author accepts without a check ([R-EVAL-018](#r-eval-018)) | Reliance on the AI without critical evaluation |
| The share of the time on intellectual work, and the time of mechanics that the AI took over | Learning efficiency: time free for intellectual work |

### R-EVAL-013

**Limits of the indicators.** The views must state that the indicators
describe the process of the work in the editor and not what the author has
learned, and that they are no grade. Work outside the editor, for example on
paper, in talks or with other AI tools, is not in the history. *(proposal)*
Before the indicators are used in teaching, a study compares them with tests
or grades.

## 7. Student assignments

### R-EVAL-014

**Assignments.** A teacher must be able to evaluate a submitted assignment
with its history: a written text, a paper of Paper, or a programming
assignment. The plugin reads the history that the student submits with the
assignment, applies the rules of the course, and gives the evaluation, the
views and the declaration of [R-EVAL-009](#r-eval-009) for each assignment.
The student sees the same evaluation as the teacher. *(proposal)* A teacher
evaluates all assignments of a course in one run, on the command line or on
a server.

### R-EVAL-015

**Data of the students.** The plugin must support the rules of the
institution on data protection: it evaluates a history only when the student
submits or shares it, it can delete a history and its evaluation, and its
views compare no persons with each other unless the rules of the course
allow it.

## 8. API and platforms

### R-EVAL-016

**An API for every platform.** The plugin must be a library with an API, the
same on every platform, whose results are JSON: the episodes with their
codes, classes and reasons; the data of each view and the indicators for a
time range and a part of the document or of the files; and the declaration.
A view component of the plugin draws each view as SVG from this data. The
platform adapter only places the views: a panel in VS Code for a document or
for the source files of a workspace, an element of a web page, the figures
of the appendix of the PDF with `mp build`, or the report of a course on a
server. Other programs may read the JSON, for example a learning management
system of an institution. *(proposal)* The functions are `evaluate(history,
rules)`, `analyze(evaluation, { from, to, part })` and
`declare(evaluation)`.

### R-EVAL-017

*(proposal)* **Package.** The plugin is the npm package
`@nimblescape/evaluation`, a workspace of the repository of nimblescape
Markdown until version 1 of the API of the history
([R-ARCH-002](specification.md#r-arch-002)), and later a repository of its
own.

## 9. Open questions

1. Classes and roles: the two classes with the roles direct, produce and
   judge ([R-EVAL-018](#r-eval-018), proposal), a third class "judgment"
   without roles, or only the two classes, with an episode that holds both
   split into its parts ([R-EVAL-004](#r-eval-004))?
2. Codes: is the scheme of three codes the right basis of the rules
   ([R-EVAL-003](#r-eval-003), proposal)? Which further code fits source
   code, for example the type of a change (a feature, a fix, a refactoring,
   a test)?
3. Classifier: does it run when an episode is recorded (proposal), or only
   when a history is evaluated? Which AI does a teacher use on a server, and
   who pays for it?
4. Rules: default rules in the library (proposal), or always the rules of
   the institution or of the course?
5. Corrections: may the author correct a classification
   ([R-EVAL-005](#r-eval-005), proposal: yes, as a step of its own)?
6. Views: which views in version 1 (proposal: timeline, shares over time,
   map)? Who sets the goals: the author, the teacher or the rules (proposal:
   all three, shown apart)?
7. Indicators: does a study compare them with tests or grades before they
   are used in teaching ([R-EVAL-013](#r-eval-013), proposal: yes)?
8. Assignments: may a teacher see an overview of a course that compares
   students? How does a student submit the history with an assignment: the
   file of the history in the repository, or an export?
9. Package and repository ([R-EVAL-017](#r-eval-017), proposal)?

## Sources

- Brand, A., Allen, L., Altman, M., Hlava, M., & Scott, J. (2015). Beyond
  authorship: Attribution, contribution, collaboration, and credit. *Learned
  Publishing, 28*(2), 151–155. <https://doi.org/10.1087/20150211>
- Faigley, L., & Witte, S. (1981). Analyzing revision. *College Composition
  and Communication, 32*(4), 400–414. <https://doi.org/10.2307/356602>
- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of
  Educational Research, 77*(1), 81–112.
  <https://doi.org/10.3102/003465430298487>
- Hayes, A. F., & Krippendorff, K. (2007). Answering the call for a standard
  reliability measure for coding data. *Communication Methods and Measures,
  1*(1), 77–89. <https://doi.org/10.1080/19312450709336664>
- Krathwohl, D. R. (2002). A revision of Bloom's taxonomy: An overview.
  *Theory Into Practice, 41*(4), 212–218.
  <https://doi.org/10.1207/s15430421tip4104_2>
- Krippendorff, K. (2004). *Content analysis: An introduction to its
  methodology* (2nd ed.), p. 241, as quoted by
  <https://www.statisticshowto.com/krippendorffs-alpha/>
- Lee, H.-P., Sarkar, A., Tankelevitch, L., Drosos, I., Rintel, S., Banks,
  R., & Wilson, N. (2025). The impact of generative AI on critical thinking:
  Self-reported reductions in cognitive effort and confidence effects from a
  survey of knowledge workers. In *Proceedings of the 2025 CHI Conference on
  Human Factors in Computing Systems* (pp. 1–22). ACM.
  <https://doi.org/10.1145/3706598.3713778>
- Parasuraman, R., Sheridan, T. B., & Wickens, C. D. (2000). A model for
  types and levels of human interaction with automation. *IEEE Transactions
  on Systems, Man, and Cybernetics – Part A: Systems and Humans, 30*(3),
  286–297. <https://doi.org/10.1109/3468.844354>
- Suchikova, Y., Tsybuliak, N., Teixeira da Silva, J. A., & Nazarovets, S.
  (2025). GAIDeT (Generative AI Delegation Taxonomy): A taxonomy for humans
  to delegate tasks to generative artificial intelligence in scientific
  research and publishing. *Accountability in Research*.
  <https://doi.org/10.1080/08989621.2025.2544331>
- Verbert, K., Duval, E., Klerkx, J., Govaerts, S., & Santos, J. L. (2013).
  Learning analytics dashboard applications. *American Behavioral Scientist,
  57*(10), 1500–1509. <https://doi.org/10.1177/0002764213479363>
- Zimmerman, B. J. (2002). Becoming a self-regulated learner: An overview.
  *Theory Into Practice, 41*(2), 64–70.
  <https://doi.org/10.1207/s15430421tip4102_2>

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdown/blob/main/LICENSE).
