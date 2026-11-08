// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the form of the front matter (docs/editor.md, R-FM-001 to R-FM-006, R-FM-008): the form in both modes,
// with and without a schema, the problems of the schema, the inputs of plugins, read-only mode, undo, and the keys that
// move the cursor between the fields and the text. Each test changes the inputs of the form as the user does and checks
// the Markdown that the editor writes.

import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownEditor, type MarkdownEditorOptions } from '../editor';
import type { JsonSchema } from '@nimblescape/markdowntext';

let editor: MarkdownEditor | undefined;
let element: HTMLElement;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  element?.remove();
});

/** open returns an editor in a page with a text. */
function open(markdown: string, options: MarkdownEditorOptions = {}): MarkdownEditor {
  element = document.createElement('div');
  document.body.append(element);
  editor = new MarkdownEditor(element, { markdown, ...options });
  return editor;
}

/** settle waits until the form has shown itself again after a change. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5));

/** form returns the element of the form. */
const form = (): HTMLElement => {
  const found = element.querySelector<HTMLElement>('.nsmd-fm');
  if (!found) {
    throw new Error('The editor shows no form.');
  }
  return found;
};

/** field returns the row of a key of the form. */
const field = (path: (string | number)[]): HTMLElement | null => form().querySelector(`[data-path='${JSON.stringify(path)}']`);

/** input returns the input of a value of the form. */
function input<T extends HTMLElement = HTMLInputElement>(path: (string | number)[]): T {
  const found = form().querySelector<T>(`[data-focus='value ${JSON.stringify(path)}']`);
  if (!found) {
    throw new Error(`The form has no input for ${path.join('.')}.`);
  }
  return found;
}

/** change sets the value of an input as the user does. */
function change(target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string | boolean): void {
  if (target instanceof HTMLInputElement && target.type === 'checkbox') {
    target.checked = value as boolean;
  } else {
    target.value = value as string;
  }
  target.dispatchEvent(new Event('change', { bubbles: true }));
  target.dispatchEvent(new Event('blur'));
}

/** click clicks a button of the form. */
function click(selector: string): void {
  const button = form().querySelector<HTMLElement>(selector);
  if (!button) {
    throw new Error(`The form has no button ${selector}.`);
  }
  button.click();
}

const schema: JsonSchema = {
  type: 'object',
  required: ['title'],
  properties: {
    title: { type: 'string', title: 'Title' },
    date: { type: 'string', format: 'date' },
    kind: { enum: ['thesis', 'concept'] },
    draft: { type: 'boolean' },
    pages: { type: 'integer', minimum: 1 },
    authors: { type: 'array', items: { type: 'string' } },
    layout: { type: 'string', readOnly: true },
  },
};

