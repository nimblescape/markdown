// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the plugin API (docs/plugins.md, R-GEN-005, R-GEN-012, R-PLUGIN-001): the checks of the plugin object,
// the level "render" with its source, the level "render and edit" with nodes, commands, keys, menus and the front
// matter, the read-only generated parts (docs/editor.md, R-EDIT-011) and the threads beside the text (R-GEN-014).

import { Node as TiptapNode } from '@tiptap/core';
import type { Node } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type MarkdownIt from 'markdown-it';
import { type JsonSchema, TextSource } from '@nimblescape/markdowntext';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownEditor, type MarkdownEditorOptions } from '../editor';
import { replaceAll, setFind } from '../ui/find';
import { type GeneratedPart, type MarkdownPlugin, pluginParts } from './api';
import { generatedWrite } from './generated';

let editors: MarkdownEditor[] = [];
let element: HTMLElement;
afterEach(() => {
  editors.forEach((each) => each.destroy());
  editors = [];
  element?.remove();
  document.head.querySelectorAll('style[data-nsmd-plugin]').forEach((style) => style.remove());
});

/** open returns an editor in a page with a text and plugins. */
function open(markdown: string, plugins: MarkdownPlugin[], options: MarkdownEditorOptions = {}): MarkdownEditor {
  element = document.createElement('div');
  document.body.append(element);
  const editor = new MarkdownEditor(element, { markdown, plugins, ...options });
  editors.push(editor);
  return editor;
}

/** viewOf returns the view of an editor. */
const viewOf = (editor: MarkdownEditor): EditorView => editor.tiptap.view;

/** select puts the cursor or the selection at positions of the document. */
function select(editor: MarkdownEditor, from: number, to = from): void {
  const view = viewOf(editor);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
}

/** key sends a key to the editor as the browser does, and returns true when the editor used it. */
function key(editor: MarkdownEditor, name: string, init: KeyboardEventInit = {}): boolean {
  const view = viewOf(editor);
  return view.someProp('handleKeyDown', (handle) => handle(view, new KeyboardEvent('keydown', { key: name, ...init }))) ?? false;
}

/** type types a text at the cursor, as the browser does. */
function type(editor: MarkdownEditor, text: string): void {
  const view = viewOf(editor);
  for (const character of text) {
    const { from, to } = view.state.selection;
    const used = view.someProp('handleTextInput', (handle) => handle(view, from, to, character, () => view.state.tr.insertText(character, from, to)));
    if (!used) {
      view.dispatch(view.state.tr.insertText(character, from, to));
    }
  }
}

/** mathSyntax adds `$$` blocks and `$x$` inline math to markdown-it, as the token types math_block and math_inline. */
function mathSyntax(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
    const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
    if (lineText(startLine).trim() !== '$$') {
      return false;
    }
    let line = startLine + 1;
    while (line < endLine && lineText(line).trim() !== '$$') {
      line++;
    }
    if (!silent) {
      const token = state.push('math_block', 'div', 0);
      token.block = true;
      token.content = state.getLines(startLine + 1, line, 0, false);
      token.map = [startLine, Math.min(line + 1, endLine)];
    }
    state.line = Math.min(line + 1, endLine);
    return true;
  });
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    if (state.src[state.pos] !== '$') {
      return false;
    }
    const end = state.src.indexOf('$', state.pos + 1);
    if (end < 0) {
      return false;
    }
    if (!silent) {
      state.push('math_inline', 'span', 0).content = state.src.slice(state.pos + 1, end);
    }
    state.pos = end + 1;
    return true;
  });
}

/** math is a plugin of the level "render" for math and for diagrams of Mermaid. */
function math(rendered: string[] = []): MarkdownPlugin {
  return {
    name: 'math',
    apiVersion: 1,
    extendMarkdownIt: mathSyntax,
    styles: '.math { font-style: italic; }',
    render: {
      math_block: (source, target) => {
        rendered.push(source);
        target.append(Object.assign(document.createElement('span'), { className: 'math', textContent: `math(${source})` }));
      },
      math_inline: (source, target) => {
        target.textContent = `inline(${source})`;
      },
      'fence:mermaid': (source, target) => {
        target.textContent = `diagram(${source.trim()})`;
      },
    },
  };
}

