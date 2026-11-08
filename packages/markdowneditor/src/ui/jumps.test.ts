// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the jumps in the document of the editor (docs/editor.md, R-EDIT-014): Ctrl+click on a link to a place of
// the document and on a footnote goes there, the editor keeps the place where the jump started, and Go Back and Go
// Forward return through the places with the keys, the mouse buttons and the toolbar, also after changes of the text.

import type { EditorView } from '@tiptap/pm/view';
import { pluginApiVersion } from '@nimblescape/markdownrender';
import { vscodeJumpKeys } from '@nimblescape/markdownrender/jumps';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor, type MarkdownEditorOptions } from '../editor';
import type { GeneratedPart, MarkdownPlugin, PluginEditor } from '../plugins/api';
import { targetOf } from './jumps';

let editor: MarkdownEditor | undefined;
let element: HTMLElement;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  element?.remove();
});

const text = [
  '# Report',
  '',
  'See [the methods](#methods), [Figure 1](#fig-plan) and the note.[^1]',
  '',
  '## Methods',
  '',
  'Methods text.',
  '',
  'Figure 1: Plan<a id="fig-plan"></a>',
  '',
  '## Methods',
  '',
  'Again.',
  '',
  '[^1]: The footnote.',
  '',
].join('\n');

/** open returns an editor in a page with a text and the keys of VS Code on Linux. */
function open(markdown: string, options: MarkdownEditorOptions = {}): MarkdownEditor {
  element = document.createElement('div');
  document.body.append(element);
  editor = new MarkdownEditor(element, { markdown, jumps: { keys: vscodeJumpKeys('linux') }, ...options });
  return editor;
}

const viewOf = (opened: MarkdownEditor): EditorView => opened.tiptap.view;

/** posOf returns the position of the first character of a text in the document. */
function posOf(opened: MarkdownEditor, needle: string, nth = 0): number {
  let found = -1;
  let seen = 0;
  opened.tiptap.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text?.includes(needle)) {
      if (seen++ === nth) {
        found = pos + node.text.indexOf(needle);
      }
    }
    return found < 0;
  });
  return found;
}

/** blockAt returns the text of the textblock of the cursor. */
const blockAt = (opened: MarkdownEditor): string => opened.tiptap.state.selection.$head.parent.textContent;

/** click sends a click on an element at a position of the document to the editor, and returns whether it used it. */
function click(opened: MarkdownEditor, pos: number, target: Element, init: MouseEventInit = { ctrlKey: true }): boolean {
  const view = viewOf(opened);
  const event = new MouseEvent('click', init);
  Object.defineProperty(event, 'target', { value: target });
  return view.someProp('handleClick', (handle) => handle(view, pos, event)) ?? false;
}

/** key sends a key to the editor, and returns whether it used it. */
function key(opened: MarkdownEditor, init: KeyboardEventInit): boolean {
  const view = viewOf(opened);
  return view.someProp('handleKeyDown', (handle) => handle(view, new KeyboardEvent('keydown', init))) ?? false;
}

/** linkElement returns the element of the link with an address in the editor. */
const linkElement = (opened: MarkdownEditor, href: string): Element => viewOf(opened).dom.querySelector(`a[href="${href}"]`)!;

describe('the targets of links to places of the document', () => {
  it('finds an anchor of HTML by its ID or name, a heading by its GitHub ID, and a second heading with the same text by the suffix', () => {
    const opened = open(text);
    const { doc } = opened.tiptap.state;
    expect(doc.resolve(targetOf(doc, 'fig-plan')!).parent.textContent).toBe('Figure 1: Plan');
    expect(doc.resolve(targetOf(doc, 'methods')!).parent.textContent).toBe('Methods');
    expect(targetOf(doc, 'methods-1')).toBeGreaterThan(targetOf(doc, 'methods')!);
    expect(targetOf(doc, 'report')).toBe(1);
    expect(targetOf(doc, 'missing')).toBeUndefined();
  });

  it('finds an inline node of a plugin with the ID', () => {
    const opened = open('Text\n\n## Results\n');
    const { doc } = opened.tiptap.state;
    expect(targetOf(doc, 'results')).toBeDefined();
  });
});

describe('Ctrl+click on a link to a place of the document', () => {
  it('goes to the heading and back to the link, and forward again', () => {
    const opened = open(text);
    const link = posOf(opened, 'the methods');
    expect(click(opened, link, linkElement(opened, '#methods'))).toBe(true);
    expect(blockAt(opened)).toBe('Methods');
    expect(opened.canGoBack).toBe(true);
    expect(opened.goBack()).toBe(true);
    expect(opened.tiptap.state.selection.head).toBe(link);
    expect(opened.canGoBack).toBe(false);
    expect(opened.canGoForward).toBe(true);
    expect(opened.goForward()).toBe(true);
    expect(blockAt(opened)).toBe('Methods');
    expect(opened.goForward()).toBe(false);
  });

  it('goes to an anchor of HTML', () => {
    const opened = open(text);
    expect(click(opened, posOf(opened, 'Figure 1'), linkElement(opened, '#fig-plan'))).toBe(true);
    expect(blockAt(opened)).toBe('Figure 1: Plan');
  });

  it('does nothing without Ctrl or for a link without a target, so the editor handles the click as before', () => {
    const opened = open(text);
    expect(click(opened, posOf(opened, 'the methods'), linkElement(opened, '#methods'), {})).toBe(false);
    const broken = open('[Gone](#gone)\n');
    expect(click(broken, posOf(broken, 'Gone'), linkElement(broken, '#gone'))).toBe(false);
    expect(broken.canGoBack).toBe(false);
  });

  it('goes from a footnote reference to its definition and from the label of the definition to the reference', () => {
    const opened = open(text);
    const view = viewOf(opened);
    const reference = view.dom.querySelector('.nsmd-footnote-reference')!;
    expect(click(opened, view.posAtDOM(reference, 0), reference)).toBe(true);
    expect(blockAt(opened)).toBe('The footnote.');
    const definition = view.dom.querySelector('.nsmd-footnote')!;
    // The label stands left of the first block of the definition.
    definition.firstElementChild!.getBoundingClientRect = () => ({ left: 40, right: 200, top: 0, bottom: 10, width: 160, height: 10, x: 40, y: 0, toJSON: () => ({}) });
    expect(click(opened, view.posAtDOM(definition, 0), definition, { ctrlKey: true, clientX: 10 })).toBe(true);
    expect(blockAt(opened)).toContain('See');
  });
});

