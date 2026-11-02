<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Scientific basis of the evaluation

This document is the documentation of the scientific basis of the
evaluation plugin of the history ([evaluation plugin](evaluation.md)). For
each method of the plugin, it explains the published work that the method
rests on and how far this work carries the method. The requirements, the
views and the declaration of the plugin cite no literature; they refer to
this document ([R-EVAL-019](evaluation.md#r-eval-019)), and each view links
to the section that explains it. Each source was checked at doi.org or in a
registry of publications.

## 1. Status

The status tells how far the science carries a method:

| Status | Meaning |
| --- | --- |
| Established | An established method, theory or framework |
| Finding | An empirical result |
| New | Established work combined in a new way; it needs the check against people ([R-EVAL-006](evaluation.md#r-eval-006)) |
| Hypothesis | Not tested by any study yet |

Peer-reviewed work comes first. A book, a preprint or a guideline is marked
as such in the [sources](#sources). Indicators from the traces of work must
rest on a theory of learning, because counts of activity alone are no valid
measure of learning (Gašević et al., 2015).

## 2. Classification

### Two classes

[R-EVAL-002](evaluation.md#r-eval-002). The term "routine work" follows the
routine tasks of labor economics: tasks that follow explicit rules, so that
a program can do them (Autor et al., 2003). The levels of the cognitive
process come from the revised taxonomy of Bloom (Krathwohl, 2002).

*Status:* new. The terms are established; the border between the classes
for work with AI comes from the rules and their check.

### Three codes

[R-EVAL-003](evaluation.md#r-eval-003). The cognitive process follows the
revised taxonomy of Bloom (Krathwohl, 2002). The stage of the work follows
the four types of automation of Parasuraman, Sheridan and Wickens (2000).
The type of revision, a surface change or a meaning change, follows the
taxonomy of revisions of Faigley and Witte (1981).

*Status:* new. Established schemes in a new combination.

### The classifier

[R-EVAL-004](evaluation.md#r-eval-004). Large language models can code text
with an accuracy and an agreement above those of crowd workers (Gilardi et
al., 2023), but the result depends on the task; for this reason the
classifier must pass the check against people. The rules have the form of a
codebook of qualitative analysis, with a definition and examples of each
code (MacQueen et al., 1998). The episode as the unit of the classification
follows the analysis of logs of the writing process (Leijten & Van Waes,
2013) and of logs of writing sessions with a language model (Lee et al.,
2022).

*Status:* established methods. The accuracy for this task is known only
after the check.

### Corrections

[R-EVAL-005](evaluation.md#r-eval-005). A correction by the author follows
member checking, where the participants of a study check the interpretation
of their own data (Birt et al., 2016).

*Status:* established method.

### Check against people

[R-EVAL-006](evaluation.md#r-eval-006). Krippendorff's alpha is a standard
measure of the agreement of coders (Hayes & Krippendorff, 2007). An alpha
of 0.800 is the usual limit for reliable data, and an alpha from 0.667
allows only tentative conclusions (Krippendorff, 2004, p. 241).

*Status:* established method.

### Roles

[R-EVAL-018](evaluation.md#r-eval-018). Roles are the established form to
attribute contributions in research (Brand et al., 2015). With AI, checking
information, integrating answers and steering the task become a large part
of the critical thinking of a person (Lee et al., 2025). An accept without a
check is recorded as such, because people often accept the output of
automation and of AI without a check (Parasuraman & Manzey, 2010; Buçinca et
al., 2021).

*Status:* new. Established roles and findings, used as codes of a history.

## 3. Evaluation

### Class and origin

[R-EVAL-007](evaluation.md#r-eval-007). The combination of class and origin
shows which cognitive work the author moved to the AI, in the sense of
cognitive offloading: an action that reduces the cognitive demand of a task
(Risko & Gilbert, 2016).

*Status:* established theory.

### Origin of the final text

[R-EVAL-008](evaluation.md#r-eval-008). Only a meaning change moves text to
the other party, after the taxonomy of revisions of Faigley and Witte
(1981).

*Status:* established method.

### Declaration

[R-EVAL-009](evaluation.md#r-eval-009). The roles of the declaration use the
terms of CRediT (Brand et al., 2015) and GAIDeT (Suchikova et al., 2025).
The declaration comes from the history and not from memory, because people
who write with AI declare themselves as authors even when they do not feel
ownership of the text of the AI (Draxler et al., 2024).

*Status:* established taxonomies and a finding.

## 4. Views and feedback

### The views

[R-EVAL-010](evaluation.md#r-eval-010). The timeline follows the
visualizations of the writing process in keystroke logging (Leijten & Van
Waes, 2013), and the views as a whole follow the dashboards of learning
analytics (Verbert et al., 2013). Every view also works without color,
because about 8% of men of European origin have a red-green color
deficiency (Birch, 2012).

*Status:* established methods and a finding.

### Formative feedback

[R-EVAL-011](evaluation.md#r-eval-011). The three questions of the feedback
(where am I going, how am I going, where to next) come from the model of
feedback of Hattie and Timperley (2007). The views support the
self-reflection of self-regulated learning (Zimmerman, 2002), and they
should lead from awareness to reflection, sensemaking and a change of
behavior (Verbert et al., 2013). Dashboards of learning analytics are rarely
grounded in learning theory and rarely evaluated well (Matcha et al., 2020);
the views therefore take their questions from the theories above.

*Status:* established theories. The effect of the views is a hypothesis.

### Indicators

[R-EVAL-012](evaluation.md#r-eval-012). No study shows yet that these
indicators measure learning; each one is a hypothesis with this basis:

| Indicator | Hypothesis | Basis |
| --- | --- | --- |
| The share of own intellectual work, and its trend | Learning effect: the author does more of the intellectual work over time | Offloading of work to AI can harm learning (Bastani et al., 2025) and goes with less critical thinking (Gerlich, 2025) |
| The cognitive processes of the own episodes, and their trend | Learning effect: the author moves from remember and apply to analyze, evaluate and create | The revised taxonomy of Bloom (Krathwohl, 2002) |
| The share of AI answers that the author rejects or changes in their meaning | Critical evaluation of the output of the AI | Checking and integrating AI answers as critical thinking (Lee et al., 2025) |
| *(proposal)* The share of AI answers that the author accepts without a check | Reliance on the AI without critical evaluation | Automation bias (Parasuraman & Manzey, 2010) and overreliance on AI (Buçinca et al., 2021) |
| The share of the time on intellectual work, and the time of routine work that the AI took over | Learning efficiency: time free for intellectual work | Offloading reduces the cognitive demand of a task (Risko & Gilbert, 2016), but it can also harm learning (Bastani et al., 2025) |

*Status:* hypothesis.

### Limits of the indicators

[R-EVAL-013](evaluation.md#r-eval-013). Counts of activity are no measure of
learning without a theory of learning (Gašević et al., 2015).

*Status:* established position.

## 5. Assignments and data

### Assignments

[R-EVAL-014](evaluation.md#r-eval-014). The levels of AI use that an
assignment allows come from the AI Assessment Scale (Perkins et al., 2024).
The declaration from the history follows the finding of Draxler et al.
(2024) in the section [Declaration](#declaration).

*Status:* established framework and a finding.

### Data of the students

[R-EVAL-015](evaluation.md#r-eval-015). The rules on the data follow the
ethics of learning analytics: informed consent, transparency, privacy and
the management of the data (Slade & Prinsloo, 2013), and the DELICATE
checklist for trusted learning analytics (Drachsler & Greller, 2016).

*Status:* established frameworks.

### API and package

[R-EVAL-016](evaluation.md#r-eval-016) and
[R-EVAL-017](evaluation.md#r-eval-017) are technical decisions and follow
the rules of all nimblescape repositories
([R-GEN-007](specification.md#r-gen-007)).

*Status:* not applicable.

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