describe('the plugin object', () => {
  it('needs a name of its own, the API version 1 and the commands of its keys', () => {
    const plugin: MarkdownPlugin = { name: 'one', apiVersion: 1 };
    expect(() => pluginParts([plugin, { ...plugin }])).toThrow(/two plugins with the name one/);
    expect(() => pluginParts([{ name: 'two', apiVersion: 2 as 1 }])).toThrow(/API version 2/);
    expect(() => pluginParts([{ name: 'with space', apiVersion: 1 }])).toThrow(/name/);
    expect(() => pluginParts([{ name: 'keys', apiVersion: 1, keys: { 'Alt-m': 'missing' } }])).toThrow(/command missing/);
    expect(pluginParts([{ name: 'cmd', apiVersion: 1, commands: { run: () => true }, keys: { 'Alt-m': 'run' } }]).keys.get('Alt-m')).toBe('cmd.run');
  });

  it('adds the styles of a plugin to the page once', () => {
    open('Text\n', [math()]);
    open('Text\n', [math()]);
    const styles = document.head.querySelectorAll('style[data-nsmd-plugin="math"]');
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain('.math');
  });

  it('activates each plugin with the editor and the platform, and disposes it with the editor', () => {
    const stop = vi.fn();
    const activate = vi.fn(() => stop);
    const editor = open('Text\n', [{ name: 'one', apiVersion: 1, activate }], { host: { platform: 'test' } });
    expect(activate).toHaveBeenCalledWith(editor, { platform: 'test' });
    editor.destroy();
    editors = [];
    expect(stop).toHaveBeenCalledOnce();
  });
});