describe('Go Back and Go Forward', () => {
  it('use the keys that the editor got, and leave the key to the page without a place', () => {
    const opened = open(text);
    expect(key(opened, { key: '-', code: 'Minus', ctrlKey: true, altKey: true })).toBe(false);
    opened.jumpTo(posOf(opened, 'Again.'), posOf(opened, 'the methods'));
    expect(blockAt(opened)).toBe('Again.');
    expect(key(opened, { key: '-', code: 'Minus', ctrlKey: true, altKey: true })).toBe(true);
    expect(blockAt(opened)).toContain('See');
    expect(key(opened, { key: '_', code: 'Minus', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(blockAt(opened)).toBe('Again.');
  });

  it('use the back and forward buttons of the mouse, unless the integrating code leaves them to the platform', () => {
    const opened = open(text);
    opened.jumpTo(posOf(opened, 'Again.'));
    const view = viewOf(opened);
    const back = new MouseEvent('mouseup', { button: 3, bubbles: true, cancelable: true });
    view.dom.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(opened.canGoForward).toBe(true);
    const off = open(text, { jumps: { mouseButtons: false } });
    off.jumpTo(posOf(off, 'Again.'));
    viewOf(off).dom.dispatchEvent(new MouseEvent('mouseup', { button: 3, bubbles: true }));
    expect(off.canGoBack).toBe(true);
  });

  it('keep the places at their text when the text before them changes', () => {
    const opened = open(text);
    const from = posOf(opened, 'the methods');
    opened.jumpTo(posOf(opened, 'Again.'), from);
    const view = viewOf(opened);
    view.dispatch(view.state.tr.insertText('New words. ', 1));
    expect(opened.goBack()).toBe(true);
    expect(opened.tiptap.state.selection.head).toBe(from + 'New words. '.length);
  });

  it('start a new way forward after a new jump', () => {
    const opened = open(text);
    opened.jumpTo(posOf(opened, 'Again.'));
    opened.goBack();
    expect(opened.canGoForward).toBe(true);
    opened.jumpTo(posOf(opened, 'Methods text.'));
    expect(opened.canGoForward).toBe(false);
  });

  it('show in the toolbar once the editor has a place, disabled without a place in their direction', () => {
    const opened = open(text);
    const back = element.querySelector<HTMLButtonElement>('button[title^="Go Back"]')!;
    const forward = element.querySelector<HTMLButtonElement>('button[title^="Go Forward"]')!;
    expect(back.title).toBe('Go Back (Ctrl+Alt+-)');
    expect(forward.title).toBe('Go Forward (Ctrl+Shift+-)');
    expect(back.hidden).toBe(true);
    opened.jumpTo(posOf(opened, 'Again.'));
    expect(back.hidden).toBe(false);
    expect(back.disabled).toBe(false);
    expect(forward.disabled).toBe(true);
    back.click();
    expect(opened.canGoBack).toBe(false);
    expect(back.disabled).toBe(true);
    expect(forward.disabled).toBe(false);
    forward.click();
    expect(blockAt(opened)).toBe('Again.');
  });

  it('let a plugin jump with Ctrl+click on a generated part, from the place of the part', () => {
    let pluginEditor: PluginEditor | undefined;
    const plugin: MarkdownPlugin = {
      name: 'test',
      apiVersion: pluginApiVersion,
      activate: (editor) => {
        pluginEditor = editor;
      },
      generated: (doc) => {
        const parts: GeneratedPart[] = [];
        let target = 0;
        doc.descendants((node, pos) => {
          if (node.isText && node.text === 'Again.') {
            target = pos;
          }
        });
        doc.descendants((node, pos) => {
          if (node.isText && node.text === 'Figure 1') {
            parts.push({ from: pos, to: pos + node.nodeSize, open: () => pluginEditor?.jumpTo(target) });
          }
        });
        return parts;
      },
    };
    const opened = open(text, { plugins: [plugin] });
    const part = posOf(opened, 'Figure 1');
    expect(click(opened, part + 2, linkElement(opened, '#fig-plan'))).toBe(true);
    expect(blockAt(opened)).toBe('Again.');
    expect(opened.goBack()).toBe(true);
    expect([part, part + 'Figure 1'.length]).toContain(opened.tiptap.state.selection.head);
  });
});
