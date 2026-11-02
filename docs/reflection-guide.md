<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# How the reflection tool works

This is the documentation of the reflection tool, which analyzes a history.
It describes in detail how the reflection tool works, step by step, and the
scientific work that each step rests on. It is written for the people who
read a report of the reflection tool: the author of a text or of code, a
student, and a teacher. The report itself cites no literature; each view and
the declaration link to their section here
([R-REFL-020](reflection.md#r-refl-020)). The rules that the reflection tool
must follow are in its [specification](reflection.md). A detail that the
specification does not decide yet is marked *(proposal)*.

## 1. Overview

The reflection tool reads the history of a file or of a set of files and
answers three questions: who did which part of the work, the author or the
AI; which kind of work it was; and how this changes over time. It works in
eight steps:

| Step | What it does | Section |
| --- | --- | --- |
| 1 | Read the steps of the history | [2](#2-step-1-read-the-history) |
| 2 | Group the steps into episodes | [3](#3-step-2-form-the-episodes) |
| 3 | Give each episode three codes | [4](#4-step-3-code-the-episodes) |
| 4 | Give each part of an episode a role | [5](#5-step-4-give-the-roles) |
| 5 | Classify each episode as original work or routine work | [6](#6-step-5-classify) |
| 6 | Give each character of the final text its origin | [7](#7-step-6-the-origin-of-the-final-text) |
| 7 | Compute the measures and the indicators | [8](#8-step-7-measures-and-indicators) |
| 8 | Show the views, the feedback and the declaration | [9](#9-step-8-views-feedback-and-declaration) |

Two procedures make the result trustworthy: the check of the rules against
people ([section 10](#10-the-check-of-the-rules)) and the corrections by the
author ([section 11](#11-corrections)). [Section 12](#12-assignments)
describes the use for student assignments, and
[section 13](#13-data-and-limits) the data and the limits.

The status at the end of each section tells how far the science carries the
step:

| Status | Meaning |
| --- | --- |
| Established | An established method, theory or framework |
| Finding | An empirical result |
| New | Established work combined in a new way; it needs the check against people |
| Hypothesis | Not tested by any study yet |

## 2. Step 1: read the history

**Input.** The reflection tool reads three things:

- the *history*: its steps, each with its time, its author and its origin
  (user, AI or other program). A step is an edit with its change as a text
  patch, a selection, a question to the AI with its prompt, its selection,
  its context, its provider and its model, an answer of the AI with its text
  and its proposed changes, the decision of the user on a proposed change,
  or a change of the workspace, for example a command in the terminal;
- the *rules*: a file with the definitions and examples of the classes, the
  roles and the codes ([section 10](#10-the-check-of-the-rules));
- the *scope*: a time range and a part, for example the whole document, one
  section, one file or a set of files.

**Steps of unknown source.** A change whose source no one reported has the
origin "other program", or "probably AI" when its form shows it, for example
several lines inserted at once at the cursor. These steps stay apart in
every measure until the author marks them, and the report shows their
number.

**Generated parts.** Parts that a plugin generates, for example the reference
list or the numbers of captions, have the origin "other program" and count
as routine work of that program.

*Status:* not applicable; this step only reads data.

## 3. Step 2: form the episodes

**What an episode is.** The reflection tool does not judge single key
strokes. It groups the steps into episodes, and an episode is the unit of
every code, role and class. There are two kinds:

- an *AI episode*: a question to the AI, its answer, the decision of the
  user, and the edits that follow on the same text;
- an *edit episode*: a group of edits without the AI.

**How episodes are formed.** *(proposal)*

1. An AI episode starts with a question to the AI. It ends with the next
   question to the AI, with the first edit outside its text, or after a
   pause of more than 10 minutes.
2. "The same text" is the block that the question selected or the answer
   changed: a paragraph or a list in Markdown, a function, a method or a
   class in code, found through the syntax tree.
3. An edit episode joins the undo groups of the editor on the same block,
   until the author moves to another block or pauses for more than 2
   minutes.
4. A command in the terminal that runs or tests the program, for example `ts
   main.ts`, belongs to the episode before it; the reflection tool uses it
   as a sign of a check ([section 5](#5-step-4-give-the-roles)).

**Basis.** This unit follows the analysis of logs of the writing process
(Leijten & Van Waes, 2013) and of logs of writing sessions with a language
model (Lee et al., 2022). The limits of 10 and 2 minutes are a proposal and
need the check of [section 10](#10-the-check-of-the-rules).

*Status:* established method; the limits are new.

## 4. Step 3: code the episodes

**The three codes.** The classifier gives each episode three codes, each
with a short reason:

| Code | Values | What it tells |
| --- | --- | --- |
| Cognitive process | remember, understand, apply, analyze, evaluate, create | Which thinking the episode needs |
| Stage of the work | information acquisition, information analysis, decision and action selection, action implementation | Which part of a task the episode does |
| Type of revision (edits only) | surface change, meaning change | Whether an edit changes what the text or the code says or does |

**How the classifier works.** The classifier is a program that may use an
AI. For each episode it gets the text before and after the episode, the
question and the answer of the AI if there are any, and the rules. It never
judges a question to the AI alone. It returns the three codes, the roles of
[section 5](#5-step-4-give-the-roles), and a reason for each, so that a
reader can check them. *(proposal)* It classifies an episode when the
history records it, and again when the rules change.

**Surface change or meaning change.** In a text, an edit is a meaning change
when it adds, removes or changes a statement; spelling, grammar, style and
formatting are surface changes. In code, an edit that keeps the syntax tree
after formatting, and a refactoring by a tool that keeps the behavior, are
surface changes; a change of the behavior is a meaning change. *(proposal)*
For code, the classifier compares the syntax trees before and after the
edit first, and asks the AI only when they differ.

**Basis.** The cognitive process follows the revised taxonomy of Bloom
(Krathwohl, 2002). The stage of the work follows the four types of
automation of Parasuraman, Sheridan and Wickens (2000). The type of revision
follows the taxonomy of revisions of Faigley and Witte (1981). The rules
have the form of a codebook of qualitative analysis, with a definition and
examples of each code (MacQueen et al., 1998). Large language models can
code text with an accuracy and an agreement above those of crowd workers
(Gilardi et al., 2023), but the result depends on the task; for this reason
the rules must pass the check of [section 10](#10-the-check-of-the-rules).

*Status:* new. Established schemes and methods in a new combination; the
accuracy for this task is known only after the check.

## 5. Step 4: give the roles

**The three roles.** Each part of an episode gets a role and the party that
did it, the user or the AI:

| Role | What the party does | Example |
| --- | --- | --- |
| Direct | Sets the goal, the limits and the method of a task | A question to the AI with its conditions; the choice of an algorithm |
| Produce | Writes the content | The text, the code, the list of the papers found |
| Judge | Checks, selects, corrects, accepts or rejects content | Tests the code of the AI; compares two answers; corrects a claim of the AI |

**How the roles are found.**

- *Direct:* the question to the AI is the role direct of the user. An edit
  episode of the user directs itself.
- *Produce:* the party whose characters the episode adds or changes. When
  the user accepts an answer of the AI and then rewrites a part of it, the
  AI produced the part that stays and the user produced the rewritten part.
- *Judge:* the decision of the user on an answer of the AI. *(proposal)* A
  decision counts as judge only when the history shows a check: a run or a
  test of the program after the answer and before the decision, an edit of
  the answer, or a question about the answer. An accept without such a sign
  is recorded as "accepted without a check".

**Basis.** Roles are the established form to attribute contributions in
research (Brand et al., 2015). With AI, checking information, integrating
answers and steering the task become a large part of the critical thinking
of a person (Lee et al., 2025). People often accept the output of automation
and of AI without a check (Parasuraman & Manzey, 2010; Buçinca et al.,
2021); for this reason the reflection tool shows an accept without a check
apart.

*Status:* new. Established roles and findings, used as codes of a history.

## 6. Step 5: classify

**The two classes.** The class applies to the role produce:

- *Original work* creates content that did not exist in this form: an idea,
  a claim and its phrasing, the structure of an argument, a design, new
  code. New code is original work also when it implements a known
  algorithm, for example quick sort.
- *Routine work* applies a given rule or finds a given thing: a reference
  list in APA 7, formatted code, a rename by a tool, a paper found for a
  given statement, a literature research.

**From the codes to the class.** The result decides the class: work is
routine work only when a given rule or a given source fixes its result, so
that a program could do the same work. All other work that creates new code
or a new statement is original work. *(proposal)* The three codes give the
reason of the class and point to it:

| Code | Points to original work | Points to routine work |
| --- | --- | --- |
| Cognitive process | create, evaluate, analyze with a conclusion of its own | remember, understand |
| Stage of the work | decision and action selection | information acquisition; action implementation by a given rule |
| Type of revision | meaning change | surface change |

The cognitive process "apply" points to neither class. A student who writes
a loop that the course has just taught applies what was learned and does
original work, because the code is new. A formatter applies a given rule and
does routine work, because the rule fixes the result. The cognitive process
is always the process that the party carried out. *(proposal)* In an
assignment, the context of the assignment gives the levels of its learning
objectives on the same scale, and the report compares the processes with
these levels ([section 12](#12-assignments)).

When the codes point to both classes, the classifier splits the episode into
its parts and classifies each part. The work of an answer of the AI has the
class of the work that the question asks for.

**Intellectual work.** Original work, directing and judging together are the
intellectual work of a party: the thinking that the reflection tool counts for
the author and for the AI.

**Basis.** The term "routine work" follows the routine tasks of labor
economics: tasks that follow explicit rules, so that a program can do them
(Autor et al., 2003). The levels of thinking come from the revised taxonomy
of Bloom (Krathwohl, 2002).

*Status:* new. The terms are established; the border between the classes
for work with AI comes from the rules and their check.

## 7. Step 6: the origin of the final text

**How it works.** Each character of the final text carries the episode that
wrote it, and through the episode its party and its class. The reflection tool
follows each character through all later edits, in the way that `git blame`
follows the lines of a file. When the other party later makes a meaning
change on a sentence of a text or on a statement of code, this sentence or
statement moves to that party as its original work. A surface change does
not move it.

**Example.** The AI writes four sentences, and the author rewrites two of
them with a new claim and changes one word in a third. The final text then
holds two sentences of original work of the AI (one of them with a surface
change by the author) and two sentences of original work of the author.

**Basis.** The border between a surface change and a meaning change follows
the taxonomy of revisions of Faigley and Witte (1981).

*Status:* established method.

## 8. Step 7: measures and indicators

**Measures.** For the scope of the report, the reflection tool computes for
the author, for the AI and for the steps of unknown source:

| Measure | How it is computed |
| --- | --- |
| Share of the final text | The characters of the final text of each party and class, divided by all characters of the final text |
| Episodes | The number of episodes of each class, role and party |
| Time | *(proposal)* The time of an episode runs from its first to its last step; a pause of more than 5 minutes inside an episode does not count |
| Share of intellectual work | *(proposal)* The parts of episodes with the role direct, judge, or produce with original work of a party, divided by all such parts of both parties |
| Answers of the AI | The answers, and how many of them the author directed, judged with a check, rejected, changed in their meaning, or accepted without a check |
| Routine work that the AI took over | The time of the routine work of the AI |

Every measure is also computed for each section of a document, for each file
of a set of files, and for each session or week, for the views.

**Indicators.** From the measures, the reflection tool gives indicators of the
learning effect and of the learning efficiency. No study shows yet that they
measure learning; each one is a hypothesis, and the report labels it so:

| Indicator | Hypothesis | Basis |
| --- | --- | --- |
| The share of own intellectual work, and its trend | Learning effect: the author does more of the intellectual work over time | Offloading of work to AI can harm learning (Bastani et al., 2025) and goes with less critical thinking (Gerlich, 2025) |
| The cognitive processes of the own episodes, and their trend | Learning effect: the author moves from remember and apply to analyze, evaluate and create | The revised taxonomy of Bloom (Krathwohl, 2002) |
| *(proposal)* In an assignment, for each learning objective, the share of its work at its level that the student did | Learning effect: the student does the thinking that the objective aims at | Learning objectives on the levels of the revised taxonomy of Bloom (Krathwohl, 2002); offloading of work to AI can harm learning (Bastani et al., 2025) |
| The share of AI answers that the author rejects or changes in their meaning | Critical evaluation of the output of the AI | Checking and integrating AI answers as critical thinking (Lee et al., 2025) |
| The share of AI answers that the author accepts without a check | Reliance on the AI without critical evaluation | Automation bias (Parasuraman & Manzey, 2010) and overreliance on AI (Buçinca et al., 2021) |
| The share of the time on intellectual work, and the time of routine work that the AI took over | Learning efficiency: time free for intellectual work | Offloading reduces the cognitive demand of a task (Risko & Gilbert, 2016), but it can also harm learning (Bastani et al., 2025) |

*(proposal)* The trend of an indicator is the difference between the first
and the last week of the scope, and the report shows the value of each week
beside it.

**Basis.** Indicators from the traces of work rest on a theory of learning,
because counts of activity alone are no valid measure of learning (Gašević
et al., 2015). The combination of class and origin shows which cognitive
work the author moved to the AI, in the sense of cognitive offloading: an
action that reduces the cognitive demand of a task (Risko & Gilbert, 2016).

*Status:* hypothesis for the indicators; established theory for the
combination of class and origin.

## 9. Step 8: views, feedback and declaration

### The views

| View | What it shows | How to read it |
| --- | --- | --- |
| Timeline | Each episode on a time axis: the class as color, the origin as form, the cognitive process as height | Marks high on the axis are analyze, evaluate and create; a click opens the episode in the history |
| Shares over time | For each session or week, the shares of original work, routine work, directing and judging of the author and of the AI | A growing share of the author's original work is the hypothesis of a learning effect |
| Map | Each section or file with its shares of class and origin | Shows where the AI did original work |
| Effort | Time and episodes for each class, role and origin | Shows where the time went, and how much routine work the AI took over |
| Goals | The goals of the author, of the teacher or of the rules, beside the current shares | Shows how far each goal is reached |

Every view also tells the classes and the origins apart without color: the
class by lightness or a pattern, the origin by form. A click on a mark opens
its episode in the history.

**Basis.** The timeline follows the visualizations of the writing process in
keystroke logging (Leijten & Van Waes, 2013), and the views as a whole
follow the dashboards of learning analytics (Verbert et al., 2013). The views
work without color because about 8% of men of European origin have a
red-green color deficiency (Birch, 2012).

*Status:* established methods and a finding.

### The feedback

The feedback answers three questions:

1. *Where am I going?* The goals: from the rules of the course, from the
   teacher, or from the author.
2. *How am I going?* The shares and their trend, and the indicators.
3. *Where to next?* *(proposal)* The three sections, files or groups of
   episodes with the highest share of intellectual work of the AI, and the
   answers of the AI that the author accepted without a check, each with a
   link to its episodes. In an assignment, also the learning objectives
   whose level the AI reached in place of the student.

**Basis.** The three questions come from the model of feedback of Hattie and
Timperley (2007). The feedback supports the self-reflection of
self-regulated learning (Zimmerman, 2002), and it should lead from awareness
to reflection, sensemaking and a change of behavior (Verbert et al., 2013).
Dashboards of learning analytics are rarely grounded in learning theory and
rarely evaluated well (Matcha et al., 2020); for this reason the feedback
takes its questions from these theories.

*Status:* established theories. The effect of the feedback is a hypothesis.

### The declaration of the use of AI

The declaration is a text that the reflection tool writes from the measures,
not from memory. It states the AI tools and models from the history, the
original work and the routine work of the AI with their shares and their
sections or files, and the roles in the terms of CRediT and GAIDeT: for each
role, the author, the AI, or both, and which work of the AI the author
directed and checked. Steps of unknown source are named with their number.
Markdown Paper adds the declaration and the views to the appendix of the
PDF.

**Basis.** The roles use the taxonomies of CRediT (Brand et al., 2015) and
GAIDeT (Suchikova et al., 2025). The declaration comes from the history,
because people who write with AI declare themselves as authors even when
they do not feel ownership of the text of the AI (Draxler et al., 2024).

*Status:* established taxonomies and a finding.

## 10. The check of the rules

**How it works.**

1. Two people code a sample of episodes on their own, with the rules and
   without the result of the classifier. *(proposal)* The sample holds at
   least 100 episodes, from several authors, with texts and code.
2. Krippendorff's alpha measures the agreement of the two people and of the
   classifier, for each code, each role and the class.
3. Where the agreement is low, the definitions and the examples of the rules
   improve, and the check runs again with a new sample.
4. The report shows the alpha of the rules in use. From 0.800 the results
   are reliable. From 0.667 they are tentative, and the report marks them
   so. Below 0.667 the reflection tool does not use the rules.

An institution or a course may bring rules of its own; they need their own
check.

**Basis.** Krippendorff's alpha is a standard measure of the agreement of
coders (Hayes & Krippendorff, 2007). An alpha of 0.800 is the usual limit
for reliable data, and an alpha from 0.667 allows only tentative conclusions
(Krippendorff, 2004, p. 241).

*Status:* established method.

## 11. Corrections

*(proposal)* The author may correct a classification with a reason. The
correction is a step of the history. The report shows the classification
and the correction side by side; in an assignment, the teacher sees both.
The corrections of many authors show where the rules need better
definitions or examples.

**Basis.** A correction by the author follows member checking, where the
participants of a study check the interpretation of their own data (Birt et
al., 2016).

*Status:* established method.

## 12. Assignments

**How it works.** A student works on an assignment, a text or a program, and
submits it with its history. The teacher runs the reflection tool with the
rules of the course, and the student sees the same report as the teacher.
*(proposal)* The teacher evaluates all submissions of a course in one run,
on the command line or on a server. The rules of a course, which reach the
reflection tool through an adapter (see below), may state:

- the level of AI use that the assignment allows, and the report shows the
  work beside this level;
- goals, for example a minimum share of own intellectual work;
- *(proposal)* the learning objectives of the assignment, each with the
  level that it aims at on the scale of the cognitive process (section 4),
  and the parts of the work that serve each objective, for example the
  requirements of its README; the report then shows for each objective its
  level next to the cognitive processes that the student and the AI carried
  out on its work;
- whether the teacher may see an overview of the course that compares
  students.

**Where the context comes from.** *(proposal)* The reflection tool knows no
course. The learning objectives, their levels, the parts of the work and the
allowed level of AI use come from an adapter: a program of the course, of
Markdown Paper or of another kind of work that reads its files and gives
this context to the reflection tool. For example, an extension of a course
reads the README files of the course and of the assignment. With this
context, the classifier also gives each episode the parts of the work that
it works on, so that each part of the work belongs to an objective. Without
an adapter, the report shows the work without objectives
([R-REFL-021](reflection.md#r-refl-021)).

**Basis.** The levels of AI use come from the AI Assessment Scale (Perkins
et al., 2024). The levels of the learning objectives use the revised
taxonomy of Bloom (Krathwohl, 2002).

*Status:* established framework.

## 13. Data and limits

**Data.** The reflection tool uses a history only when the student submits or
shares it. It can delete a history and its analysis. Its views compare no
persons unless the rules of the course allow it.

**Limits.** The reflection tool describes how a text or a program was made
in the editor. It does not measure what the author has learned, and it is no
grade. Work outside the editor, on paper, in talks or with other AI tools,
is not in the history. *(proposal)* Before the indicators are used in
teaching, a study compares them with tests or grades.

**Basis.** The rules on the data follow the ethics of learning analytics:
informed consent, transparency, privacy and the management of the data
(Slade & Prinsloo, 2013), and the DELICATE checklist for trusted learning
analytics (Drachsler & Greller, 2016). Counts of activity are no measure of
learning without a theory of learning (Gašević et al., 2015).

*Status:* established frameworks and position.

## Sources

Each source was checked at doi.org or in a registry of publications.
Peer-reviewed work comes first; a book is marked as such.

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