describe('the level "render"', () => {
  const text = '# Title\n\n$$\nx^2\n$$\n\nText with $a$ and <img src=x onerror="alert(1)">.\n\n```mermaid\ngraph TD\n```\n\n```js\nlet a;\n```\n';

  it('keeps each block that a plugin shows as one unit with its text, and shows its rendering', () => {
    const rendered: string[] = [];
    const editor = open(text, [math(rendered)]);
    const doc = editor.tiptap.state.doc;
    expect([...Array(doc.childCount).keys()].map((index) => doc.child(index).type.name)).toEqual(['heading', 'rawBlock', 'rawBlock', 'rawBlock', 'codeBlock']);
    expect(rendered).toEqual(['x^2']);
    const units = element.querySelectorAll('.nsmd-unit-rendered');
    expect(units).toHaveLength(3);
    expect(units[0].querySelector('.math')?.textContent).toBe('math(x^2)');
    expect(units[1].querySelector('.nsmd-render')?.textContent).toBe('inline(a)');
    expect(units[2].textContent).toContain('diagram(graph TD)');
    expect(editor.getMarkdown()).toBe(text);
  });

  it('makes a code block that the user writes a unit when the cursor leaves it, when a plugin shows its language', () => {
    const editor = open('Text\n', [math()]);
    const view = viewOf(editor);
    const block = view.state.schema.nodes.codeBlock.create({ language: 'mermaid' }, view.state.schema.text('graph LR'));
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, block));
    select(editor, 8);
    expect(editor.tiptap.state.doc.child(1).type.name).toBe('codeBlock');
    select(editor, 2);
    expect(editor.tiptap.state.doc.child(1).type.name).toBe('rawBlock');
    expect(element.querySelector('.nsmd-unit-rendered')?.textContent).toContain('diagram(graph LR)');
    expect(editor.getMarkdown()).toBe('Text\n\n```mermaid\ngraph LR\n```\n');
  });

  it('shows raw HTML of the file in a rendering as its text', () => {
    open(text, [math()]);
    const unit = element.querySelectorAll('.nsmd-unit-rendered')[1];
    expect(unit.querySelector('img')).toBeNull();
    expect(unit.querySelector('.nsmd-raw-html')?.textContent).toBe('<img src=x onerror="alert(1)">');
  });

  it('shows a unit with the renderer of the editor, as the renderer shows the whole file', () => {
    const editor = open('> [!NOTE]\n> The math $a$.\n\n- [x] done $b$\n', [math()]);
    expect(viewOf(editor).dom.classList.contains('nsmd-content')).toBe(true);
    const units = element.querySelectorAll('.nsmd-unit-rendered');
    expect(units[0].querySelector('.markdown-alert-note > .markdown-alert-title')?.textContent).toBe('Note');
    expect(units[0].querySelector('.nsmd-render')?.textContent).toBe('inline(a)');
    expect(units[1].querySelector<HTMLInputElement>('input.task-list-item-checkbox')?.checked).toBe(true);
    // A unit is one block of the file: its headings get no IDs and its blocks no lines.
    expect(units[0].querySelector('[data-line]')).toBeNull();
  });

  it('shows a block with a token of a markdown-it plugin with the HTML of that plugin', () => {
    const box = (md: MarkdownIt) => {
      md.block.ruler.before('paragraph', 'box', (state, startLine, _endLine, silent) => {
        const line = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
        if (!line.startsWith(':: ')) {
          return false;
        }
        if (!silent) {
          const token = state.push('box', 'aside', 0);
          token.content = line.slice(3);
          token.map = [startLine, startLine + 1];
        }
        state.line = startLine + 1;
        return true;
      });
      md.renderer.rules.box = (tokens, index) => `<aside class="box">${md.utils.escapeHtml(tokens[index].content)}</aside>`;
    };
    const editor = open(':: A box\n\nText\n', [{ name: 'box', apiVersion: 1, extendMarkdownIt: box }]);
    expect(element.querySelector('.nsmd-unit-rendered aside.box')?.textContent).toBe('A box');
    expect(editor.getMarkdown()).toBe(':: A box\n\nText\n');
  });

  it('keeps a block that a plugin shows when the user changes another block', () => {
    const editor = open(text, [math()]);
    editor.tiptap.chain().setTextSelection(3).insertContent('New ').run();
    expect(editor.getMarkdown()).toBe(text.replace('# Title', '# TiNew tle'));
  });

  it('changes a block through its source below the rendering, in one step of Undo', () => {
    const editor = open(text, [math()]);
    const unit = element.querySelector<HTMLElement>('.nsmd-unit-rendered')!;
    unit.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const field = unit.querySelector('textarea')!;
    expect(field.value).toBe('$$\nx^2\n$$');
    // The rendering stays above the field.
    expect(unit.querySelector('.nsmd-unit-view .math')).not.toBeNull();
    field.value = '$$\ny^3\n$$';
    field.dispatchEvent(new FocusEvent('blur'));
    expect(editor.getMarkdown()).toBe(text.replace('x^2', 'y^3'));
    expect(element.querySelector('.math')?.textContent).toBe('math(y^3)');
    editor.tiptap.commands.undo();
    expect(editor.getMarkdown()).toBe(text);
  });

  it('parses the new source again, so that it may become other blocks', () => {
    const editor = open(text, [math()]);
    const unit = element.querySelector<HTMLElement>('.nsmd-unit-rendered')!;
    unit.querySelector<HTMLButtonElement>('.nsmd-unit-edit')!.click();
    const field = unit.querySelector('textarea')!;
    field.value = 'A paragraph\n\n- an item';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }));
    expect(editor.getMarkdown()).toBe(text.replace('$$\nx^2\n$$', 'A paragraph\n\n- an item'));
    expect(editor.tiptap.state.doc.child(1).type.name).toBe('paragraph');
    expect(editor.tiptap.state.doc.child(2).type.name).toBe('bulletList');
  });

  it('restores the source with Escape', () => {
    const editor = open(text, [math()]);
    const unit = element.querySelector<HTMLElement>('.nsmd-unit-rendered')!;
    unit.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const field = unit.querySelector('textarea')!;
    field.value = 'changed';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(unit.querySelector('textarea')).toBeNull();
    expect(editor.getMarkdown()).toBe(text);
  });

  it('opens no source in read-only mode', () => {
    open(text, [math()], { editable: false });
    const unit = element.querySelector<HTMLElement>('.nsmd-unit-rendered')!;
    unit.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(unit.querySelector('textarea')).toBeNull();
  });

  it('changes the text of a raw block without a rendering, and gives the change to the source of the file', () => {
    const source = new TextSource('Text\n\n[a]: https://example.com\n');
    const editor = open('', [], { source });
    const unit = element.querySelector<HTMLElement>('.nsmd-unit-text')!;
    expect(unit.querySelector('.nsmd-unit-view')?.textContent).toBe('[a]: https://example.com');
    unit.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const field = unit.querySelector('textarea')!;
    field.value = '[a]: https://example.org';
    field.dispatchEvent(new FocusEvent('blur'));
    expect(source.text).toBe('Text\n\n[a]: https://example.org\n');
    expect(editor.getMarkdown()).toBe(source.text);
  });

  it('keeps the line breaks and the byte order mark of the file when a source changes', () => {
    const file = '﻿Text\r\n\r\n$$\r\nx\r\n$$\r\n';
    const editor = open(file, [math()]);
    const unit = element.querySelector<HTMLElement>('.nsmd-unit-rendered')!;
    unit.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const field = unit.querySelector('textarea')!;
    field.value = '$$\ny\n$$';
    field.dispatchEvent(new FocusEvent('blur'));
    expect(editor.getMarkdown()).toBe('﻿Text\r\n\r\n$$\r\ny\r\n$$\r\n');
  });
});

