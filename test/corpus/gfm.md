---
title: The parts of GFM
tags: [test, gfm]
---

<!-- DOCTYPE nimblescape-markdownnotes v1.0.0 -->

# A heading with *emphasis* and `code`

Setext heading
--------------

A paragraph with __strong__ text, _emphasis_, ~~strikethrough~~, a [link](https://example.com "title"),
an autolink <https://example.com>, a bare address https://example.com and a footnote.[^1]
A second line of the same paragraph with a hard break  
and a backslash break\
and an image ![alt *text*](images/figure.png "Figure").

> [!NOTE]
> A GitHub alert with a [reference link][ref].

* a bullet list with stars
* second item

  with a second paragraph

1) an ordered list
2) with parentheses

- [ ] a task
- [x] a finished task

+ a nested list
  + inner item
    + innermost item

| Left | Center | Right | None |
|:-----|:------:|------:|------|
| a    |   b    |     c | d \| e |
| `x`  | **y**  |  [z](https://example.com) | |

```js title="example.js"
const fence = '```';
```

~~~
tilde fence
~~~

    indented code

***

<details>
<summary>HTML block</summary>

Markdown inside HTML.

</details>

Inline <kbd>Ctrl</kbd>+<kbd>C</kbd> and <wbr><!--[note-7k2q green-->marked text[^note-7k2q] and an entity &copy;.

[^1]: The footnote, with
    a second line.

    And a second paragraph.

[^note-7k2q]: **scalarion** · 2026-11-01 10:00

[ref]: https://example.com/reference "Reference"