describe('the form of the front matter', () => {
  const text = "---\ntitle: 'Old'  # keep\nauthors:\n- Ana\nlayout: pht\n---\n\n# Head\n";

  it('shows the keys of the schema in its order and changes only the edited value, as one step of undo', async () => {
    const opened = open(text, { frontMatterSchema: schema });
    const labels = [...form().querySelectorAll('.nsmd-fm-key')].map((label) => label.textContent);
    expect(labels).toEqual(['Title *', 'date', 'kind', 'draft', 'pages', 'authors', 'layout']);
    change(input(['title']), 'New');
    await settle();
    expect(opened.getMarkdown()).toBe(text.replace("'Old'", "'New'"));
    opened.tiptap.commands.undo();
    expect(opened.getMarkdown()).toBe(text);
    expect(input(['title']).value).toBe('Old');
  });

  it('adds a key of the schema after the key before it in the order of the schema', async () => {
    const opened = open(text, { frontMatterSchema: schema });
    change(input(['date']), '2026-11-02');
    await settle();
    change(input<HTMLSelectElement>(['kind']), '1');
    await settle();
    change(input(['draft']), true);
    await settle();
    change(input(['pages']), '12');
    await settle();
    expect(opened.getMarkdown()).toBe("---\ntitle: 'Old'  # keep\ndate: 2026-11-02\nkind: concept\ndraft: true\npages: 12\nauthors:\n- Ana\nlayout: pht\n---\n\n# Head\n");
  });

  it('shows the problems of the schema at their values', async () => {
    const opened = open('---\npages: 0\n---\n', { frontMatterSchema: schema });
    expect(field(['title'])?.querySelector('.nsmd-fm-problem')?.textContent).toBe('A value is required.');
    expect(field(['pages'])?.querySelector('.nsmd-fm-problem')?.textContent).toBe('The value must be at least 1.');
    expect(input(['pages']).getAttribute('aria-invalid')).toBe('true');
    expect(form().querySelector('.nsmd-fm-count')?.textContent).toBe('2 problems');
    change(input(['pages']), '3');
    await settle();
    expect(opened.getMarkdown()).toBe('---\npages: 3\n---\n');
    expect(form().querySelector('.nsmd-fm-count')?.textContent).toBe('1 problem');
  });

  it('keeps the keys fixed with a schema: no new keys, and the values that the schema marks read-only stay', () => {
    open(text, { frontMatterSchema: schema });
    expect(form().querySelector('.nsmd-fm-mode')?.getAttribute('aria-pressed')).toBe('false');
    expect(form().querySelector('.nsmd-fm-add')).toBeNull();
    expect(form().querySelector('.nsmd-fm-key-input')).toBeNull();
    expect(field(['layout'])?.querySelector('input')).toBeNull();
    expect(field(['layout'])?.querySelector('.nsmd-fm-static')?.textContent).toBe('pht');
    // The schema defines the list, so its items can change.
    expect(field(['authors'])?.querySelector('.nsmd-fm-add-item')).not.toBeNull();
  });

  it('adds, renames and removes keys and items in the mode to edit the keys', async () => {
    const opened = open('---\na: 1\nlist:\n  - x\n---\n');
    expect(form().querySelector('.nsmd-fm-mode')?.getAttribute('aria-pressed')).toBe('true');
    const name = form().querySelector<HTMLInputElement>('.nsmd-fm-new-key');
    const kind = form().querySelector<HTMLSelectElement>('.nsmd-fm-add .nsmd-fm-select');
    if (!name || !kind) {
      throw new Error('The form has no row to add a key.');
    }
    name.value = 'group';
    kind.value = '4';
    click('.nsmd-fm-add-key');
    await settle();
    expect(opened.getMarkdown()).toBe('---\na: 1\nlist:\n  - x\ngroup: {}\n---\n');
    click(`[data-focus='add-item ${JSON.stringify(['list'])}']`);
    await settle();
    expect(opened.getMarkdown()).toBe('---\na: 1\nlist:\n  - x\n  - ""\ngroup: {}\n---\n');
    change(form().querySelector<HTMLInputElement>(`[data-focus='key ${JSON.stringify(['a'])}']`) as HTMLInputElement, 'b');
    await settle();
    click(`[data-focus='remove ${JSON.stringify(['list', 1])}']`);
    await settle();
    click(`[data-focus='remove ${JSON.stringify(['group'])}']`);
    await settle();
    expect(opened.getMarkdown()).toBe('---\nb: 1\nlist:\n  - x\n---\n');
  });

  it('keeps the keys of the schema in the mode to edit the keys: only the other keys get a new name or go', async () => {
    const nested: JsonSchema = { ...schema, properties: { ...schema.properties, place: { type: 'object', properties: { city: { type: 'string' } } } } };
    const opened = open("---\ntitle: 'Old'\nextra: x\nplace:\n  city: Wien\n  room: 3\n---\n", { frontMatterSchema: nested });
    click('.nsmd-fm-mode');
    for (const path of [['title'], ['place'], ['place', 'city']]) {
      expect(form().querySelector(`[data-focus='key ${JSON.stringify(path)}']`)).toBeNull();
      expect(form().querySelector(`[data-focus='remove ${JSON.stringify(path)}']`)).toBeNull();
    }
    expect(field(['title'])?.querySelector('.nsmd-fm-key')?.textContent).toBe('Title *');
    // The value of a key of the schema still changes.
    change(input(['title']), '');
    await settle();
    expect(opened.getMarkdown()).toBe("---\ntitle: ''\nextra: x\nplace:\n  city: Wien\n  room: 3\n---\n");
    // The keys that the schema does not name get a new name and go, also in a map of the schema.
    change(form().querySelector<HTMLInputElement>(`[data-focus='key ${JSON.stringify(['extra'])}']`) as HTMLInputElement, 'more');
    await settle();
    click(`[data-focus='remove ${JSON.stringify(['place', 'room'])}']`);
    await settle();
    expect(opened.getMarkdown()).toBe("---\ntitle: ''\nmore: x\nplace:\n  city: Wien\n---\n");
    click(`[data-focus='remove ${JSON.stringify(['more'])}']`);
    await settle();
    expect(opened.getMarkdown()).toBe("---\ntitle: ''\nplace:\n  city: Wien\n---\n");
  });

  it('switches between the modes with its button', async () => {
    open(text, { frontMatterSchema: schema });
    click('.nsmd-fm-mode');
    expect(form().querySelector('.nsmd-fm-mode')?.getAttribute('aria-pressed')).toBe('true');
    expect(form().querySelector('.nsmd-fm-add')).not.toBeNull();
  });

  it('shows the values as text in read-only mode', () => {
    open(text, { frontMatterSchema: schema, editable: false });
    expect(form().querySelectorAll('input, select, textarea')).toHaveLength(0);
    expect(form().querySelector('.nsmd-fm-mode')).toBeNull();
    expect(field(['title'])?.querySelector('.nsmd-fm-static')?.textContent).toBe('Old');
  });

  it('shows the value of a key with the input of a plugin', () => {
    open(text, {
      frontMatterInputs: [{ key: 'layout', render: (value) => Object.assign(document.createElement('a'), { className: 'layout-link', textContent: `Layout ${String(value)}` }) }],
    });
    expect(field(['layout'])?.querySelector('.layout-link')?.textContent).toBe('Layout pht');
    expect(field(['layout'])?.querySelector('input.nsmd-fm-input')).toBeNull();
    expect(field(['layout'])?.querySelector('.nsmd-fm-readonly')).toBeNull();
  });

  it('gives the value that the input of a plugin shows the gray background of the read-only values, when the schema marks it read-only (R-EDIT-011)', () => {
    const render = (value: unknown) => Object.assign(document.createElement('a'), { className: 'layout-link', textContent: `Layout ${String(value)}` });
    open(text, { frontMatterSchema: { type: 'object', properties: { layout: { type: 'string', readOnly: true } } }, frontMatterInputs: [{ key: 'layout', render }] });
    expect(field(['layout'])?.querySelector('.nsmd-fm-value.nsmd-fm-readonly .layout-link')?.textContent).toBe('Layout pht');
  });

  it('shows the text of a front matter that does not parse, and the user edits the text', async () => {
    const opened = open('---\na: [\n---\n');
    expect(form().querySelector('.nsmd-fm-problem')?.textContent).not.toBe('');
    const area = form().querySelector<HTMLTextAreaElement>('.nsmd-fm-textarea');
    expect(area?.value).toBe('a: [');
    change(area as HTMLTextAreaElement, 'a: [1]');
    await settle();
    expect(opened.getMarkdown()).toBe('---\na: [1]\n---\n');
    expect(input(['a', 0]).value).toBe('1');
  });

  it('edits the front matter of TOML and JSON', async () => {
    const opened = open('+++\ntitle = "Old" # keep\n+++\n');
    change(input(['title']), 'New');
    await settle();
    expect(opened.getMarkdown()).toBe('+++\ntitle = "New" # keep\n+++\n');
    opened.setMarkdown('{\n  "title": "Old"\n}\n\nText\n');
    change(input(['title']), 'New');
    await settle();
    expect(opened.getMarkdown()).toBe('{\n  "title": "New"\n}\n\nText\n');
  });

  it('shows no form when the option says so', () => {
    open(text, { frontMatterForm: false });
    expect(element.querySelector('.nsmd-fm')).toBeNull();
    expect(element.querySelector('.nsmd-raw-front-matter')).not.toBeNull();
  });

  it('takes a new schema', () => {
    const opened = open(text);
    expect(form().querySelector('.nsmd-fm-mode')?.getAttribute('aria-pressed')).toBe('true');
    opened.setFrontMatterSchema(schema);
    expect(field(['date'])).not.toBeNull();
  });

  it('asks a plugin again for its schema after refreshPlugins', () => {
    const given: { schema?: JsonSchema } = {};
    const opened = open(text, { plugins: [{ name: 'layouts', apiVersion: 1, frontMatterSchema: () => given.schema }] });
    expect(field(['date'])).toBeNull();
    given.schema = schema;
    opened.refreshPlugins();
    expect(field(['date'])).not.toBeNull();
  });
});