/** mentions is a plugin of the level "render and edit": `@name` becomes a node of its own. */
function mentions(): MarkdownPlugin {
  return {
    name: 'mentions',
    apiVersion: 1,
    extendMarkdownIt: (md) => {
      md.inline.ruler.push('mention', (state, silent) => {
        const found = /^@([a-z]+)/.exec(state.src.slice(state.pos));
        if (!found) {
          return false;
        }
        if (!silent) {
          state.push('mention', '', 0).meta = { name: found[1] };
        }
        state.pos += found[0].length;
        return true;
      });
    },
    nodes: [
      TiptapNode.create({
        name: 'mention',
        group: 'inline',
        inline: true,
        atom: true,
        addAttributes: () => ({ name: { default: '' } }),
        parseHTML: () => [{ tag: 'span.mention' }],
        renderHTML: ({ node }) => ['span', { class: 'mention' }, `@${node.attrs.name as string}`],
      }),
    ],
    fromMarkdown: { mention: { node: 'mention', getAttrs: (token) => ({ name: (token.meta as { name: string }).name }) } },
    toMarkdown: { nodes: { mention: (state, node) => state.write(`@${node.attrs.name as string}`) } },
    learnMarks: { nodes: { mention: () => '@' } },
    commands: {
      mention: (editor, name) => editor.tiptap.chain().insertContent({ type: 'mention', attrs: { name: String(name) } }).run(),
    },
    keys: { 'Alt-m': 'mention' },
    menus: {
      insert: (tiptap) => [{ id: 'mention', label: 'Mention', run: () => tiptap.commands.insertContent({ type: 'mention', attrs: { name: 'menu' } }) }],
      format: [{ id: 'comment', label: 'Comment', text: 'C', run: () => undefined }],
    },
  };
}

describe('the level "render and edit"', () => {
  it('reads the tokens of a plugin into its nodes and writes a changed block with its writer', () => {
    const editor = open('Hello @anna.\n', [mentions()]);
    const paragraph = editor.tiptap.state.doc.child(0);
    expect(paragraph.type.name).toBe('paragraph');
    expect(paragraph.child(1).type.name).toBe('mention');
    expect(element.querySelector('.mention')?.textContent).toBe('@anna');
    editor.tiptap.chain().setTextSelection(1).insertContent('Oh, ').run();
    expect(editor.getMarkdown()).toBe('Oh, Hello @anna.\n');
  });

  it('runs the commands of a plugin by their full names and by their keys', () => {
    const editor = open('Hello\n', [mentions()]);
    select(editor, 6);
    expect(editor.runCommand('mentions.mention', 'ben')).toBe(true);
    expect(editor.getMarkdown()).toBe('Hello@ben\n');
    expect(editor.runCommand('mentions.unknown')).toBe(false);
    expect(key(editor, 'm', { altKey: true })).toBe(true);
    expect(editor.getMarkdown()).toBe('Hello@ben@undefined\n');
  });

  it('adds the items of a plugin to the slash commands and its buttons to the format bar', () => {
    const editor = open('\n', [mentions()]);
    select(editor, 1);
    type(editor, '/men');
    const labels = [...element.querySelectorAll('.nsmd-menu-item .nsmd-menu-label')].map((item) => item.textContent);
    expect(labels).toContain('Mention');
    expect(element.querySelector('.nsmd-format-bar [aria-label="Comment"]')).not.toBeNull();
  });

  it('gives the front matter the schema and the inputs of a plugin', () => {
    const schema: JsonSchema = { type: 'object', properties: { title: { type: 'string' }, layout: { type: 'string' } } };
    open('---\ntitle: A\n---\n\nText\n', [{ name: 'paper', apiVersion: 1, frontMatterSchema: schema }]);
    expect(element.querySelector('.nsmd-fm input[aria-label="layout"]')).not.toBeNull();
  });
});

/** citations is a plugin whose citations, links to `#` targets, are generated parts. */
function citations(calls: { open: number; edit: number } = { open: 0, edit: 0 }): MarkdownPlugin {
  return {
    name: 'citations',
    apiVersion: 1,
    generated: (doc: Node) => {
      const parts: GeneratedPart[] = [];
      doc.descendants((node, pos) => {
        const link = node.isText ? node.marks.find((mark) => mark.type.name === 'link' && String(mark.attrs.href).startsWith('#')) : undefined;
        if (link) {
          const last = parts[parts.length - 1];
          if (last && last.to === pos) {
            parts[parts.length - 1] = { ...last, to: pos + node.nodeSize };
          } else {
            parts.push({ from: pos, to: pos + node.nodeSize, open: () => calls.open++, edit: () => calls.edit++ });
          }
        }
      });
      return parts;
    },
  };
}

