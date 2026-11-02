<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Specification of the evaluation plugin

This document defines the evaluation plugin of the history, a product of its
own beside nimblescape Markdown ([R-ARCH-003](specification.md#r-arch-003)).
The plugin evaluates the history of a file ([history](history.md)): it
classifies each step as original work or as routine work, gives each part of
a step a role, shows the result in views, and gives feedback on work and
learning. It is normative in the same way as the
[specification](specification.md): "must" marks a requirement, "should" a
recommendation, and "may" an option; a requirement marked *(proposal)* is
not decided yet, and [section 9](#9-open-questions) lists these open
questions. Each requirement has an ID as its heading.

## 1. Scope

### R-EVAL-001

**An evaluation of a history.** The evaluation plugin evaluates the history
of any file: a Markdown document, a paper of Markdown Paper, source code of
any language, or another file of the workspace, which the history records in
VS Code ([R-VSC-004](history.md#r-vsc-004)). It serves two uses: the author
gets feedback on their own work and learning, and a teacher evaluates
student assignments, written texts as well as programming assignments, with
their histories. The plugin reads a history only through the API and the
file form of the history ([R-HIST-007](history.md#r-hist-007),
[R-HIST-008](history.md#r-hist-008)), so it runs without the editor: in VS
Code, on a web page, on the command line and on a server.

### R-EVAL-019

**Scientific basis.** Each method of the plugin that classifies work,
measures it or interprets it for learning must rest on published scientific
work, and its requirement must cite that work. Peer-reviewed work comes
first; a book, a preprint or a guideline is marked as such in the sources.
Where no study shows that a method measures what it claims, the requirement
says so, and the views must present the result as a hypothesis and not as a
finding. Indicators from the traces of work must rest on a theory of
learning, because counts of activity alone are no valid measure of learning
(Gašević et al., 2015).

[Section 10](#10-scientific-basis) lists the basis and its status for each
requirement. The requirements on the software ([R-EVAL-016](#r-eval-016),
[R-EVAL-017](#r-eval-017)) are technical decisions and follow the rules of
all nimblescape repositories ([R-GEN-007](specification.md#r-gen-007)).

## 2. Terms

| Term | Meaning |
| --- | --- |
| Episode | A question to the AI, its answer, the decision of the user, and the edits that follow on the same text; or a group of edits without the AI, by the undo groups of the editor |
| Original work | Work that creates content that did not exist in this form: ideas, claims and their phrasing, structure, design, new code |
| Routine work | Work that applies a given rule or finds a given thing: formatting, search, literature research |
| Role | What a party does in a part of an episode: direct, produce or judge ([R-EVAL-018](#r-eval-018)) |
| Intellectual work | Original work and the roles direct and judge: the thinking that the evaluation counts for a party |
| Code | A value of a coding scheme that the classifier gives an episode, with its reason |
| Indicator | A number of the evaluation that describes the process of work and learning |
| Assignment | A document or a set of source files with its history, which a student submits |

## 3. Classification

### R-EVAL-002

**Two classes.** The plugin must classify each episode that creates or
changes content as original work or as routine work, by the work that it
does:

- *Original work:* work that creates content that did not exist in this
  form, for example an idea, a claim and the phrasing of specific claims,
  the structure of an argument, a design, or new code such as a new
  function that implements the quick sort algorithm, or the design of a
  module.
- *Routine work:* work that applies a given rule or finds a given thing,
  without content of its own, for example the reference list rewritten in
  APA 7, code formatted, a rename by a refactoring tool, a paper found that
  supports a given statement, or a literature research about
  "Industrialisierung von Dienstleistungen".

The term follows the routine tasks of labor economics: tasks that follow
explicit rules, so that a program can do them (Autor et al., 2003). A
question to the AI is the role direct of the user
([R-EVAL-018](#r-eval-018)); the answer and the changes that the user
accepts are the role produce of the AI, with the class of the work that the
question asks for. Each classification must record its reason, so that a
reader can check it.

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

Original work is create, evaluate, or an analysis with a conclusion of its
own; decision selection; a meaning change. Routine work is remember,
understand, or apply a given rule; information acquisition; an
implementation by a given rule; a surface change. New code counts as
create, also when it implements a known algorithm such as quick sort
([R-EVAL-002](#r-eval-002)).

### R-EVAL-004

**The classifier.** The classifier is pluggable and may use an AI through
the provider API of the libraries ([R-AI-002](ai.md#r-ai-002)).
Large language models can code text with an accuracy and an agreement above
those of crowd workers (Gilardi et al., 2023), but the result depends on the
task, so the classifier must pass the check of [R-EVAL-006](#r-eval-006).
Its rules are a file with a definition and examples of each class, role and
code, in the form of a codebook of qualitative analysis (MacQueen et al.,
1998), so that an institution, a course or a layout of Paper can give rules
of its own. The unit of the classification is the episode; it follows the
analysis of logs of the writing process (Leijten & Van Waes, 2013) and of
logs of writing sessions with a language model (Lee et al., 2022). The
classifier must compare the text before and after an episode, and must not
judge a question to the AI alone. *(proposal)* The library brings default
rules with the examples of [R-EVAL-002](#r-eval-002). The classifier
classifies each episode when the history records it, and again when the
rules change. An episode that holds both classes is split into its parts.

### R-EVAL-005

*(proposal)* **Corrections.** The author may correct a classification with a
reason, in the way of member checking, where the participants of a study
check the interpretation of their own data (Birt et al., 2016). The
correction is a step of the history, and the evaluation shows the
classification and the correction; in an assignment, the teacher sees both.

### R-EVAL-006

**Check against people.** The classifier must be checked against people: two
people code a sample of episodes on their own, and Krippendorff's alpha
measures the agreement of the people and the classifier (Hayes &
Krippendorff, 2007). The rules and their examples improve until alpha
reaches 0.800, the usual limit for reliable data; an alpha from 0.667 allows
only tentative conclusions (Krippendorff, 2004, p. 241). The plugin shows
the alpha of the rules in use, marks the results of rules with an alpha
below 0.800 as tentative, and does not evaluate with rules below 0.667.

### R-EVAL-018

**Roles.** The classifier must give each part of an episode a role, with
the party that did it, the user or the AI:

- *direct:* set the goal, the limits and the method of a task, for example
  a question to the AI with its conditions, or the choice of an algorithm
  for a problem;
- *produce:* write the content, for example the text, the code or the list
  of the papers found;
- *judge:* check, select, correct, accept or reject content, for example
  test the code of the AI, compare two answers, or correct a claim of the
  AI.

The two classes of [R-EVAL-002](#r-eval-002) apply to the role produce.
Direct and judge are intellectual work of the party that did them, as
original work is, and the evaluation must show the three apart: who created
the content, who directed it and who checked it. Roles are the established
form to attribute contributions in research (Brand et al., 2015). With AI,
checking information, integrating answers and steering the task become a
large part of the critical thinking of a person (Lee et al., 2025).
*(proposal)* An accept counts as judge only when the history shows a check,
for example a test run, an edit of the answer or a question about it; an
accept without a check is recorded as such, because people often accept the
output of automation and of AI without a check (Parasuraman & Manzey, 2010;
Buçinca et al., 2021).

## 4. Evaluation

### R-EVAL-007

**Class and origin.** The evaluation must combine the class with the origin
of each episode ([R-HIST-001](history.md#r-hist-001)): for the user
and for the AI, it gives the episodes, the time and the share of the final
text of each class, for the whole document or set of files, and for each
section or file. Changes with the origin "other program" or "probably AI"
([R-VSC-004](history.md#r-vsc-004)) count apart until the user marks
them. With the roles ([R-EVAL-018](#r-eval-018)), it also gives the episodes
that each party directed and judged. This shows which cognitive work the
author moved to the AI, in the sense of cognitive offloading: an action that
reduces the cognitive demand of a task (Risko & Gilbert, 2016).

### R-EVAL-008

**Origin of the final text.** Each character of the final text belongs to
the episode that wrote it. A later meaning change by the other party makes
that text original work of that party; a surface change does not (Faigley &
Witte, 1981).

### R-EVAL-009

**Declaration.** The plugin must write a declaration of the use of AI from
the evaluation: the original work of the AI, the routine work that the AI
did, and the roles in the terms of CRediT (Brand et al., 2015) and GAIDeT
(Suchikova et al., 2025). With the roles ([R-EVAL-018](#r-eval-018)), the
declaration also states which work of the AI the user directed and checked.
The declaration comes from the history and not from memory, because people
who write with AI declare themselves as authors even when they do not feel
ownership of the text of the AI (Draxler et al., 2024). Paper adds the
declaration and the views to the appendix of the PDF
([R-HIST-005](history.md#r-hist-005)).

## 5. Views

### R-EVAL-010

**The views.** The plugin must show the evaluation in views:

| View | What it shows |
| --- | --- |
| Timeline | Each episode on a time axis: the class as color, the origin as form, the cognitive process as height |
| Shares over time | For each session or week, the shares of original work, routine work, directing and judging of the user and of the AI |
| Map | Each section of a document, or each file of a set of source files, with its shares of class and origin |
| Effort | Time and episodes for each class, role and origin, and the time of routine work that the AI took over |
| Goals | The goals of the author, of the teacher or of the rules, beside the current shares |

The timeline follows the visualizations of the writing process in keystroke
logging (Leijten & Van Waes, 2013), and the views as a whole follow the
dashboards of learning analytics (Verbert et al., 2013). A click on a mark
opens its episode in the history
([R-HIST-003](history.md#r-hist-003)). The colors come from the theme
([R-THEME-001](platforms.md#r-theme-001)), and every view also tells the
classes and the origins apart without color: about 8% of men of European
origin have a red-green color deficiency (Birch, 2012).

## 6. Feedback on learning

### R-EVAL-011

**Formative feedback.** The views must serve as feedback on the work and the
learning of the author, along the three questions of feedback (Hattie &
Timperley, 2007): where am I going (the goals), how am I going (the shares
and their trend), and where to next (the sections, files and episodes that
hold intellectual work of the AI). They support the self-reflection of
self-regulated learning (Zimmerman, 2002), and they should lead from
awareness to reflection, sensemaking and a change of behavior (Verbert et
al., 2013). Dashboards of learning analytics are rarely grounded in learning
theory and rarely evaluated well (Matcha et al., 2020); the views therefore
take their questions from the theories above, and their effect needs the
study of [R-EVAL-013](#r-eval-013).

### R-EVAL-012

**Indicators.** The evaluation must give indicators of the learning effect
and of the learning efficiency. No study shows yet that these indicators
measure learning; each one is a hypothesis with the basis in the table, and
the views must label it as a hypothesis ([R-EVAL-019](#r-eval-019)):

| Indicator | Hypothesis | Basis |
| --- | --- | --- |
| The share of own intellectual work, and its trend | Learning effect: the author does more of the intellectual work over time | Offloading of work to AI can harm learning (Bastani et al., 2025) and goes with less critical thinking (Gerlich, 2025) |
| The cognitive processes of the own episodes, and their trend | Learning effect: the author moves from remember and apply to analyze, evaluate and create | The revised taxonomy of Bloom (Krathwohl, 2002) |
| The share of AI answers that the author rejects or changes in their meaning | Critical evaluation of the output of the AI | Checking and integrating AI answers as critical thinking (Lee et al., 2025) |
| *(proposal)* The share of AI answers that the author accepts without a check ([R-EVAL-018](#r-eval-018)) | Reliance on the AI without critical evaluation | Automation bias (Parasuraman & Manzey, 2010) and overreliance on AI (Buçinca et al., 2021) |
| The share of the time on intellectual work, and the time of routine work that the AI took over | Learning efficiency: time free for intellectual work | Offloading reduces the cognitive demand of a task (Risko & Gilbert, 2016), but it can also harm learning (Bastani et al., 2025) |

### R-EVAL-013

**Limits of the indicators.** The views must state that the indicators
describe the process of the work in the editor and not what the author has
learned, and that they are no grade. Work outside the editor, for example on
paper, in talks or with other AI tools, is not in the history. Counts of
activity are no measure of learning without a theory of learning (Gašević et
al., 2015). *(proposal)* Before the indicators are used in teaching, a study
compares them with tests or grades.

## 7. Student assignments

### R-EVAL-014

**Assignments.** A teacher must be able to evaluate a submitted assignment
with its history: a written text, a paper of Paper, or a programming
assignment. The plugin reads the history that the student submits with the
assignment, applies the rules of the course, and gives the evaluation, the
views and the declaration of [R-EVAL-009](#r-eval-009) for each assignment.
The student sees the same evaluation as the teacher. *(proposal)* A teacher
evaluates all assignments of a course in one run, on the command line or on
a server. The rules of a course may state the level of AI use that the
assignment allows, after the AI Assessment Scale (Perkins et al., 2024), and
the evaluation shows the work beside this level.

### R-EVAL-015

**Data of the students.** The plugin must support the rules of the
institution on data protection: it evaluates a history only when the student
submits or shares it, it can delete a history and its evaluation, and its
views compare no persons with each other unless the rules of the course
allow it. These rules follow the ethics of learning analytics: informed
consent, transparency, privacy and the management of the data (Slade &
Prinsloo, 2013), and the DELICATE checklist for trusted learning analytics
(Drachsler & Greller, 2016).

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

**Package and extension.** The evaluation plugin must have a VS Code
extension of its own, the evaluation extension
([R-ARCH-003](specification.md#r-arch-003)). It depends on the history
extension ([R-VSC-004](history.md#r-vsc-004)) and shows the views of the
plugin in VS Code. *(proposal)* The plugin is the npm package
`@nimblescape/evaluation` in the repository `nimblescape/evaluation-vscode`,
together with its extension.

## 9. Open questions

1. Checks: does an accept count as judge only when the history shows a
   check ([R-EVAL-018](#r-eval-018), proposal), and which signs count as a
   check: a test run, an edit of the answer, a question about it, or the
   time to read it?
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
9. Repository: does the plugin get the repository
   `nimblescape/evaluation-vscode` of its own ([R-EVAL-017](#r-eval-017),
   proposal), or does it share one repository with the history?

## 10. Scientific basis

The status tells how far the science carries a requirement: *established* is
an established method, theory or framework; *finding* is an empirical
result; *new* combines established work in a new way and needs the check of
[R-EVAL-006](#r-eval-006); *hypothesis* is not tested by any study yet.

| Requirement | Basis | Status |
| --- | --- | --- |
| [R-EVAL-002](#r-eval-002) Two classes | Krathwohl (2002); Autor et al. (2003) | New: established terms; the border for work with AI comes from the rules and their check |
| [R-EVAL-003](#r-eval-003) Three codes | Krathwohl (2002); Parasuraman et al. (2000); Faigley & Witte (1981) | New: established schemes in a new combination |
| [R-EVAL-004](#r-eval-004) The classifier | Gilardi et al. (2023); MacQueen et al. (1998); Leijten & Van Waes (2013); Lee et al. (2022) | Established methods; the accuracy for this task is known only after the check |
| [R-EVAL-005](#r-eval-005) Corrections | Birt et al. (2016) | Established method |
| [R-EVAL-006](#r-eval-006) Check against people | Hayes & Krippendorff (2007); Krippendorff (2004) | Established method |
| [R-EVAL-018](#r-eval-018) Roles | Brand et al. (2015); Lee et al. (2025); Parasuraman & Manzey (2010); Buçinca et al. (2021) | New: established roles and findings, used as codes of a history |
| [R-EVAL-007](#r-eval-007) Class and origin | Risko & Gilbert (2016) | Established theory |
| [R-EVAL-008](#r-eval-008) Origin of the final text | Faigley & Witte (1981) | Established method |
| [R-EVAL-009](#r-eval-009) Declaration | Brand et al. (2015); Suchikova et al. (2025); Draxler et al. (2024) | Established taxonomies and a finding |
| [R-EVAL-010](#r-eval-010) Views | Leijten & Van Waes (2013); Verbert et al. (2013); Birch (2012) | Established methods and a finding |
| [R-EVAL-011](#r-eval-011) Formative feedback | Hattie & Timperley (2007); Zimmerman (2002); Verbert et al. (2013); Matcha et al. (2020) | Established theories; the effect of the views is a hypothesis |
| [R-EVAL-012](#r-eval-012) Indicators | The column "Basis" of its table | Hypothesis |
| [R-EVAL-013](#r-eval-013) Limits of the indicators | Gašević et al. (2015) | Established position |
| [R-EVAL-014](#r-eval-014) Assignments | Perkins et al. (2024); Draxler et al. (2024) | Established framework and a finding |
| [R-EVAL-015](#r-eval-015) Data of the students | Slade & Prinsloo (2013); Drachsler & Greller (2016) | Established frameworks |
| [R-EVAL-016](#r-eval-016), [R-EVAL-017](#r-eval-017) API and package | None: technical decisions | Not applicable |

## Sources

- Autor, D. H., Levy, F., & Murnane, R. J. (2003). The skill content of
  recent technological change: An empirical exploration. *The Quarterly
  Journal of Economics, 118*(4), 1279–1333.
  <https://doi.org/10.1162/003355303322552801>
- Bastani, H., Bastani, O., Sungu, A., Ge, H., Kabakcı, Ö., & Mariman, R.
  (2025). Generative AI without guardrails can harm learning: Evidence from
  high school mathematics. *Proceedings of the National Academy of Sciences,
  122*(26), e2422633122. <https://doi.org/10.1073/pnas.2422633122>
- Birch, J. (2012). Worldwide prevalence of red-green color deficiency.
  *Journal of the Optical Society of America A, 29*(3), 313.
  <https://doi.org/10.1364/JOSAA.29.000313>
- Birt, L., Scott, S., Cavers, D., Campbell, C., & Walter, F. (2016). Member
  checking: A tool to enhance trustworthiness or merely a nod to validation?
  *Qualitative Health Research, 26*(13), 1802–1811.
  <https://doi.org/10.1177/1049732316654870>
- Brand, A., Allen, L., Altman, M., Hlava, M., & Scott, J. (2015). Beyond
  authorship: Attribution, contribution, collaboration, and credit. *Learned
  Publishing, 28*(2), 151–155. <https://doi.org/10.1087/20150211>
- Buçinca, Z., Malaya, M. B., & Gajos, K. Z. (2021). To trust or to think:
  Cognitive forcing functions can reduce overreliance on AI in AI-assisted
  decision-making. *Proceedings of the ACM on Human-Computer Interaction,
  5*(CSCW1), 1–21. <https://doi.org/10.1145/3449287>
- Drachsler, H., & Greller, W. (2016). Privacy and analytics: It's a
  DELICATE issue. A checklist for trusted learning analytics. In
  *Proceedings of the Sixth International Conference on Learning Analytics &
  Knowledge* (pp. 89–98). ACM. <https://doi.org/10.1145/2883851.2883893>
- Draxler, F., Werner, A., Lehmann, F., Hoppe, M., Schmidt, A., Buschek, D.,
  & Welsch, R. (2024). The AI ghostwriter effect: When users do not perceive
  ownership of AI-generated text but self-declare as authors. *ACM
  Transactions on Computer-Human Interaction, 31*(2), 1–40.
  <https://doi.org/10.1145/3637875>
- Faigley, L., & Witte, S. (1981). Analyzing revision. *College Composition
  and Communication, 32*(4), 400–414. <https://doi.org/10.2307/356602>
- Gašević, D., Dawson, S., & Siemens, G. (2015). Let's not forget: Learning
  analytics are about learning. *TechTrends, 59*(1), 64–71.
  <https://doi.org/10.1007/s11528-014-0822-x>
- Gemenis, K. (2013). What to do (and not to do) with the Comparative
  Manifestos Project data. *Political Studies, 61*(S1), 3–23.
  <https://doi.org/10.1111/1467-9248.12015>
- Gerlich, M. (2025). AI tools in society: Impacts on cognitive offloading
  and the future of critical thinking. *Societies, 15*(1), 6.
  <https://doi.org/10.3390/soc15010006>
- Gilardi, F., Alizadeh, M., & Kubli, M. (2023). ChatGPT outperforms crowd
  workers for text-annotation tasks. *Proceedings of the National Academy of
  Sciences, 120*(30), e2305016120. <https://doi.org/10.1073/pnas.2305016120>
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
  methodology* (2nd ed.). Sage. Book; the limits of p. 241 as quoted in
  peer-reviewed work, for example by Gemenis (2013).
- Lee, H.-P., Sarkar, A., Tankelevitch, L., Drosos, I., Rintel, S., Banks,
  R., & Wilson, N. (2025). The impact of generative AI on critical thinking:
  Self-reported reductions in cognitive effort and confidence effects from a
  survey of knowledge workers. In *Proceedings of the 2025 CHI Conference on
  Human Factors in Computing Systems* (pp. 1–22). ACM.
  <https://doi.org/10.1145/3706598.3713778>
- Lee, M., Liang, P., & Yang, Q. (2022). CoAuthor: Designing a human-AI
  collaborative writing dataset for exploring language model capabilities.
  In *CHI Conference on Human Factors in Computing Systems* (pp. 1–19).
  <https://doi.org/10.1145/3491102.3502030>
- Leijten, M., & Van Waes, L. (2013). Keystroke logging in writing research:
  Using Inputlog to analyze and visualize writing processes. *Written
  Communication, 30*(3), 358–392. <https://doi.org/10.1177/0741088313491692>
- MacQueen, K. M., McLellan, E., Kay, K., & Milstein, B. (1998). Codebook
  development for team-based qualitative analysis. *CAM Journal, 10*(2),
  31–36. <https://doi.org/10.1177/1525822X980100020301>
- Matcha, W., Uzir, N. A., Gasevic, D., & Pardo, A. (2020). A systematic
  review of empirical studies on learning analytics dashboards: A
  self-regulated learning perspective. *IEEE Transactions on Learning
  Technologies, 13*(2), 226–245. <https://doi.org/10.1109/TLT.2019.2916802>
- Parasuraman, R., & Manzey, D. H. (2010). Complacency and bias in human use
  of automation: An attentional integration. *Human Factors, 52*(3),
  381–410. <https://doi.org/10.1177/0018720810376055>
- Parasuraman, R., Sheridan, T. B., & Wickens, C. D. (2000). A model for
  types and levels of human interaction with automation. *IEEE Transactions
  on Systems, Man, and Cybernetics – Part A: Systems and Humans, 30*(3),
  286–297. <https://doi.org/10.1109/3468.844354>
- Perkins, M., Furze, L., Roe, J., & MacVaugh, J. (2024). The Artificial
  Intelligence Assessment Scale (AIAS): A framework for ethical integration
  of generative AI in educational assessment. *Journal of University
  Teaching and Learning Practice, 21*(6).
  <https://doi.org/10.53761/q3azde36>
- Risko, E. F., & Gilbert, S. J. (2016). Cognitive offloading. *Trends in
  Cognitive Sciences, 20*(9), 676–688.
  <https://doi.org/10.1016/j.tics.2016.07.002>
- Slade, S., & Prinsloo, P. (2013). Learning analytics: Ethical issues and
  dilemmas. *American Behavioral Scientist, 57*(10), 1510–1529.
  <https://doi.org/10.1177/0002764213479366>
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
