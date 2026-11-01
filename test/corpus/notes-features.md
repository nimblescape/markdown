<!--
SPDX-License-Identifier: MIT
© 2026 Hannes Stauss (scalarion@nimblescape.com)
Licensed under the MIT License. See LICENSE in the repository root for details.
-->

# Requested features and their state

This document lists each feature that Hannes asked for in the threads of the
project, with the date of the request, the requirement in
[requirements.md](requirements.md) that describes it, and its state on
2026-10-31. [specification.md](specification.md) summarizes the requirements
that are still valid. The requests for the paper workflow, such as the
layouts, the sections without chapter numbers, the lists of figures and
tables, the folders of a paper project and the citations, belong to
nimblescape Markdown Paper and its specification. The [user guide](guide.md) describes how to use the features that
are built; the [format](format.md) describes the notes in the file.

Of 138 requested features, 116 are built, among them the clean editing view
([decision 27](requirements.md#decisions)), which fixes the bug of the line
breaks and the cursor next to the hidden markers in the text editor, the
standard footnotes in the side view, the API for nimblescape Markdown
Paper, the figures, tables and sections with the links to them (to a
section by the ID that GitHub gives its heading), the
values of the front matter in the text, the listings of code from the
source files of the repository with the snippets in them, and the numbers of
the captions and the cite of a listing in the file by the principle "document driven", and
the hidden form of the notes with the eye in the side view, which hides the
notes from other viewers, also from GitHub, the text of a file without its
notes for publishing, the checks of the standard footnotes with
"Renumber Footnotes", and the listings of files of other repositories from
the clones of the command `mp` of nimblescape Markdown Paper, which open in a
new window, and the read-only front matter of the clean editing view. No feature is
planned and not built. The symbols of a listing with tree-sitter parsers are
postponed ([decision 51](requirements.md#decisions)), the feature of the
section [Planned features](#planned-features).
Three questions are decided without a
change of the code: there is no release for now, so the npm package is
installed from GitHub only ([decision 48](requirements.md#decisions)); the
user turns on a setting of VS Code for the width of the text editor in Zen
Mode, which the user guide and the README name
([decision 49](requirements.md#decisions)); and the comment of the format
stays a comment and does not become front matter
([decision 50](requirements.md#decisions)). 11 requests were replaced or
dropped by later decisions of Hannes; each row names the decision. 7 requests
moved to nimblescape Markdown Paper: the citations, the sources, the line
numbers of a rendered listing, and the generated lists
([decision 32](requirements.md#decisions), [decision 35](requirements.md#decisions),
[decision 42](requirements.md#decisions), [decision 45](requirements.md#decisions)).

The planned feature that stays open is the symbols of a listing with
parsers (step 61, postponed).

The columns of the tables:

- **Request**: what Hannes asked for, as a short summary. The words of the
  requests stay in the discussion documents in Claude.
- **Asked**: the date (month-day) and, where known, the time (UTC) of the
  request.
- **Spec**: the requirement or requirements that describe the feature.
- **State**: Built (in the branch of the pull request), Bug (built, with an
  open bug), Planned (in the specification and the [plan](requirements.md#plan),
  not built), Needs Hannes (an action that only Hannes can take), Decided
  (Hannes decided it, and the code does not change), Postponed (Hannes moved
  it to a later time), Replaced (a
  later decision changed the request), Dropped (a later decision removed it),
  Moved (the request belongs to nimblescape Markdown Paper).
- **Detail**: the setting, the decision or the cause behind the state.

A change of a feature or of its state updates its row in this document.

## Side view

The side view has what Hannes asked for, also the visual editing of
2026-10-30 with the editor of the VS Code Markdown Editor
([decision 52](requirements.md#decisions)). The tooltips, the lighter dimming and the list that scrolls on its own came on
2026-10-29 (commit
[a508cdf](https://github.com/nimblescape/markdownnotes-vscode/commit/a508cdf)),
the header with the filters and the smooth scrolling of the text in the
evening of 2026-10-29.

| Request | Asked | Spec | State | Detail |
| --- | --- | --- | --- | --- |
| The view in the secondary side bar, beside the chat, so that the Explorer stays free | 10-28 11:33 | [R-SIDE-001](requirements.md#r-side-001) | Built | |
| One button that shows and hides the view, also in Zen Mode | 10-28 | [R-SIDE-006](requirements.md#r-side-006) | Built | "Show or Hide Notes" in the title of the editor |
| The view as the only place of the text of the notes | 10-28 19:58 | [R-GEN-009](requirements.md#r-gen-009) | Built | |
| Answers of different authors as a tree, as on Reddit | 10-28 13:27 | [R-NOTE-004](requirements.md#r-note-004) | Built | |
| Icons for all buttons, with tooltips | 10-28 20:06, 10-29 09:00 | [R-SIDE-002](requirements.md#r-side-002) | Built | The tooltips of the browser did not show on macOS; the view now draws its own |
| The text view of the whole note, which the user can change | 10-28 20:06 | [R-SIDE-002](requirements.md#r-side-002) | Built | |
| Visual editing of the rendered Markdown in the side view, as in the Markdown Editor of VS Code | 10-28, 10-30 18:29 | [R-SIDE-004](requirements.md#r-side-004) | Built | Step 14: the tab "Visual" with the editor of the mode "Markdown Editor" of VS Code, a toolbar and Ctrl+B, Ctrl+I, Ctrl+E, Ctrl+K ([decision 52](requirements.md#decisions)) |
| A color for each note, chosen in the view | 10-28 20:03 | [R-TEXT-006](requirements.md#r-text-006) | Built | |
| Links in the notes open, files in a new window | 10-28 14:38 | [R-SIDE-005](requirements.md#r-side-005) | Built | Setting `openLinksIn` |
| "Add Note" (+) in the title of the view | 10-28 19:58 | [R-SIDE-003](requirements.md#r-side-003) | Built | |
| The selected note at the top of the view | 10-28 | [R-SIDE-001](requirements.md#r-side-001) | Built | |
| A click on the empty part of the view, or Escape, deselects the note | 10-28 | [R-SIDE-007](requirements.md#r-side-007) | Built | |
| The other notes dimmed while one is selected | 10-28, 10-29 09:06 | [R-SIDE-007](requirements.md#r-side-007) | Built | Opacity 70 % instead of 50 % |
| Each thread that is not selected dimmed, also under the pointer; with the view open, the cursor that moves into a highlight selects its thread and scrolls the view to it | 10-29 18:12 | [R-SIDE-007](requirements.md#r-side-007) | Built | The view showed a new selection late: it asked VS Code for the GitHub session each time; now once for each change of the sessions |
| Which thread belongs to which highlight: first a funnel, then the view aligned to the text with a line | 10-28 11:38, 19:50 | [R-SIDE-007](requirements.md#r-side-007) | Replaced | By [decision 25](requirements.md#decisions) (10-29 09:06): a list that scrolls freely |
| The view scrolls on its own and smoothly | 10-29 09:03 | [R-SIDE-007](requirements.md#r-side-007) | Built | The list follows only a click or a move of the cursor into a highlight |
| A click on a thread selects it in the view | 10-29 16:30 | [R-SIDE-007](requirements.md#r-side-007) | Built | A bug of the clean editing view: the view got no new state after the click |
| The icon of the Markdown preview on the button "Preview" of the editors | 10-29 16:32 | [R-SIDE-002](requirements.md#r-side-002) | Built | The codicon "preview" of the mode "Markdown Preview" in place of "open-preview" (to the side); all icons of the view as VS Code 1.144 draws them |
| A header that stays at the top of the view while the list scrolls, the search field in a second row over the full width | 10-29 17:56, 18:07 | [R-SIDE-008](requirements.md#r-side-008) | Built | The name of the file, the todo filter, the color filter and "Clear Filter" in the first row |
| A filter by the color of the notes | 10-29 17:56 | [R-SIDE-008](requirements.md#r-side-008) | Built | One dot for each color that the notes of the file use; more than one dot shows the notes of each pressed color |
| A search in the full text of the notes | 10-29 17:56 | [R-SIDE-008](requirements.md#r-side-008) | Built | The text and the authors of all answers, without regard to case; each typed word must be in the note; Escape clears the field |
| A todo filter | 10-29 17:56, 18:04 | [R-SIDE-008](requirements.md#r-side-008) | Built | |
| The two todo filters exclude each other | 10-29 19:48 | [R-SIDE-008](requirements.md#r-side-008) | Built | A click on one box turns the other one off; before, both together showed all todo notes |
| The filters together, and a button that clears them | 10-29 17:56 | [R-SIDE-008](requirements.md#r-side-008) | Built | "Clear Filter" (X); the selected thread always shows; the filter stays when the view is hidden and shown again |
| Smooth scrolling of the text | 10-29 19:01 | [R-SIDE-007](requirements.md#r-side-007) | Built | VS Code scrolls a text editor smoothly only with its setting `editor.smoothScrolling`, which the extension now turns on for Markdown files; the preview scrolls smoothly unless the system asks for less motion |
| The text editor scrolls smoothly over the whole way | 10-29 19:50 | [R-SIDE-007](requirements.md#r-side-007) | Built | VS Code scrolls a text editor in 125 milliseconds and jumps over most of a long way; the extension now scrolls it itself in small steps, in about half a second, slowly at the start and at the end (checked in VS Code 1.144) |
| The view that a double click opens scrolls to the note | 10-29 19:26 | [R-SIDE-007](requirements.md#r-side-007) | Built | A hidden view cannot scroll; the view now scrolls to a thread that was selected while it was hidden when it shows again |
| The width of the text editor in Zen Mode when the side view opens | 10-29 19:29 | [R-SIDE-001](requirements.md#r-side-001) | Decided | [Decision 49](requirements.md#decisions) (10-30 18:22), step 74: the user turns on the setting `"workbench.editor.centeredLayoutFixedWidth": true` of VS Code, which keeps the width (checked in VS Code 1.144: 900 pixels with the side view, 701 in place of 884 without the setting); the user guide and the README name the issue and the setting. The extension does not set it, because it changes the centered layout of all files |

## Text editor

The text editor has what Hannes asked for. Since 2026-10-29, a Markdown file
with notes opens in the clean editing view, which fixes the bug of the line
breaks and the cursor next to the hidden markers.

| Request | Asked | Spec | State | Detail |
| --- | --- | --- | --- | --- |
| Line breaks and editing next to the hidden markers | 10-29 09:09 | [R-TEXT-005](requirements.md#r-text-005) | Built | VS Code wraps a line by all its characters, also the hidden ones, so a row ended early. Fixed by the clean editing view of [decision 27](requirements.md#decisions) (10-29 09:37), which shows no hidden characters |
| The notes markup has no effect on the editing | 10-29 09:17 | [R-TEXT-009](requirements.md#r-text-009) | Built | [Decision 27](requirements.md#decisions): the clean editing view, step 38 of the plan; a prototype shown at 10:20, the full build checked in VS Code 1.144. Its limits are in [R-TEXT-009](requirements.md#r-text-009) |
| A form for the front matter | 10-31 08:04, 11:33 | [R-TEXT-009](requirements.md#r-text-009) | Built | Step 82, [decision 59](requirements.md#decisions): the view "Front Matter" of nimblescape Markdown Paper in the side bar holds the form; Markdown Notes shows the link "Edit Front Matter" above the read-only front matter of the clean editing view, which opens it, and "Open File with Markup" without Markdown Paper |
| The front matter read-only in the clean editing view | 10-31 07:54, 08:01, 08:03 | [R-TEXT-009](requirements.md#r-text-009) | Built | Step 81, [decision 58](requirements.md#decisions): an edit that changes, removes or adds a front matter goes back as a whole, the status bar names "Open File with Markup", and one Undo goes over such an edit; the discussion and a form for the values are in Claude Docs |
| A file with notes always in the clean editing view | 10-29 11:11 | [R-TEXT-009](requirements.md#r-text-009) | Built | From the Explorer, a search, a link, the last session and the first note; "Open File with Markup" in the Command Palette shows the file itself, and the view of the changes of git shows the file |
| A better icon for "Show Highlights" | 10-29 08:57 | [R-GEN-011](requirements.md#r-gen-011) | Built | [Decision 26](requirements.md#decisions) (10-29 09:35): a highlighter pen from an icon font of the extension, in place of the eye; commit [8ab9937](https://github.com/nimblescape/markdownnotes-vscode/commit/8ab9937) |
| Notes always collapsed | 10-28 20:02 | [R-TEXT-005](requirements.md#r-text-005) | Built | Also at the start of VS Code (10-28 14:37) |
| Markers and header lines never editable; the cursor steps over them; Backspace and Delete act on the other side | 10-28 | [R-NOTE-006](requirements.md#r-note-006) | Built | In the text editor of the file itself; the clean editing view shows no markers |
| The header of an answer written by the extension and shown rendered | 10-28 11:51 | [R-TEXT-007](requirements.md#r-text-007) | Built | |
| Highlights, as with a marker pen, with good contrast, and buttons that show and hide them | 10-28 20:00, 20:18 | [R-GEN-011](requirements.md#r-gen-011) | Built | Setting `showHighlights` |
| A hidden highlight shows under the pointer | 10-28 20:29 | [R-GEN-011](requirements.md#r-gen-011) | Built | |
| "Show Highlights" and "Hide Highlights" deselect the note | 10-29 19:51 | [R-GEN-011](requirements.md#r-gen-011) | Built | In the text editor, the preview and the side view; the open editors of the side view stay |
| Closing the side view hides the highlights | 10-28 20:31 | [R-GEN-011](requirements.md#r-gen-011) | Replaced | By [decision 28](requirements.md#decisions) (10-29 16:33): the highlights do not depend on the side view |
| "Show Highlights" only shows the highlights | 10-29 16:33 | [R-GEN-011](requirements.md#r-gen-011) | Built | [Decision 28](requirements.md#decisions), step 39 of the plan |
| A click on a highlight selects its note and opens the side view; a click outside deselects it | 10-28, 20:32 | [R-SIDE-007](requirements.md#r-side-007) | Replaced | By [decision 29](requirements.md#decisions) (10-29 17:49): a click selects, a double click opens the side view |
| Only a double click opens the side view, in the text editor and in the preview | 10-29 17:49, 18:59 | [R-SIDE-007](requirements.md#r-side-007), [R-PREV-003](requirements.md#r-prev-003) | Built | [Decision 29](requirements.md#decisions), step 41 of the plan. VS Code tells an extension no double click in the text editor: the extension reads one from the word that the second click selects. Two bugs fixed in step 46: VS Code reports no first click on the place of the cursor, and the cursor at the start of a highlight in the clean editing view stood outside the note |
| The cursor that leaves a highlight deselects its note | 10-29 17:48, 18:12 | [R-SIDE-007](requirements.md#r-side-007) | Built | Also with the keys; a note that the user selected in the side view stays while the keys move outside the notes |
| A note only for selected text | 10-28 20:25 | [R-EDIT-003](requirements.md#r-edit-003) | Built | |
| "Add Note" at the selected text: the light bulb (Ctrl+.), Shift+Alt+N (Cmd+K N on macOS), the context menu | 10-29 07:47 | [R-EDIT-006](requirements.md#r-edit-006) | Built | |
| A hover with color icons over the selected text | 10-28 20:27 | [R-EDIT-006](requirements.md#r-edit-006) | Replaced | By the light bulb above (10-29 07:47) |
| Warnings where GitHub shows a note differently | 10-28 | [R-TEXT-008](requirements.md#r-text-008) | Built | |
| Comment boxes as in GitHub pull requests, the Comments view | 10-28 | [R-TEXT-001](requirements.md#r-text-001) | Dropped | (10-28 19:58) |
| Colored numbers in the left margin | 10-28 14:51 | [R-TEXT-006](requirements.md#r-text-006) | Dropped | (10-28 20:01) |
| Markdown highlighting inside a note, dimming after the cursor | 10-28 | [R-TEXT-004](requirements.md#r-text-004) | Dropped | The text editor never shows a note |
| Todo notes | 10-29 17:56 | [R-NOTE-008](requirements.md#r-note-008) | Built | [Decision 30](requirements.md#decisions) (10-29 17:58). The state `todo` or `done` stands in the header of the first answer; a check box in the side view marks a todo completed or open again |
| Slash commands in the text editor with completion | 10-29 18:28 | [R-EDIT-008](requirements.md#r-edit-008) | Built | A slash at the start of a line or after a space shows the list of VS Code; Tab or Enter takes a command. (18:40) |
| `/date` and `/time` | 10-29 18:29 | [R-EDIT-008](requirements.md#r-edit-008) | Built | The local date `2026-10-29`, and the local date and time in minutes `2026-10-29 19:29` |
| `/user` inserts the GitHub login of the user | 10-29 18:29 | [R-EDIT-008](requirements.md#r-edit-008) | Built | The GitHub login of the user, the author of the notes; without a session, the sign-in of VS Code first |
| `/footnote` creates a footnote | 10-29 18:30 | [R-EDIT-008](requirements.md#r-edit-008), [R-FOOT-003](requirements.md#r-foot-003) | Built | After a word: the reference with the next free number and the definition after the last standard footnote. Since step 32, through the editor of the side view ([Footnotes](#footnotes)) |
| `/note` for selected text, and only for selected text | 10-29 18:30 | [R-EDIT-008](requirements.md#r-edit-008) | Built | The slash that replaced the selected text offers `/note` and `/todo`; the text comes back and the side view opens the editor of the new note. `/todo` without selected text takes the sentence before the slash |
| `/figure` and `/table` | 10-30 02:32 | [R-XREF-001](requirements.md#r-xref-001), [R-EDIT-008](requirements.md#r-edit-008) | Built | Step 50. Both on an empty line outside code; `/table` inserts a table of two columns after its caption line `Table: Caption` |
| `/figure` lists the images of the folder | 10-30 02:45 | [R-XREF-001](requirements.md#r-xref-001) | Built | The images of the workspace (PNG, JPEG, GIF, SVG, WebP, AVIF) by their paths from the folder of the file; the chosen one becomes `![Caption](path)` with the caption selected |
| A link to a figure or a table | 10-30 02:33 | [R-XREF-001](requirements.md#r-xref-001), [R-XREF-002](requirements.md#r-xref-002) | Built | `/ref` lists the figures and tables of the file and inserts `[Table 1](#tab-grades)`; a figure or table without an anchor first gets `<a id="tab-…"></a>` at the end of its caption line. The formatter writes the numbers of the links from the order in the file; the clean editing view hides the anchors |
| Values of the front matter in the text | 10-30 03:10 | [R-XREF-004](requirements.md#r-xref-004) | Built | Step 52, the form proposed at 03:20: `/ref` inserts `<wbr><!--{title}-->A paper<!--{/title}-->`, the formatter writes the current value, the clean editing view hides the markers |
| The functions of the notes in the pages of a paper | 10-30 03:55 | [R-PREV-009](requirements.md#r-prev-009) | Built | Step 55: the script of the preview finds the highlights and "Add Note" in the pages of Markdown Paper, which copies the content of the preview into its pages; checked in Chromium with copied pages |
| Code of the source files in the text | 10-30 02:58, 03:03, 03:10 | [R-CODE-001](requirements.md#r-code-001) | Built | Step 53: `/listing` lists the source files, then "Whole file" and the snippets of the file (the symbols of step 53 are removed in step 60), and inserts `Listing: Caption`, `<!-- listing: ../src/x.ts#name -->` and the code block; `/ref` links it as `[Listing 1](#lst-…)` |
| Snippets in the source code that a listing names | 10-30 02:58, 03:03, 03:20 | [R-CODE-003](requirements.md#r-code-003) | Built | Step 54, in the form of the proposal, decided at 06:20 ([decision 39](requirements.md#decisions)): `// markdownnotes: snippet name` and `// markdownnotes: /snippet name`, with the name in both marks. `/snippet` and "Add Snippet" write the marks; Ctrl+Click on the comment of a listing opens the source |
| Snippets and listings in more file types | 10-30 04:29, 04:30 | [R-CODE-003](requirements.md#r-code-003), [R-CODE-001](requirements.md#r-code-001) | Built | Step 57: the marks in the comment form of more than 80 file types, also by the name of a file (`.env`, `Dockerfile`, `Makefile`); the symbols of the languages with braces and of Python are removed in step 60 |
| `/snippet` from the start of VS Code | 10-30 07:31 | [R-CODE-003](requirements.md#r-code-003) | Built | Step 66, [decision 43](requirements.md#decisions): the extension starts with a workspace that holds a Markdown file, so that `/snippet` shows in a source file before a Markdown file opens |
| Snippets in any source | 10-30 04:30 | [R-CODE-003](requirements.md#r-code-003) | Built | Step 58: a file type that the extension does not know gets the comment form of VS Code for its language ("Add Line Comment") |
| Listings of files of other repositories, as references with revs in the front matter of the paper, which the command `mp` of nimblescape Markdown Paper clones; the link of the caption goes to the other repository at the commit of the clone | 10-30 07:34, 07:39; 10-31 02:32 to 04:07 | [R-CODE-006](requirements.md#r-code-006) | Built | Step 68, [decision 55](requirements.md#decisions), which replaces decision 46, and [decision 56](requirements.md#decisions): `<!-- listing: server:src/api.ts#read -->` reads the file from the clone in `.markdownpaper/repos/server/`, the caption links to GitHub at the commit of the clone, `/listing` lists the files of the clones by their references, and a missing reference or clone gets a warning with the npx command of Markdown Paper that fixes it |
| Open the clone of a reference in a new window | 10-31 07:52 | [R-CODE-006](requirements.md#r-code-006) | Built | Step 80, [decision 57](requirements.md#decisions): the clones stay full Git clones, which VS Code treats as ignored files in the window of the paper; Ctrl+Click on the name of the reference of a listing, `server` in `server:src/api.ts`, opens the clone in a new window, as the command "Open Repository in New Window" of Markdown Paper does |
| Snippets only in a clone on a branch | 10-31 11:44, 11:48 | [R-CODE-006](requirements.md#r-code-006) | Built | Step 83, [decision 60](requirements.md#decisions): "Add Snippet" and `/snippet` write nothing in a clone of a reference to a tag or a commit, with a message, and work in a clone on a branch; nimblescape Markdown Paper checks out a reference to a branch as that branch |
| The snippet as a tag in the source editor | 10-30 04:34 | [R-CODE-004](requirements.md#r-code-004) | Built | Step 58, [decision 37](requirements.md#decisions): a code lens above the start mark with the listings that show the snippet, the marks dimmed; replaced in step 62 by the tags in place of the mark lines |
| The mark as a tag in place of its line | 10-30 05:49, 05:57 | [R-CODE-004](requirements.md#r-code-004) | Built | Step 62: each mark line shows a tag in the small gray letters of a code lens in place of the comment, `snippet keep-lines · Listing 2 in paper/paper.md` and `/snippet keep-lines`; the line keeps its height, because VS Code cannot remove a line |
| Marks that cannot be edited | 10-30 05:49, 05:53 | [R-CODE-004](requirements.md#r-code-004) | Built | Step 62: the cursor jumps over the mark lines, Backspace and Delete next to them do nothing; "Rename Snippet" and "Remove Snippet" in the light bulb change the marks, and Rename also changes the listings |
| A click on the end tag | 10-30 05:57 | [R-CODE-004](requirements.md#r-code-004) | Built | Step 62: the cursor goes to the first line of the code of the snippet, and the start tag scrolls into view; a click on a start tag opens the listing |
| A toggle button that highlights the used snippets | 10-30 04:34 | [R-CODE-004](requirements.md#r-code-004) | Built | Step 58: "Show Used Snippets" and "Hide Used Snippets" in the title of the text editor of a source file with snippets |
| Listings of whole files and snippets, symbols only with parsers | 10-30 04:43, 05:38 | [R-CODE-005](requirements.md#r-code-005) | Built | Step 60, [decision 38](requirements.md#decisions): a listing shows a whole file or a snippet; the rules that found functions by their declarations are removed; the text editor warns at a listing whose file or snippet is not found |
| The formatter keeps the code blocks current | 10-30 02:59 | [R-CODE-002](requirements.md#r-code-002) | Built | Step 53: in VS Code (also from unsaved source files) and on the command line, which names a missing source and fails with `--check`; a snippet is found by its marks, the same way in both |
| The comment of a listing hidden in the clean editing view, and the caption as the link to the source | 10-30 06:36 | [R-CODE-001](requirements.md#r-code-001), [R-TEXT-009](requirements.md#r-text-009) | Built | Step 63, [decision 41](requirements.md#decisions): the view hides the comment and the `[` and `](…)` of the link of the caption, so that only the text of the caption is edited; Ctrl+Click on the caption opens the source at the snippet; `/listing` in the view writes the hidden parts into the file |
| The caption cites the source file and the lines, and the formatter keeps the lines current | 10-30 06:36, 06:40, 06:48 | [R-CODE-001](requirements.md#r-code-001), [R-CODE-002](requirements.md#r-code-002) | Built | Step 63: the caption is free text and a link to the source, `Listing: [Reading the fields](../src/fields.ts#L12-L30)`, so that a click on GitHub opens the lines; the formatter writes the link and its target, the text stays as written; the number of the caption came with step 64 |
| Line numbers in front of the code in the rendered listing | 10-30 06:30, 06:40 | [R-CODE-001](requirements.md#r-code-001) | Moved | [Decision 45](requirements.md#decisions): an option of the layout of nimblescape Markdown Paper, off by default, from 1 in each listing |
| The cite of the source after the caption, in the file | 10-30 06:43, 07:35 | [R-CODE-001](requirements.md#r-code-001), [R-CODE-002](requirements.md#r-code-002) | Built | Step 67, [decision 45](requirements.md#decisions): by the principle "document driven", the formatter writes `(fields.ts, L12-L30)` after the link of the caption and keeps it current; the clean editing view hides it with the link; Markdown Paper renders no cite of its own |
| The file holds everything, and the formatter keeps it current | 10-30 06:58, 07:03, 07:10 | [R-GEN-016](requirements.md#r-gen-016) | Built | [Decision 42](requirements.md#decisions): "document driven" with two limits: the formatter writes only what it computes from the file and its sources, and changes nothing that other files link to, so the headings get no numbers; the renderer adds only the look |
| Numbers in the captions | 10-30 06:48, 07:03 | [R-XREF-001](requirements.md#r-xref-001), [R-XREF-002](requirements.md#r-xref-002) | Built | Step 64: the formatter writes `Figure 1:`, `Table 2:` and `Listing 3:` (also `Abbildung`, `Tabelle`) from the order in the file; `/figure`, `/table` and `/listing` insert the next number |
| Figures get captions | 10-30 07:10 | [R-XREF-001](requirements.md#r-xref-001) | Built | Step 64: a caption line before the image, as APA 7 has it; an image without a caption is no figure; the formatter gives an image of the older form with an anchor a caption line from the text of the image |
| `/ref` for sections | 10-30 02:47, 03:19 | [R-XREF-003](requirements.md#r-xref-003) | Built | Step 51, changed by step 56: `[Chapter 2.1](#methods)`; the chapters are the headings of the highest level that more than one heading has |
| Links to headings without anchors | 10-30 03:28 | [R-XREF-003](requirements.md#r-xref-003) | Built | Step 56, [decision 36](requirements.md#decisions): the link names the ID that GitHub gives the heading, and the heading gets no anchor; an anchor of the earlier form still counts |
| Plain Markdown first | 10-30 03:29 | [R-GEN-013](requirements.md#r-gen-013) | Built | A rule for each new form in the file; the links to headings follow it |
| Decisions in the specification | 10-30 03:48 | [R-GEN-014](requirements.md#r-gen-014) | Built | A rule for this document and the requirements |
| Which command adds an entry and which adds a reference | 10-30 02:45, 02:47 | [R-XREF-001](requirements.md#r-xref-001) | Built | [Decision 35](requirements.md#decisions): the commands named by a noun add an entry, `/ref` and `/cite` add a reference |
| `/todo` at the start of the text of a new note in the side view | 10-29 17:58 | [R-NOTE-008](requirements.md#r-note-008) | Dropped | The part of [decision 30](requirements.md#decisions) (18:40) |

## Markdown preview and the modes of VS Code

The preview shows the highlights, selects a note on a click, and adds a note
to selected text. A line from a
highlight in the preview to its note is not possible: the preview tells an
extension no place of its text, and Hannes chose the list
([decision 25](requirements.md#decisions)).

| Request | Asked | Spec | State | Detail |
| --- | --- | --- | --- | --- |
| The highlights in the preview, faint, strong under the pointer | 10-28 16:36, 20:00 | [R-PREV-001](requirements.md#r-prev-001) | Built | |
| A click on a highlight selects its note in the side view and opens the view; a click outside deselects it | 10-28 | [R-PREV-003](requirements.md#r-prev-003) | Replaced | By [decision 29](requirements.md#decisions) (10-29 17:49): a click selects, a double click opens the side view and not the text editor |
| "Add Note" for selected text in the Markdown preview | 10-29 16:38 | [R-PREV-008](requirements.md#r-prev-008) | Built | A button "Add Note" above the selected text, in the preview to the side and in the mode "Markdown Preview" |
| The style sheets of `markdown.styles` in the preview of the clean editing view: a warning "Could not load 'markdown.styles': .vscode/markdown-serif.css" | 10-29 17:43 | [R-TEXT-009](requirements.md#r-text-009) | Built | A bug of the clean editing view: its preview looked for the style sheet in the folder of the file, and showed no images; the file system of the view now gives the preview these files |
| The buttons "Show Highlights" and "Hide Highlights" in the title of the preview | 10-28 20:00 | [R-PREV-005](requirements.md#r-prev-005) | Built | |
| The text without the notes; other footnotes as before | 10-28 | [R-PREV-004](requirements.md#r-prev-004) | Built | Markdown Footnotes in the extension pack ([R-GEN-008](requirements.md#r-gen-008)) |
| The side view follows the modes "Markdown Preview" and "Markdown Editor" | 10-28 | [R-PREV-006](requirements.md#r-prev-006) | Built | The mode "Markdown Editor" shows no highlights: it has no API for extensions |
| A click on a thread keeps the mode of the tab also in the clean editing view | 10-29 16:35 | [R-SIDE-007](requirements.md#r-side-007), [R-PREV-006](requirements.md#r-prev-006) | Built | A bug of the clean editing view: the tab of a mode holds the URI of the view, not of the file |
| Only additions: other Markdown extensions keep working | 10-28 | [R-GEN-007](requirements.md#r-gen-007) | Built | |
| A link from a highlight in the preview to its note | 10-29 09:03 | [R-SIDE-007](requirements.md#r-side-007) | Replaced | By [decision 25](requirements.md#decisions): the list; the click selects the note |
| Icons and callouts of the notes in the preview | 10-28 | [R-PREV-002](requirements.md#r-prev-002) | Dropped | (10-28 19:59) |

## Note format, formatter and command line

The format and the formatter are built. Nothing is published before the
release; until then, tests and AI agents build the npm package from a clone
of the repository. The npm package and the first release
need Hannes after the merge of
[pull request #1](https://github.com/nimblescape/markdownnotes-vscode/pull/1).

| Request | Asked | Spec | State | Detail |
| --- | --- | --- | --- | --- |
| Notes as Markdown footnotes, which GitHub shows | 10-28 12:47 | [R-NOTE-001](requirements.md#r-note-001) | Built | |
| A header with the GitHub login and the date with the time zone of the author | 10-28 | [R-NOTE-002](requirements.md#r-note-002) | Built | Sign-in: [R-GEN-006](requirements.md#r-gen-006) |
| A start marker for every note, always with `<wbr>`, the color in the marker, the reference as the end marker | 10-28 20:09-20:24 | [R-NOTE-006](requirements.md#r-note-006) | Built | |
| The comment of the format for AI agents, with a link to the specification | 10-28 16:25 | [R-NOTE-007](requirements.md#r-note-007) | Built | |
| The comment only with a change or a save, with the version `v1.0.0` as a semantic version | 10-29 07:36, 07:40 | [R-NOTE-007](requirements.md#r-note-007) | Built | |
| The comment of the format as front matter | 10-30 02:49 | [R-NOTE-007](requirements.md#r-note-007) | Decided | [Decision 50](requirements.md#decisions) (10-30 18:24), step 75: the comment stays, because GitHub shows the front matter of a Markdown file as a table at the top of the page; the front matter holds the data of a paper |
| An own formatter with format on save: tables, blank lines, one line per paragraph | 10-28 | [R-FMT-001](requirements.md#r-fmt-001) | Built | Also [R-FMT-002](requirements.md#r-fmt-002), [R-FMT-003](requirements.md#r-fmt-003) |
| Format on save only for files with notes | 10-29 06:37 | [R-FMT-001](requirements.md#r-fmt-001) | Built | Setting `formatOnSave` |
| The formatter for agents on the command line, as an npm package | 10-28 18:03, 19:05 | [R-FMT-004](requirements.md#r-fmt-004) | Built | `markdownnotes format`, installed from GitHub with a clone while there is no release (steps 71 and 73) |
| The package on npmjs.com and the first release of the extension | 10-28 19:05 | [R-GEN-005](requirements.md#r-gen-005) | Postponed | [Decision 48](requirements.md#decisions) (10-30 18:21), step 73: no release for now; the npm package is installed from GitHub only. The steps of the first publish stay in [CONTRIBUTING.md](../CONTRIBUTING.md#npmjscom-setup) |
| The extension ID `nimblescape.nimblescape-markdownnotes` | 10-30 02:04 | [R-GEN-005](requirements.md#r-gen-005) | Built | Step 47 |
| The new name of the repository, `markdownnotes-vscode` | 10-30 02:04, 09:37 | [R-GEN-005](requirements.md#r-gen-005) | Built | Step 70: Hannes renamed the repository on 2026-10-30, and the addresses in the manifests and the documents changed; the Marketplace setup runs again before the first release, which is not planned for now |
| Nothing published before the release; tests and other repositories install the package from the GitHub repository | 10-30 09:36 | [R-GEN-017](requirements.md#r-gen-017) | Built | [Decision 47](requirements.md#decisions), step 71: a clone at a fixed commit and `npm pack ./cli` |
| An API for other extensions | 10-29 22:15-22:16 | [R-GEN-012](requirements.md#r-gen-012) | Built | Version 1 with `fileOf`, `registerFormatStep`, `registerHiddenBlocks` and `registerSlashCommand`, for nimblescape Markdown Paper (steps 47 and 48) |
| `/research` of Markdown Paper on selected text, with its hidden start marker | 10-30 | [R-GEN-012](requirements.md#r-gen-012) | Built | Step 72: slash commands of other extensions with `selection: true`, and `registerHiddenMarkers` for markers that the clean editing view hides |
| A clean split; the citations and the sources go into nimblescape Markdown Paper | 10-29 22:11, 10-30 02:25 | [R-GEN-012](requirements.md#r-gen-012) | Built | [Decision 32](requirements.md#decisions); the format of the notes stays `v1.0.0`, and Markdown Paper adds the citations through the API |
| Names without a hyphen, "markdown-notes" → "markdownnotes" | 10-30 02:27, 02:30 | [R-GEN-005](requirements.md#r-gen-005), [R-FMT-004](requirements.md#r-fmt-004), [R-NOTE-007](requirements.md#r-note-007) | Built | [Decision 33](requirements.md#decisions), step 49: `@nimblescape/markdownnotes`, the command `markdownnotes`, the format `nimblescape-markdownnotes`, the scheme `markdownnotes` |
| One formatter command with two packages | 10-30 02:26 | [R-FMT-004](requirements.md#r-fmt-004) | Built | [Decision 34](requirements.md#decisions): the library `formatMarkdown` of `@nimblescape/markdownnotes`, which `markdownpaper format` calls before its own steps |
| All specifications as a spec doc in the repository | 10-30 02:38, 02:39 | [specification.md](specification.md) | Built | The summary links each point to its requirement |

## Footnotes

The side view is also the editor of the standard footnotes of a file, the
footnotes that are no note, since the evening of 2026-10-29 (steps 32 and 33
of the plan); the checks of the footnotes and "Renumber Footnotes" followed
on 2026-10-31 (step 34), and "Make Footnote" on the same day (step 35).

| Request | Asked | Spec | State | Detail |
| --- | --- | --- | --- | --- |
| Standard footnotes in the side view; show, edit, delete | 10-29 07:48 | [R-FOOT-001](requirements.md#r-foot-001), [R-FOOT-002](requirements.md#r-foot-002) | Built | Each footnote at the place of its first reference, with its label and the numbers of GitHub and of the preview in the tooltip; "Delete" asks first and removes the definition and every reference; no "Go to Definition", as for a note (, 20:26). Setting `showFootnotes`, and "Hide Footnotes" and "Show Footnotes" in the menu "…" of the title of the view ([decision 53](requirements.md#decisions)) |
| "Add Footnote" at the cursor | 10-29 08:01 | [R-FOOT-003](requirements.md#r-foot-003) | Built | Shift+Alt+B (Cmd+K B on macOS), the title of the side view, the context menu and the Command Palette; the editor of the new footnote in the side view, with the text before the place in its title |
| "Make Footnote": an accepted note becomes a standard footnote | 10-29 08:01 | [R-FOOT-006](requirements.md#r-foot-006) | Built | The button with the numbered list in the header of a thread; the first answer becomes the text, the reference of the note gets the next free number, the definition goes after the last one; a note with replies asks first; the side view selects the new footnote |
| `/footnote` opens the editor of the new footnote in the side view | 10-29 18:51 | [R-EDIT-008](requirements.md#r-edit-008), [R-FOOT-003](requirements.md#r-foot-003) | Built | The command leaves the text, and "Add Footnote" in the editor writes the reference and the definition |
| Citations as footnotes inside the highlight of a note | 10-29 20:12 | [R-FOOT-001](requirements.md#r-foot-001) | Built | It worked for GitHub, the preview and the formatter; the fix: the cursor on the reference selects the footnote, and the rest of the highlight the note. The citations themselves moved to nimblescape Markdown Paper ([decision 32](requirements.md#decisions)) |
| Checks of the footnotes and "Renumber Footnotes" | 10-29 08:01 | [R-FOOT-004](requirements.md#r-foot-004), [R-FOOT-005](requirements.md#r-foot-005) | Built | Step 34: warnings at a reference without a definition, a definition without a reference and a second definition of a label, in the text editor and the Problems view; the quick fixes "Add Definition" (the editor of a new definition in the side view) and "Delete Definition"; "Renumber Footnotes" in the Command Palette and the menu "…" of the side view, which refuses a reference of a number without a definition and a second definition of a number |
| The definitions of the footnotes hidden in the text | 10-29 20:42 | [R-TEXT-009](requirements.md#r-text-009), [R-FOOT-001](requirements.md#r-foot-001) | Built | In the clean editing view of a file with notes, while the side view shows the footnotes; the references stay, and a definition without a reference too. A definition typed in the view stays until the view reads the file anew. A file with only standard footnotes opens in its own text editor, with its definitions |

## Hidden notes

Hannes asked on 2026-10-29 at 08:01 for notes that other viewers do not
show ([decision 23](requirements.md#decisions)). Steps 29 and 30 of the plan
built them on 2026-10-31, before the first release, because they add the
word `hidden` to the format `v1.0.0`; step 31 built the text without notes on
the same day.

| Request | Asked | Spec | State | Detail |
| --- | --- | --- | --- | --- |
| The hidden form of the notes, which every viewer hides, also GitHub | 10-29 08:01 | [R-HIDE-001](requirements.md#r-hide-001), [R-HIDE-003](requirements.md#r-hide-003) | Built | Step 29: each definition in an HTML comment of its own, the end marker `<!--note-7k2q]-->`, the word `hidden` in the comment of the format, the escape of `-->` in the text of a note; the side view, the highlights, the preview, the clean editing view, the checks and the formatter read both forms. GitHub shows [example-hidden.md](example-hidden.md) without any part of its notes |
| An icon at the top of the side view that hides the notes from other viewers | 10-29 08:02 | [R-HIDE-002](requirements.md#r-hide-002) | Built | Step 30: the eye, or the eye with a stroke, in the title of the side view for a file with notes; a click writes all notes in the other form in one edit; the commands "Hide Notes from Other Viewers" and "Show Notes in Other Viewers"; the setting `hideNotesInNewFiles`. VS Code shows three buttons in the title at the default width of the secondary side bar, so "Show Footnotes" and "Hide Footnotes" moved into the menu "…" of the title ([decision 53](requirements.md#decisions)) |
| The text without notes for publishing: `markdownnotes strip`, "Copy without Notes" | 10-29 08:01 | [R-HIDE-004](requirements.md#r-hide-004) | Built | Step 31: `markdownnotes strip <file>` to the standard output, `-` for the standard input, `--out <folder>` for copies, and `stripNotes` in the library of the npm package; "Copy without Notes" and "Save Copy without Notes" in the Command Palette and in the menu "…" of the title of the side view. The text keeps the standard footnotes, the other comments, the anchors, the values of the front matter and the listings; a test compares its rendering with the Markdown preview |

## Planned features

1 feature is in the specification and the plan but not built: the symbols
of a listing with parsers are postponed
([decision 51](requirements.md#decisions)).

| Request | Asked | Spec | Plan step | State |
| --- | --- | --- | --- | --- |
| Symbols of a listing with parsers | 10-30 04:46, 05:36 | [R-CODE-005](requirements.md#r-code-005) | 61, no tree-sitter for now ([decision 51](requirements.md#decisions)) | Postponed |

## Moved to nimblescape Markdown Paper

Hannes decided on 2026-10-30 at 02:25 that the citations and the sources go
into nimblescape Markdown Paper ([decision 32](requirements.md#decisions)),
and at 02:47 that `/source` and `/cite` of Markdown Paper add a source and a
citation ([decision 35](requirements.md#decisions)); Markdown Paper later
dropped `/source` and has `/cite` and `/research`. Their code was built on 2026-10-29 in the form of links and handed to the
thread of Markdown Paper, which adds them through the API of this extension.
At 07:10 Hannes decided that the file holds the generated lists, which
Markdown Paper writes with its steps of the formatter
([decision 42](requirements.md#decisions)). The render hint in the comment of
the format is replaced there: the layout of Markdown Paper names the citation
style, as `"citationStyle"` in its `layout.json` or as a CSL file of the
layout, and the comment of the format names no style.

| Request | Asked | Spec | Plan step | State |
| --- | --- | --- | --- | --- |
| A metadata format for the sources | 10-29 18:55 | [R-EDIT-008](requirements.md#r-edit-008) | 45 | Moved |
| A render hint in the comment of the format, with a link to an instruction file of the style | 10-29 19:18 | [R-EDIT-008](requirements.md#r-edit-008) | 45 | Moved |
| "/research" adds a (RESEARCH) source, which instructs AI agents to find a suitable source for the argument before it | 10-29 18:33-18:39 | [R-EDIT-008](requirements.md#r-edit-008) | 45 | Moved |
| "/source" only lists the existing sources of the document and inserts one | 10-29 18:33, 18:37 | [R-EDIT-008](requirements.md#r-edit-008) | 45 | Moved |
| "/source" lists all files of the folder `bib/` | 10-30 02:45 | [R-XREF-001](requirements.md#r-xref-001) | | Moved |
| The table of contents, the list of figures, the list of tables and the list of listings in the file | 10-30 07:10, 07:11 | [R-GEN-016](requirements.md#r-gen-016) | 65 | Moved |

The later fixes of the code review of 2026-10-28, a queue of writes for each
file, tests of the scripts of the side view and of the preview, and ESLint,
change no feature. They are [R-GEN-018](requirements.md#r-gen-018), came
after step 35 ([decision 54](requirements.md#decisions)) and are built
(step 78).

## Open work and its order

The clean editing view (step 38, [decision 27](requirements.md#decisions))
is built, and
[pull request #1](https://github.com/nimblescape/markdownnotes-vscode/pull/1)
is merged. The hidden notes and the text without notes (steps 29 to 31) are
built in
[pull request #3](https://github.com/nimblescape/markdownnotes-vscode/pull/3),
which also takes steps 34 and 35: the checks of the footnotes, "Renumber
Footnotes" and "Make Footnote" are built there too, the fixes of the code
review (step 78), the listings of files of other repositories (step 68), the
clone in a new window (step 80), the read-only front matter (step 81) and its
link to the form of Markdown Paper (step 82), and the snippets only in a
clone on a branch (step 83),
while nimblescape Markdown Paper builds the command `mp` that clones them.
The open work:

1. There is no release for now ([decision 48](requirements.md#decisions));
   before the first release, the Marketplace setup runs again for the new
   name of the repository.

---

© 2026 Hannes Stauss (scalarion@nimblescape.com) ·
[MIT License](https://github.com/nimblescape/markdownnotes-vscode/blob/main/LICENSE).
