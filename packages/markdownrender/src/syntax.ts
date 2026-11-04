// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The syntax colors of code blocks (docs/rendering.md, R-REN-001; docs/editor.md, R-EDIT-003): the common languages of
// highlight.js, the same for the renderer and for the editor, which gives them to lowlight. A code block without a
// language, or with a language that is not in the list, has no colors, as on GitHub: nothing guesses its language.

import type { LanguageFn } from 'highlight.js';
import HighlightJs from 'highlight.js/lib/core';
import arduino from 'highlight.js/lib/languages/arduino';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import graphql from 'highlight.js/lib/languages/graphql';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import less from 'highlight.js/lib/languages/less';
import lua from 'highlight.js/lib/languages/lua';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import objectivec from 'highlight.js/lib/languages/objectivec';
import perl from 'highlight.js/lib/languages/perl';
import php from 'highlight.js/lib/languages/php';
import phpTemplate from 'highlight.js/lib/languages/php-template';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import pythonRepl from 'highlight.js/lib/languages/python-repl';
import r from 'highlight.js/lib/languages/r';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import vbnet from 'highlight.js/lib/languages/vbnet';
import wasm from 'highlight.js/lib/languages/wasm';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

/** syntaxLanguages are the languages of the syntax colors by their names: the common languages of highlight.js. */
export const syntaxLanguages: Readonly<Record<string, LanguageFn>> = {
  arduino,
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  go,
  graphql,
  ini,
  java,
  javascript,
  json,
  kotlin,
  less,
  lua,
  makefile,
  markdown,
  objectivec,
  perl,
  php,
  'php-template': phpTemplate,
  plaintext,
  python,
  'python-repl': pythonRepl,
  r,
  ruby,
  rust,
  scss,
  shell,
  sql,
  swift,
  typescript,
  vbnet,
  wasm,
  xml,
  yaml,
};

const highlighter = HighlightJs.newInstance();
for (const [name, language] of Object.entries(syntaxLanguages)) {
  highlighter.registerLanguage(name, language);
}

/**
 * linesClosed ends the elements of the colors at the end of each line and opens them again on the next line, so that
 * each line of the code stands on its own: the number of a line of a listing stands in no element of a color, and a
 * page that breaks a code block breaks it between whole lines.
 * @param html - The HTML of highlight.js: text and elements `span`.
 */
function linesClosed(html: string): string {
  const open: string[] = [];
  return html.replace(/<span[^>]*>|<\/span>|\n/g, (part) => {
    if (part === '\n') {
      return `${'</span>'.repeat(open.length)}\n${open.join('')}`;
    }
    if (part === '</span>') {
      open.pop();
    } else {
      open.push(part);
    }
    return part;
  });
}

/**
 * highlightCode returns the code of a code block with the syntax colors of its language, as elements with the classes
 * `hljs-*` of highlight.js, or an empty string for a code block without colors. It is the function `highlight` of the
 * options of markdown-it, which escapes the code itself for an empty string.
 * @param code - The code.
 * @param language - The language: the first word of the info string of the code block.
 */
export function highlightCode(code: string, language: string): string {
  if (!language || !highlighter.getLanguage(language)) {
    return '';
  }
  return linesClosed(highlighter.highlight(code, { language, ignoreIllegals: true }).value);
}