describe('the place of the front matter', () => {
  it('stays the first block: no move above it, no removal with Backspace, but undo and a new text work', () => {
    const opened = open('---\na: 1\n---\n\n# Head\n\nText\n');
    const view = opened.tiptap.view;
    // The cursor starts in the first block after the front matter, which it does not select.
    expect(view.state.selection.from).toBe(view.state.doc.firstChild?.nodeSize ? view.state.doc.firstChild.nodeSize + 1 : -1);
    expect(opened.tiptap.commands.joinBackward()).toBe(true);
    expect(opened.getMarkdown()).toBe('---\na: 1\n---\n\n# Head\n\nText\n');
    const heading = view.state.doc.child(1);
    const at = view.state.doc.child(0).nodeSize;
    view.dispatch(view.state.tr.delete(at, at + heading.nodeSize).insert(0, heading));
    expect(opened.getMarkdown()).toBe('---\na: 1\n---\n\n# Head\n\nText\n');
    opened.setMarkdown('No front matter.\n');
    expect(opened.getMarkdown()).toBe('No front matter.\n');
  });
});

/** press sends a key to an element as the user does, and returns true when the editor or the form took the key. */
function press(target: HTMLElement, key: string, options: KeyboardEventInit = {}): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

/** active returns the element that has the focus. */
const active = (): Element | null => document.activeElement;