describe('the generated parts', () => {
  // The citation starts at the position 6, after "Seen ", and ends at the position 18.
  const text = 'Seen [Levitt, 1972](#levitt-1972) in 1972.\n';
  const from = 6;
  const to = 18;

  it('drop typing, a deleted piece and a format of a piece of a part', () => {
    const editor = open(text, [citations()]);
    const view = viewOf(editor);
    view.dispatch(view.state.tr.insertText('x', from + 2));
    view.dispatch(view.state.tr.delete(from + 1, from + 3));
    view.dispatch(view.state.tr.addMark(from + 1, from + 3, view.state.schema.marks.bold.create()));
    expect(editor.getMarkdown()).toBe(text);
    expect(element.querySelector('.nsmd-generated')?.textContent).toBe('Levitt, 1972');
  });

  it('let the user delete or format a whole part', () => {
    const editor = open(text, [citations()]);
    const view = viewOf(editor);
    view.dispatch(view.state.tr.addMark(from, to, view.state.schema.marks.bold.create()));
    expect(editor.getMarkdown()).toBe('Seen [**Levitt, 1972**](#levitt-1972) in 1972.\n');
    view.dispatch(view.state.tr.delete(from - 1, to));
    expect(editor.getMarkdown()).toBe('Seen in 1972.\n');
  });

  it('move the cursor over a part and let a selection hold the whole part', () => {
    const editor = open(text, [citations()]);
    const view = viewOf(editor);
    select(editor, from);
    select(editor, from + 1);
    expect(view.state.selection.head).toBe(to);
    select(editor, to);
    select(editor, to - 1);
    expect(view.state.selection.head).toBe(from);
    select(editor, from + 3);
    expect(view.state.selection.head).toBe(from);
    select(editor, 2, from + 3);
    expect([view.state.selection.from, view.state.selection.to]).toEqual([2, to]);
  });

  it('delete a whole part with Backspace and Delete, in one step of Undo', () => {
    const editor = open(text, [citations()]);
    select(editor, to);
    expect(key(editor, 'Backspace')).toBe(true);
    expect(editor.getMarkdown()).toBe('Seen  in 1972.\n');
    editor.tiptap.commands.undo();
    expect(editor.getMarkdown()).toBe(text);
    select(editor, from);
    expect(key(editor, 'Delete')).toBe(true);
    expect(editor.getMarkdown()).toBe('Seen  in 1972.\n');
  });

  it('keep typed text at the edge of a part out of the part', () => {
    const editor = open(text, [citations()]);
    select(editor, to);
    type(editor, '!');
    expect(editor.getMarkdown()).toBe('Seen [Levitt, 1972](#levitt-1972)! in 1972.\n');
  });

  it('go to the target with Ctrl+click and open the form with a double click', () => {
    const calls = { open: 0, edit: 0 };
    const editor = open(text, [citations(calls)]);
    const view = viewOf(editor);
    view.someProp('handleClick', (handle) => handle(view, from + 2, new MouseEvent('click', { ctrlKey: true })));
    view.someProp('handleClick', (handle) => handle(view, from + 2, new MouseEvent('click')));
    view.someProp('handleDoubleClick', (handle) => handle(view, from + 2, new MouseEvent('dblclick')));
    expect(calls).toEqual({ open: 1, edit: 1 });
  });

  it('change with a change from outside and with a write of the plugin', () => {
    const source = new TextSource(text);
    const editor = open('', [citations()], { source });
    source.setText(text.replace('1972]', '1976]'), { kind: 'program', name: 'formatter' });
    expect(editor.getMarkdown()).toBe(text.replace('1972]', '1976]'));
    const view = viewOf(editor);
    view.dispatch(view.state.tr.insertText('1980', from + 8, to).setMeta(generatedWrite, true));
    expect(editor.getMarkdown()).toBe('Seen [Levitt, 1980](#levitt-1972) in 1972.\n');
  });

  it('stay when replace changes the matches outside the parts', () => {
    const editor = open(text, [citations()]);
    const view = viewOf(editor);
    setFind(view, '1972', false);
    expect(replaceAll(view, '2000')).toBe(1);
    expect(editor.getMarkdown()).toBe('Seen [Levitt, 1972](#levitt-1972) in 2000.\n');
  });

  it('come again after refreshPlugins, when the data of the plugin changed', () => {
    let active = false;
    const plugin: MarkdownPlugin = { name: 'switch', apiVersion: 1, generated: (doc) => (active ? [{ from: 1, to: doc.child(0).nodeSize - 1 }] : []) };
    const editor = open('Text\n', [plugin]);
    expect(element.querySelector('.nsmd-generated')).toBeNull();
    active = true;
    editor.refreshPlugins();
    expect(element.querySelector('.nsmd-generated')?.textContent).toBe('Text');
  });
});

