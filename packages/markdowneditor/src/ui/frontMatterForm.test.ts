// @vitest-environment happy-dom
// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The tests of the form of the front matter (docs/editor.md, R-FM-001 to R-FM-006): the form in both modes, with and
// without a schema, the problems of the schema, the inputs of plugins, read-only mode and undo. Each test changes the
// inputs of the form as the user does and checks the Markdown that the editor writes.

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

  it('shows the text of the front matter in the mode to learn Markdown, and no form when the option says so', () => {
    open(text, { learnMode: true });
    expect(form().querySelector('.nsmd-fm-source')?.textContent).toBe(text.split('\n\n')[0]);
    editor?.destroy();
    element.remove();
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