/** caret puts the cursor of a text input at a place. */
function caret<T extends HTMLInputElement | HTMLTextAreaElement>(target: T, place: number): T {
  target.focus();
  target.setSelectionRange(place, place);
  return target;
}

describe('the keys in the form of the front matter', () => {
  const text = "---\ntitle: 'Old'\nauthors:\n- Ana\nlayout: pht\n---\n\n# Head\n\nText\n";
  const addItem = (): HTMLElement => form().querySelector<HTMLElement>(`[data-focus='add-item ${JSON.stringify(['authors'])}']`) as HTMLElement;

  it('moves with the arrow up and down from field to field, and from the last field into the text', () => {
    const opened = open(text, { frontMatterSchema: schema });
    const view = opened.tiptap.view;
    const order = [input(['title']), input(['date']), input<HTMLSelectElement>(['kind']), input(['draft']), input(['pages']), input(['authors', 0]), addItem()];
    order[0].focus();
    for (const next of order.slice(1)) {
      expect(press(active() as HTMLElement, 'ArrowDown')).toBe(true);
      expect(active()).toBe(next);
    }
    for (const before of order.slice(0, -1).reverse()) {
      expect(press(active() as HTMLElement, 'ArrowUp')).toBe(true);
      expect(active()).toBe(before);
    }
    // Above the first field is the button of the mode; above it there is nothing.
    expect(press(input(['title']), 'ArrowUp')).toBe(true);
    expect(active()).toBe(form().querySelector('.nsmd-fm-mode'));
    expect(press(active() as HTMLElement, 'ArrowUp')).toBe(false);
    // The arrow down from the last line goes to the start of the text after the front matter.
    addItem().focus();
    expect(press(addItem(), 'ArrowDown')).toBe(true);
    expect(active()).toBe(view.dom);
    expect(view.state.selection.from).toBe((view.state.doc.firstChild?.nodeSize ?? 0) + 1);
    // The keys with Shift, Ctrl or Alt stay with the input.
    expect(press(input(['title']), 'ArrowDown', { shiftKey: true })).toBe(false);
    expect(press(input(['title']), 'ArrowDown', { altKey: true })).toBe(false);
  });

  it('writes the value of a field that the cursor leaves with the arrow down', async () => {
    const opened = open(text, { frontMatterSchema: schema });
    const title = caret(input(['title']), 3);
    title.value = 'New';
    expect(press(title, 'ArrowDown')).toBe(true);
    await settle();
    expect(opened.getMarkdown()).toBe(text.replace("'Old'", "'New'"));
    expect(active()).toBe(input(['date']));
  });

  it('keeps the column of the cursor while it moves up and down through the text inputs', () => {
    open('---\na: abcdef\nb: xy\nc: ghijkl\n---\n\nText\n');
    // In the mode to edit the keys, each line has the name, the value and the button that removes the key.
    caret(input(['a']), 4);
    expect(press(input(['a']), 'ArrowDown')).toBe(true);
    expect(active()).toBe(input(['b']));
    expect(input(['b']).selectionStart).toBe(2);
    expect(press(input(['b']), 'ArrowDown')).toBe(true);
    expect(active()).toBe(input(['c']));
    expect(input(['c']).selectionStart).toBe(4);
    // The name of a key goes to the name of the key below.
    const key = (name: string): HTMLInputElement => form().querySelector<HTMLInputElement>(`[data-focus='key ${JSON.stringify([name])}']`) as HTMLInputElement;
    caret(key('a'), 1);
    expect(press(key('a'), 'ArrowDown')).toBe(true);
    expect(active()).toBe(key('b'));
    expect(key('b').selectionStart).toBe(1);
  });

  it('leaves a text of lines only from its first line up and from its last line down', () => {
    open('---\na: x\nb: |-\n  one\n  two\nc: y\n---\n\nText\n');
    const area = input<HTMLTextAreaElement>(['b']);
    expect(area.value).toBe('one\ntwo');
    caret(area, 1);
    expect(press(area, 'ArrowDown')).toBe(false);
    expect(press(area, 'ArrowUp')).toBe(true);
    expect(active()).toBe(input(['a']));
    caret(area, 5);
    expect(press(area, 'ArrowUp')).toBe(false);
    expect(press(area, 'ArrowDown')).toBe(true);
    expect(active()).toBe(input(['c']));
    // From below, the cursor goes into the last line of the text, in its column.
    caret(input(['c']), 1);
    expect(press(input(['c']), 'ArrowUp')).toBe(true);
    expect(active()).toBe(area);
    expect(area.selectionStart).toBe(5);
  });

  it('goes with Tab from the last field into the text, and with the arrow up or left from the start of the text into the last field', () => {
    const opened = open(text, { frontMatterSchema: schema });
    const view = opened.tiptap.view;
    addItem().focus();
    expect(press(addItem(), 'Tab')).toBe(true);
    expect(active()).toBe(view.dom);
    const start = (view.state.doc.firstChild?.nodeSize ?? 0) + 1;
    expect(view.state.selection.from).toBe(start);
    // Shift+Tab, and Tab on another field, stay with the browser.
    expect(press(input(['title']), 'Tab')).toBe(false);
    expect(press(input(['title']), 'Tab', { shiftKey: true })).toBe(false);
    view.focus();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start)));
    expect(press(view.dom, 'ArrowUp')).toBe(true);
    expect(active()).toBe(addItem());
    view.focus();
    expect(press(view.dom, 'ArrowLeft')).toBe(true);
    expect(active()).toBe(addItem());
    // The arrow left from another place of the text, and the arrow up from a later block, stay in the text.
    view.focus();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start + 2)));
    expect(press(view.dom, 'ArrowLeft')).toBe(false);
    expect(view.state.doc.child(2).textContent).toBe('Text');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, view.state.doc.content.size - 2)));
    expect(press(view.dom, 'ArrowUp')).toBe(false);
  });

  it('goes from the text into the form without a schema, and not into a form without inputs', () => {
    const opened = open('---\na: 1\n---\n\nText\n');
    opened.tiptap.view.focus();
    expect(press(opened.tiptap.view.dom, 'ArrowUp')).toBe(true);
    expect(active()).toBe(form().querySelector('.nsmd-fm-new-key'));
    opened.destroy();
    element.remove();
    const reading = open('---\na: 1\n---\n\nText\n', { editable: false });
    reading.tiptap.view.focus();
    expect(press(reading.tiptap.view.dom, 'ArrowUp')).toBe(false);
  });
});