/** notes is a plugin with a thread for each paragraph that holds the word "note". */
function notes(opened: { id: string; panel: HTMLElement }[] = [], closed: string[] = []): MarkdownPlugin {
  return {
    name: 'notes',
    apiVersion: 1,
    threads: {
      find: (doc) => {
        const found: { id: string; from: number; to: number; count: number }[] = [];
        doc.forEach((node, offset, index) => {
          if (node.textContent.includes('note')) {
            found.push({ id: `thread-${index}`, from: offset + 1, to: offset + node.nodeSize - 1, count: index + 1 });
          }
        });
        return found;
      },
      open: (thread, panel) => {
        opened.push({ id: thread.id, panel });
        panel.textContent = `Thread ${thread.id}`;
        return () => closed.push(thread.id);
      },
    },
  };
}

describe('the threads beside the text', () => {
  const text = 'A note.\n\nNo thread.\n\nAnother note.\n';

  it('show an icon with the number of answers beside each passage with a thread', () => {
    open(text, [notes()]);
    const icons = [...element.querySelectorAll<HTMLElement>('.nsmd-threads .nsmd-thread-icon')];
    expect(icons.map((icon) => icon.dataset.thread)).toEqual(['thread-0', 'thread-2']);
    expect(icons.map((icon) => icon.querySelector('.nsmd-thread-count')?.textContent)).toEqual(['1', '3']);
    expect(icons[1].getAttribute('aria-label')).toBe('Note, 3 answers');
    expect(element.querySelector('.nsmd-box')?.classList.contains('nsmd-has-threads')).toBe(true);
  });

  it('open the panel of a thread with a click on its icon, and close it with a second click', () => {
    const opened: { id: string; panel: HTMLElement }[] = [];
    const closed: string[] = [];
    open(text, [notes(opened, closed)]);
    const icon = element.querySelector<HTMLElement>('[data-thread="thread-2"]')!;
    icon.click();
    expect(opened.map((each) => each.id)).toEqual(['thread-2']);
    const panel = element.querySelector('.nsmd-thread-panel');
    expect(panel?.querySelector('.nsmd-thread-body')?.textContent).toBe('Thread thread-2');
    expect(element.querySelector('.nsmd-thread-active')?.textContent).toBe('Another note.');
    expect(icon.getAttribute('aria-expanded')).toBe('true');
    element.querySelector<HTMLElement>('[data-thread="thread-2"]')!.click();
    expect(closed).toEqual(['thread-2']);
    expect(element.querySelector('.nsmd-thread-panel')).toBeNull();
    expect(element.querySelector('.nsmd-thread-active')).toBeNull();
  });

  it('close the panel with Escape and when the passage is gone', async () => {
    const closed: string[] = [];
    const editor = open(text, [notes([], closed)]);
    expect(editor.openThread('thread-0')).toBe(true);
    element.querySelector('.nsmd-thread-panel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(element.querySelector('.nsmd-thread-panel')).toBeNull();
    editor.openThread('thread-0');
    const view = viewOf(editor);
    view.dispatch(view.state.tr.insertText('X', 1, 7));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(element.querySelector('.nsmd-thread-panel')).toBeNull();
    expect(closed).toEqual(['thread-0', 'thread-0']);
  });

  it('leave the icons out for a view of the integrating code, and still open a panel', () => {
    const editor = open(text, [notes()], { threadIcons: false });
    expect(element.querySelector('.nsmd-threads')).toBeNull();
    expect(editor.openThread('thread-9')).toBe(false);
    expect(editor.openThread('thread-0')).toBe(true);
    expect(element.querySelector('.nsmd-thread-panel')).not.toBeNull();
    editor.closeThread();
    expect(element.querySelector('.nsmd-thread-panel')).toBeNull();
  });
});
