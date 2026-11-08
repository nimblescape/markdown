// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The form of the front matter (docs/editor.md, R-FM-001 to R-FM-006): the editor shows the front matter of a file as
// a form, for YAML, TOML and JSON. In the mode with fixed keys (R-FM-002), the user changes only values, and only
// where the schema allows it; in the mode to edit the keys (R-FM-003), the user also adds keys, lists and groups, and
// renames and removes the keys that the schema does not name. A button switches between the modes; a file with a schema opens with fixed keys, a file without a
// schema opens in the mode to edit the keys. Each change of a value is one step of undo and changes only the text of
// that value (R-FM-005). A plugin may show the value of a key with an input of its own, which is read-only (R-FM-006).
// A front matter that does not parse shows its text with the problem, and the user edits the text. The arrow keys move
// the cursor between the fields of the form and into the text after the front matter (R-FM-008).

import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';
import type { EditorView, NodeView } from '@tiptap/pm/view';
import {
  checkFrontMatter,
  editFrontMatter,
  readFrontMatter,
  schemaAt,
  tomlText,
  tomlValue,
  typeOf,
  type FrontMatterEdit,
  type FrontMatterFormat,
  type FrontMatterPath,
  type FrontMatterProblem,
  type JsonSchema,
  type JsonSchemaObject,
} from '@nimblescape/markdowntext';
import { element, icon } from './dom';

/** FrontMatterInputContext is what an input of a plugin gets with the value that it shows. */
export interface FrontMatterInputContext {
  /** path is the path of the value. */
  path: FrontMatterPath;
  /** format is the format of the front matter. */
  format: FrontMatterFormat;
  /** editor is the Tiptap editor. */
  editor: Editor | undefined;
}

/** FrontMatterInput is the input of a plugin for the value of a key, for example Paper for `layout` (R-FM-006). */
export interface FrontMatterInput {
  /** key is the path of the key; a text is a key of the first level, for example `layout`. */
  key: string | FrontMatterPath;
  /** render returns the element that shows the value in place of the input of the form; it is read-only. */
  render(value: unknown, context: FrontMatterInputContext): HTMLElement;
}

/** FrontMatterFormHost is what the form needs from the interaction of the editor. */
export interface FrontMatterFormHost {
  /** editor returns the Tiptap editor. */
  editor(): Editor | undefined;
  /** schema returns the schema of the front matter, or undefined when the file has none. */
  schema(): JsonSchema | undefined;
  /** inputs are the inputs of plugins. */
  inputs: readonly FrontMatterInput[];
  /** forms holds the forms of the editor, which the interaction shows again after a switch of a mode. */
  forms: Set<FrontMatterForm>;
}

/** Mode is the mode of the form: fixed keys (R-FM-002) or edit the keys (R-FM-003). */
export type FrontMatterMode = 'fixed' | 'edit';

/** Kind is the kind of input of a value. */
type Kind = 'text' | 'lines' | 'number' | 'boolean' | 'choice' | 'date' | 'literal' | 'list' | 'group';

/** NewKind is a kind of value that the user adds as a new key. */
const newKinds: { kind: Kind; label: string; value: () => unknown }[] = [
  { kind: 'text', label: 'Text', value: () => '' },
  { kind: 'number', label: 'Number', value: () => 0 },
  { kind: 'boolean', label: 'Yes or no', value: () => false },
  { kind: 'list', label: 'List', value: () => [] },
  { kind: 'group', label: 'Group', value: () => ({}) },
];

/** formatNames are the names of the formats in the head of the form. */
const formatNames: Record<FrontMatterFormat, string> = { yaml: 'YAML', toml: 'TOML', json: 'JSON' };

/** isMap returns true for a map of keys: an object that is no list and no date. */
const isMap = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

/** keyOf returns the text of a path, which identifies a value in the form. */
const keyOf = (path: FrontMatterPath): string => JSON.stringify(path);

/** valueAt returns the value at a path of the data, or undefined when the data has none. */
function valueAt(data: unknown, path: FrontMatterPath): unknown {
  let node = data;
  for (const segment of path) {
    if (node === null || typeof node !== 'object') {
      return undefined;
    }
    node = (node as Record<string | number, unknown>)[segment];
  }
  return node;
}

/** kindByValue returns the kind of input of a value by its type. */
function kindByValue(value: unknown): Kind | undefined {
  if (Array.isArray(value)) {
    return 'list';
  }
  if (value instanceof Date) {
    return 'literal';
  }
  if (isMap(value)) {
    return 'group';
  }
  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return value.includes('\n') ? 'lines' : 'text';
    default:
      return undefined;
  }
}

/** kindOf returns the kind of input of a value: by its schema, or by its type when it does not fit its schema. */
function kindOf(value: unknown, schema: JsonSchemaObject | undefined): Kind {
  const byValue = kindByValue(value);
  if (schema?.enum && byValue !== 'list' && byValue !== 'group') {
    return 'choice';
  }
  const type = typeOf(schema);
  const bySchema: Kind | undefined =
    type === 'array'
      ? 'list'
      : type === 'object'
        ? 'group'
        : type === 'boolean'
          ? 'boolean'
          : type === 'number' || type === 'integer'
            ? 'number'
            : type === 'string'
              ? schema?.format === 'date'
                ? 'date'
                : 'text'
              : undefined;
  if (bySchema === 'date' && (byValue === undefined || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)))) {
    return 'date';
  }
  if (byValue && bySchema !== byValue) {
    return byValue;
  }
  return bySchema ?? byValue ?? 'text';
}

/** emptyOf returns the value of a new item of a list: from its schema, else of the kind of the last item, else a text. */
function emptyOf(schema: JsonSchemaObject | undefined, last: unknown): unknown {
  if (schema?.default !== undefined) {
    return structuredClone(schema.default);
  }
  if (schema?.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }
  const kind = schema ? kindOf(undefined, schema) : (kindByValue(last) ?? 'text');
  return newKinds.find((item) => item.kind === kind)?.value() ?? '';
}

/** describe returns the text of a value that the user cannot change. */
function describe(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return 'No value';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value instanceof Date) {
    return tomlText(value);
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Field is the information of the form about one value. */
interface Field {
  path: FrontMatterPath;
  value: unknown;
  schema: JsonSchemaObject | undefined;
  /** present is false for a key of the schema that the front matter does not have yet. */
  present: boolean;
}

/** focusable selects the elements of the form that take the focus: inputs, buttons, and the elements of plugins. */
const focusable = 'input, select, textarea, button, a[href], [tabindex]:not([tabindex="-1"])';

/** controlsOf returns the elements of a box that take the focus, in their order, without the ones that are disabled. */
const controlsOf = (box: HTMLElement): HTMLElement[] =>
  [...box.querySelectorAll<HTMLElement>(focusable)].filter((item) => !(item as HTMLInputElement).disabled);

/** isText returns true for an input that has a cursor in its text: a line of text or a text of lines. */
const isText = (item: Element): item is HTMLInputElement | HTMLTextAreaElement =>
  item instanceof HTMLTextAreaElement || (item instanceof HTMLInputElement && ['text', 'search', 'url', 'email', 'tel', 'password'].includes(item.type));

/** lineStartOf returns the place where the line of a place of a text starts. */
const lineStartOf = (value: string, at: number): number => (at === 0 ? 0 : value.lastIndexOf('\n', at - 1) + 1);

/**
 * leaves returns true when the arrow up or down leaves an element: always, except in a text of lines, which the cursor
 * leaves only from its first line up and from its last line down.
 */
function leaves(item: HTMLElement, down: boolean): boolean {
  if (!(item instanceof HTMLTextAreaElement)) {
    return true;
  }
  const { selectionStart: start, selectionEnd: end, value } = item;
  if (start !== end) {
    return false;
  }
  return down ? !value.includes('\n', end) : lineStartOf(value, start) === 0;
}

/** Focus is the element that has the focus, which the form gives the focus again after it shows itself again. */
interface Focus {
  id: string;
  start: number | null;
  end: number | null;
}

/** FrontMatterForm is the view of the front matter in the editor: the form, or the text when it does not parse. */
export class FrontMatterForm implements NodeView {
  readonly dom: HTMLElement;
  private node: PmNode;
  private text: string;
  private mode: FrontMatterMode | undefined;
  private data: unknown;
  private problems = new Map<string, string[]>();
  private notices = new Map<string, string>();
  private pending = 0;
  private ids = 0;
  /**
   * moved is the element that the last arrow up or down went to, with the column that the cursor keeps while it goes
   * on up or down, and the place where it put the cursor in a text.
   */
  private moved: { id: string; column: number; place: number | undefined } | undefined;

  /**
   * @param node - The node of the front matter.
   * @param view - The view of the editor.
   * @param getPos - Returns the position of the node.
   * @param host - What the form needs from the interaction.
   */
  constructor(
    node: PmNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly host: FrontMatterFormHost,
  ) {
    this.node = node;
    this.text = node.attrs.text as string;
    this.dom = element('div', { class: 'nsmd-fm', contenteditable: 'false', 'data-format': this.format });
    this.dom.addEventListener('keydown', (event) => this.key(event));
    host.forms.add(this);
    this.render();
  }

  /** format is the format of the front matter. */
  get format(): FrontMatterFormat {
    return this.node.attrs.format as FrontMatterFormat;
  }

  /** currentMode is the mode of the form now. */
  get currentMode(): FrontMatterMode {
    return this.mode ?? (this.host.schema() === undefined ? 'edit' : 'fixed');
  }

  /**
   * setMode switches the form between fixed keys and the edit of the keys.
   * @param mode - The mode.
   */
  setMode(mode: FrontMatterMode): void {
    this.mode = mode;
    this.render({ id: 'mode', start: null, end: null });
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) {
      return false;
    }
    const changed = node.attrs.text !== this.text || node.attrs.format !== this.node.attrs.format;
    this.node = node;
    if (changed) {
      this.text = node.attrs.text as string;
      this.notices.clear();
      this.render();
    }
    return true;
  }

  stopEvent(): boolean {
    // The inputs of the form take their own events: the keys, the mouse and the clipboard.
    return true;
  }

  ignoreMutation(): boolean {
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  destroy(): void {
    clearTimeout(this.pending);
    this.host.forms.delete(this);
  }

  /** refresh shows the form again, for example after a switch between editing and reading. */
  refresh(): void {
    this.render();
  }

  /**
   * focusLast gives the focus to the last line of the form, for the arrow up or left from the start of the text after
   * the front matter (R-FM-008).
   * @returns false when the form has no element that takes the focus, for example in the read-only mode.
   */
  focusLast(): boolean {
    const lines = this.lines();
    const last = lines[lines.length - 1];
    if (!last) {
      return false;
    }
    this.moved = undefined;
    this.goTo(last[0], false);
    return true;
  }

  /**
   * key moves the cursor with the keys (R-FM-008): the arrow up and down go to the line before and after, in the same
   * column, and from the last line into the text after the front matter; Tab on the last element goes there too.
   */
  private key(event: KeyboardEvent): void {
    const target = event.target;
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || !(target instanceof HTMLElement)) {
      return;
    }
    if (event.key === 'Tab') {
      const all = controlsOf(this.dom);
      if (!event.shiftKey && all[all.length - 1] === target && this.toText()) {
        event.preventDefault();
      }
      return;
    }
    if (event.shiftKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return;
    }
    const down = event.key === 'ArrowDown';
    const lines = this.lines();
    const at = lines.findIndex((line) => line.includes(target));
    if (at < 0 || !leaves(target, down)) {
      return;
    }
    const next = lines[at + (down ? 1 : -1)];
    if (!next) {
      if (down && this.toText()) {
        event.preventDefault();
      }
      return;
    }
    event.preventDefault();
    this.goTo(next[Math.min(lines[at].indexOf(target), next.length - 1)], down, this.columnOf(target));
  }

  /**
   * lines returns the elements of the form that take the focus, by lines: the head, and each row of a key, of an item
   * of a list and of a new key. The elements of a row after the rows inside it, for example the button that adds an
   * item after the items, are a line of their own.
   */
  private lines(): HTMLElement[][] {
    const lines: HTMLElement[][] = [];
    let row: Element | null = null;
    for (const item of controlsOf(this.dom)) {
      const of = item.closest('.nsmd-fm-head, .nsmd-fm-item, .nsmd-fm-field, .nsmd-fm-add, .nsmd-fm-text-view');
      if (lines.length === 0 || of !== row) {
        lines.push([]);
        row = of;
      }
      lines[lines.length - 1].push(item);
    }
    return lines;
  }

  /**
   * columnOf returns the column of the cursor in an element: the column that it kept while it went up or down to the
   * element, while it stays where it went to, else its place in its line, or undefined when the element has no text.
   */
  private columnOf(item: HTMLElement): number | undefined {
    const moved = this.moved;
    const text = isText(item);
    if (moved && item.dataset.focus === moved.id && (moved.place === undefined || (text && item.selectionStart === moved.place && item.selectionEnd === moved.place))) {
      return moved.column;
    }
    if (!text) {
      return undefined;
    }
    const start = item.selectionStart ?? item.value.length;
    return start - lineStartOf(item.value, start);
  }

  /**
   * goTo gives the focus to an element of the form. In a text, the cursor goes to the column where it was in the line
   * before, or to the end; in a text of lines, into its first line from above and into its last line from below.
   */
  private goTo(item: HTMLElement, down: boolean, column?: number): void {
    item.focus();
    const id = item.dataset.focus;
    if (!isText(item)) {
      this.moved = id === undefined || column === undefined ? undefined : { id, column, place: undefined };
      return;
    }
    const { value } = item;
    const lineStart = down ? 0 : lineStartOf(value, value.length);
    const lineEnd = down && value.includes('\n') ? value.indexOf('\n') : value.length;
    const place = column === undefined ? lineEnd : Math.min(lineStart + column, lineEnd);
    item.setSelectionRange(place, place);
    this.moved = id === undefined || column === undefined ? undefined : { id, column, place };
  }

  /**
   * toText puts the cursor of the editor at the start of the text after the front matter (R-FM-008); the input that
   * loses the focus writes its value first.
   * @returns false when the document has no place for the cursor after the front matter.
   */
  private toText(): boolean {
    const pos = this.getPos();
    if (pos === undefined || !Selection.findFrom(this.view.state.doc.resolve(pos + this.node.nodeSize), 1)) {
      return false;
    }
    this.moved = undefined;
    this.view.focus();
    const after = this.getPos();
    const selection = after === undefined ? null : Selection.findFrom(this.view.state.doc.resolve(after + this.node.nodeSize), 1);
    if (selection) {
      this.view.dispatch(this.view.state.tr.setSelection(selection).scrollIntoView());
    }
    return true;
  }

  /** editable is true when the user can change the front matter. */
  private get editable(): boolean {
    return this.view.editable;
  }

  /** render builds the form from the text of the front matter, and gives the focus back to the element that had it. */
  private render(focus: Focus | undefined = this.focused()): void {
    this.dom.replaceChildren();
    this.dom.dataset.format = this.format;
    let data: unknown;
    let error: string | undefined;
    try {
      data = readFrontMatter(this.text, this.format);
      if (!isMap(data)) {
        error = 'The front matter must be a map of keys.';
      }
    } catch (problem) {
      error = (problem as Error).message;
    }
    this.data = data;
    const schema = this.host.schema();
    this.problems.clear();
    if (error === undefined && schema !== undefined) {
      for (const problem of checkFrontMatter(data, schema)) {
        this.addProblem(problem);
      }
    }
    this.dom.append(this.head(error === undefined));
    if (error !== undefined) {
      this.dom.append(this.textView(error));
    } else {
      this.dom.append(this.mapView([], data as Record<string, unknown>, schemaAt(schema, [])));
    }
    this.restore(focus);
  }

  private addProblem(problem: FrontMatterProblem): void {
    const key = keyOf(problem.path);
    this.problems.set(key, [...(this.problems.get(key) ?? []), problem.message]);
  }

  /** head returns the head of the form: its name, its format, its problems and the switch of the mode. */
  private head(parsed: boolean): HTMLElement {
    const count = [...this.problems.values()].reduce((sum, list) => sum + list.length, 0);
    const head = element(
      'div',
      { class: 'nsmd-fm-head' },
      element('span', { class: 'nsmd-fm-title' }, 'Front matter'),
      element('span', { class: 'nsmd-fm-format' }, formatNames[this.format]),
      count > 0 ? element('span', { class: 'nsmd-fm-count' }, count === 1 ? '1 problem' : `${count} problems`) : undefined,
      element('span', { class: 'nsmd-fm-spacer' }),
    );
    for (const message of this.problems.get(keyOf([])) ?? []) {
      head.append(element('span', { class: 'nsmd-fm-problem' }, message));
    }
    if (parsed && this.editable) {
      const edit = this.currentMode === 'edit';
      const title = edit ? 'Fix the keys' : this.host.schema() === undefined ? 'Add, rename and remove keys' : 'Add keys, and rename and remove the keys that the schema does not name';
      const button = element(
        'button',
        { type: 'button', class: 'nsmd-fm-mode', 'aria-pressed': String(edit), 'data-focus': 'mode', title },
        icon('edit'),
        'Edit keys',
      );
      button.addEventListener('click', () => this.setMode(edit ? 'fixed' : 'edit'));
      head.append(button);
    }
    return head;
  }

  /** textView returns the text of a front matter that does not parse, with its problem; the user edits the text. */
  private textView(error: string): HTMLElement {
    const box = element('div', { class: 'nsmd-fm-text-view' }, element('div', { class: 'nsmd-fm-problem', role: 'alert' }, error));
    const lines = this.text.split('\n');
    const fenced = this.format !== 'json';
    const body = fenced ? lines.slice(1, -1).join('\n') : this.text;
    const area = element('textarea', {
      class: 'nsmd-fm-textarea',
      rows: Math.min(20, Math.max(3, body.split('\n').length + 1)),
      spellcheck: 'false',
      'aria-label': 'The text of the front matter',
      'data-focus': 'text',
      readonly: !this.editable,
    });
    area.value = body;
    area.addEventListener('change', () => {
      const text = fenced ? [lines[0], ...(area.value === '' ? [] : area.value.replace(/\n$/, '').split('\n')), lines[lines.length - 1]].join('\n') : area.value;
      this.write(text);
    });
    box.append(area);
    return box;
  }

  /** canEdit returns true when the user can change a value: the editor is editable, the schema allows it, no plugin shows it. */
  private canEdit(field: Field): boolean {
    return this.editable && field.schema?.readOnly !== true && !this.inputOf(field.path);
  }

  /** inputOf returns the input of a plugin for a path. */
  private inputOf(path: FrontMatterPath): FrontMatterInput | undefined {
    const key = keyOf(path);
    return this.host.inputs.find((input) => keyOf(typeof input.key === 'string' ? [input.key] : input.key) === key);
  }

  /** mapView returns the fields of a map: the keys of its schema in their order, then the other keys of the file. */
  private mapView(path: FrontMatterPath, value: Record<string, unknown> | undefined, schema: JsonSchemaObject | undefined): HTMLElement {
    const box = element('div', { class: 'nsmd-fm-fields' });
    const keys = [...Object.keys(schema?.properties ?? {})];
    for (const key of Object.keys(value ?? {})) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      const fieldPath = [...path, key];
      const present = value !== undefined && Object.hasOwn(value, key);
      box.append(this.fieldView({ path: fieldPath, value: present ? value[key] : undefined, schema: schemaAt(this.host.schema(), fieldPath), present }, schema));
    }
    if (this.editable && this.currentMode === 'edit' && schema?.readOnly !== true) {
      box.append(this.addKeyView(path));
    }
    return box;
  }

  /**
   * fieldView returns the row of a key: its name, its input, its problems and, in the edit of the keys, its buttons. A
   * key that the schema names stays in both modes: the user renames and removes only the other keys (R-FM-003).
   */
  private fieldView(field: Field, parent: JsonSchemaObject | undefined): HTMLElement {
    const name = String(field.path[field.path.length - 1]);
    const id = `nsmd-fm-${++this.ids}`;
    const ofSchema = parent?.properties !== undefined && Object.hasOwn(parent.properties, name);
    const editKeys = this.editable && this.currentMode === 'edit' && field.present && !ofSchema && field.schema?.readOnly !== true;
    const required = parent?.required?.includes(name) ?? false;
    const row = element('div', { class: 'nsmd-fm-field', 'data-path': keyOf(field.path) });
    const label = editKeys
      ? this.keyInput(field, id)
      : element('label', { class: 'nsmd-fm-key', for: id, title: [field.schema?.description, field.schema?.title ? name : undefined].filter(Boolean).join(' · ') || undefined }, field.schema?.title ?? name);
    if (required) {
      label.append(element('span', { class: 'nsmd-fm-required', title: 'The schema requires this key' }, ' *'));
    }
    row.append(label, this.valueView(field, id));
    if (editKeys) {
      const remove = element('button', { type: 'button', class: 'nsmd-fm-remove', 'aria-label': `Remove the key ${name}`, title: `Remove the key ${name}`, 'data-focus': `remove ${keyOf(field.path)}` }, icon('close'));
      remove.addEventListener('click', () => this.apply({ kind: 'remove', path: field.path }, { id: `add-name ${keyOf(field.path.slice(0, -1))}`, start: null, end: null }));
      row.append(remove);
    }
    row.append(...this.messages(field.path, id));
    if (!field.present) {
      row.classList.add('nsmd-fm-missing');
    }
    return row;
  }

  /** keyInput returns the input of the name of a key, in the edit of the keys. */
  private keyInput(field: Field, id: string): HTMLElement {
    const name = String(field.path[field.path.length - 1]);
    const input = element('input', { type: 'text', class: 'nsmd-fm-key-input', value: name, 'aria-label': `The name of the key ${name}`, 'data-focus': `key ${keyOf(field.path)}`, spellcheck: 'false' });
    input.value = name;
    onCommit(input, () => {
      const key = input.value.trim();
      if (key === '' || key === name) {
        input.value = name;
        return;
      }
      this.apply({ kind: 'rename', path: field.path, key }, { id: `key ${keyOf([...field.path.slice(0, -1), key])}`, start: null, end: null });
    });
    const box = element('span', { class: 'nsmd-fm-key' }, input);
    box.dataset.for = id;
    return box;
  }

  /** messages returns the problems and the notices of a value. */
  private messages(path: FrontMatterPath, id: string): HTMLElement[] {
    const texts = [...(this.problems.get(keyOf(path)) ?? [])];
    const notice = this.notices.get(keyOf(path));
    if (notice) {
      texts.push(notice);
    }
    return texts.map((text, index) => element('div', { class: 'nsmd-fm-problem', id: `${id}-problem-${index}` }, text));
  }

  /** valueView returns the input of a value, or its text when the user cannot change it. */
  private valueView(field: Field, id: string): HTMLElement {
    const box = element('div', { class: 'nsmd-fm-value' });
    const input = this.inputOf(field.path);
    if (input && field.present) {
      box.append(input.render(field.value, { path: field.path, format: this.format, editor: this.host.editor() }));
      return box;
    }
    const kind = kindOf(field.value, field.schema);
    if (kind === 'list') {
      box.append(this.listView(field));
      return box;
    }
    if (kind === 'group') {
      box.append(this.mapView(field.path, isMap(field.value) ? field.value : undefined, field.schema));
      return box;
    }
    if (!this.canEdit(field)) {
      box.append(element('span', { class: `nsmd-fm-static${field.value === undefined || field.value === null || field.value === '' ? ' nsmd-fm-empty' : ''}`, id }, describe(field.value)));
      return box;
    }
    const problems = (this.problems.get(keyOf(field.path))?.length ?? 0) + (this.notices.has(keyOf(field.path)) ? 1 : 0);
    const control = this.control(kind, field, id);
    if (problems > 0) {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', Array.from({ length: problems }, (_, index) => `${id}-problem-${index}`).join(' '));
    }
    box.append(control);
    return box;
  }

  /** control returns the input of a value of a kind, which writes the value when the user changes it. */
  private control(kind: Kind, field: Field, id: string): HTMLElement {
    const focus = `value ${keyOf(field.path)}`;
    const value = field.value;
    const label = String(field.path[field.path.length - 1]);
    switch (kind) {
      case 'boolean': {
        const box = element('input', { type: 'checkbox', class: 'nsmd-fm-check', id, 'data-focus': focus, 'aria-label': label });
        box.checked = value === true;
        box.addEventListener('change', () => this.setValue(field, box.checked));
        return box;
      }
      case 'choice': {
        const options = field.schema?.enum ?? [];
        const select = element('select', { class: 'nsmd-fm-select', id, 'data-focus': focus, 'aria-label': label });
        const index = options.findIndex((option) => option === value);
        if (index < 0) {
          select.append(element('option', { value: '' }, value === undefined ? '' : describe(value)));
        }
        options.forEach((option, at) => select.append(element('option', { value: String(at) }, describe(option))));
        select.value = index < 0 ? '' : String(index);
        select.addEventListener('change', () => {
          if (select.value !== '') {
            this.setValue(field, options[Number(select.value)]);
          }
        });
        return select;
      }
      case 'number': {
        const integer = typeOf(field.schema) === 'integer';
        const input = element('input', {
          type: 'number',
          class: 'nsmd-fm-input',
          id,
          'data-focus': focus,
          'aria-label': label,
          step: integer ? 1 : 'any',
          min: field.schema?.minimum,
          max: field.schema?.maximum,
        });
        input.value = typeof value === 'number' ? String(value) : '';
        onCommit(input, () => {
          const number = input.value.trim() === '' ? null : Number(input.value);
          if (number === null || !Number.isNaN(number)) {
            this.setValue(field, number);
          }
        });
        return input;
      }
      case 'lines': {
        const area = element('textarea', { class: 'nsmd-fm-textarea', id, 'data-focus': focus, 'aria-label': label, rows: Math.min(12, String(value ?? '').split('\n').length + 1) });
        area.value = typeof value === 'string' ? value : '';
        area.addEventListener('change', () => this.setValue(field, area.value));
        return area;
      }
      case 'literal': {
        const input = element('input', { type: 'text', class: 'nsmd-fm-input', id, 'data-focus': focus, 'aria-label': label, spellcheck: 'false' });
        input.value = value instanceof Date ? tomlText(value) : describe(value);
        onCommit(input, () => {
          const parsed = tomlValue(input.value.trim());
          if (parsed instanceof Date) {
            this.setValue(field, parsed);
          } else {
            this.notice(field.path, 'The value must be a date or a time of TOML, such as 2026-11-02.');
          }
        });
        return input;
      }
      case 'date':
      case 'text':
      default: {
        const input = element('input', { type: kind === 'date' ? 'date' : 'text', class: 'nsmd-fm-input', id, 'data-focus': focus, 'aria-label': label });
        input.value = typeof value === 'string' ? value : value === undefined || value === null ? '' : describe(value);
        if (field.schema?.default !== undefined && !field.present) {
          input.placeholder = describe(field.schema.default);
        }
        onCommit(input, () => this.setValue(field, input.value));
        return input;
      }
    }
  }

  /** listView returns the items of a list, with buttons to add and to remove items where the user can change the list. */
  private listView(field: Field): HTMLElement {
    const items = Array.isArray(field.value) ? field.value : [];
    const box = element('div', { class: 'nsmd-fm-list' });
    // The schema allows to change a list when it defines the list; the edit of the keys allows it for every list.
    const changeable = this.canEdit(field) && (this.currentMode === 'edit' || typeOf(field.schema) === 'array');
    items.forEach((item, index) => {
      const path = [...field.path, index];
      const id = `nsmd-fm-${++this.ids}`;
      const row = element('div', { class: 'nsmd-fm-item', 'data-path': keyOf(path) });
      row.append(this.valueView({ path, value: item, schema: schemaAt(this.host.schema(), path), present: true }, id));
      if (changeable) {
        const remove = element('button', { type: 'button', class: 'nsmd-fm-remove', 'aria-label': `Remove item ${index + 1}`, title: `Remove item ${index + 1}`, 'data-focus': `remove ${keyOf(path)}` }, icon('close'));
        remove.addEventListener('click', () => this.apply({ kind: 'remove', path }, { id: `add-item ${keyOf(field.path)}`, start: null, end: null }));
        row.append(remove);
      }
      row.append(...this.messages(path, id));
      box.append(row);
    });
    if (items.length === 0 && !changeable) {
      box.append(element('span', { class: 'nsmd-fm-static nsmd-fm-empty' }, 'No items'));
    }
    if (changeable) {
      const add = element('button', { type: 'button', class: 'nsmd-fm-add-item', 'data-focus': `add-item ${keyOf(field.path)}` }, icon('plus'), 'Add an item');
      add.addEventListener('click', () => {
        const path = [...field.path, items.length];
        const value = emptyOf(schemaAt(this.host.schema(), path), items[items.length - 1]);
        if (field.present) {
          this.apply({ kind: 'set', path, value }, { id: `value ${keyOf(path)}`, start: null, end: null });
        } else {
          this.setValue(field, [value], { id: `value ${keyOf(path)}`, start: null, end: null });
        }
      });
      box.append(add);
    }
    return box;
  }

  /** addKeyView returns the row that adds a key to a map: its name and the kind of its value. */
  private addKeyView(path: FrontMatterPath): HTMLElement {
    const name = element('input', { type: 'text', class: 'nsmd-fm-input nsmd-fm-new-key', placeholder: 'New key', 'aria-label': 'The name of the new key', 'data-focus': `add-name ${keyOf(path)}`, spellcheck: 'false' });
    const kind = element('select', { class: 'nsmd-fm-select', 'aria-label': 'The kind of the new value', 'data-focus': `add-kind ${keyOf(path)}` });
    newKinds.forEach((item, index) => kind.append(element('option', { value: String(index) }, item.label)));
    const button = element('button', { type: 'button', class: 'nsmd-fm-add-key', 'data-focus': `add-key ${keyOf(path)}` }, icon('plus'), 'Add the key');
    const row = element('div', { class: 'nsmd-fm-add' }, name, kind, button);
    const notice = this.notices.get(`add ${keyOf(path)}`);
    if (notice) {
      row.append(element('div', { class: 'nsmd-fm-problem' }, notice));
    }
    const add = () => {
      const key = name.value.trim();
      if (key === '') {
        name.focus();
        return;
      }
      const map = valueAt(this.data, path);
      if (isMap(map) && Object.hasOwn(map, key)) {
        this.notices.set(`add ${keyOf(path)}`, `The key ${key} is already there.`);
        this.render({ id: `add-name ${keyOf(path)}`, start: null, end: null });
        return;
      }
      const chosen = newKinds[Number(kind.value)] ?? newKinds[0];
      let text: string;
      try {
        text = editFrontMatter(this.text, this.format, { kind: 'set', path: [...path, key], value: chosen.value() });
      } catch (problem) {
        this.notices.set(`add ${keyOf(path)}`, (problem as Error).message);
        this.render({ id: `add-name ${keyOf(path)}`, start: null, end: null });
        return;
      }
      this.write(text, { id: `value ${keyOf([...path, key])}`, start: null, end: null });
    };
    button.addEventListener('click', add);
    name.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        add();
      }
    });
    return row;
  }

  /** setValue writes a new value: it changes a key that the file has, or adds a key of the schema after its key before. */
  private setValue(field: Field, value: unknown, focus?: Focus): void {
    if (field.present) {
      if (value === field.value) {
        return;
      }
      this.apply({ kind: 'set', path: field.path, value }, focus);
      return;
    }
    if (value === '' || value === null) {
      return;
    }
    // A key of the schema that the file does not have: the missing maps on its path come with it.
    let at = 0;
    while (at < field.path.length - 1 && valueAt(this.data, field.path.slice(0, at + 1)) !== undefined) {
      at++;
    }
    const target = field.path.slice(0, at + 1);
    let nested = value;
    for (let index = field.path.length - 1; index > at; index--) {
      const segment = field.path[index];
      nested = typeof segment === 'number' ? [nested] : { [segment]: nested };
    }
    this.apply({ kind: 'set', path: target, value: nested, after: this.keyBefore(target) }, focus);
  }

  /** keyBefore returns the key that the file has before a new key in the order of the schema, so that the file follows it. */
  private keyBefore(path: FrontMatterPath): string | undefined {
    const parent = path.slice(0, -1);
    const map = valueAt(this.data, parent);
    const order = Object.keys(schemaAt(this.host.schema(), parent)?.properties ?? {});
    const at = order.indexOf(String(path[path.length - 1]));
    for (let index = at - 1; index >= 0; index--) {
      if (isMap(map) && Object.hasOwn(map, order[index])) {
        return order[index];
      }
    }
    return undefined;
  }

  /** edited returns the text after an edit, or the text before it with a notice when the edit does not fit. */
  private edited(edit: FrontMatterEdit, noticePath: FrontMatterPath = edit.path): string {
    try {
      return editFrontMatter(this.text, this.format, edit);
    } catch (problem) {
      this.notice(noticePath, (problem as Error).message);
      return this.text;
    }
  }

  /** apply writes an edit into the document. */
  private apply(edit: FrontMatterEdit, focus?: Focus): void {
    this.write(this.edited(edit, edit.kind === 'remove' ? edit.path.slice(0, -1) : edit.path), focus);
  }

  /** notice shows a message at a value, for an edit that does not fit the front matter. */
  private notice(path: FrontMatterPath, message: string): void {
    this.notices.set(keyOf(path), message);
    this.later();
  }

  /**
   * write puts a new text of the front matter into the document as one step of undo, and shows the form again after
   * the focus has moved, for example to the next input after Tab.
   */
  private write(text: string, focus?: Focus): void {
    if (text !== this.text) {
      const pos = this.getPos();
      if (pos === undefined) {
        return;
      }
      this.text = text;
      this.notices.clear();
      const tr = closeHistory(this.view.state.tr).setNodeMarkup(pos, undefined, { ...this.node.attrs, text });
      this.view.dispatch(closeHistory(tr));
    }
    this.later(focus);
  }

  /** later shows the form again after the events of the browser, with the focus on an element or where it is then. */
  private later(focus?: Focus): void {
    clearTimeout(this.pending);
    this.pending = window.setTimeout(() => this.render(focus ?? this.focused()), 0);
  }

  /** focused returns the element of the form that has the focus. */
  private focused(): Focus | undefined {
    const active = this.dom.ownerDocument.activeElement;
    if (!(active instanceof HTMLElement) || !this.dom.contains(active) || !active.dataset.focus) {
      return undefined;
    }
    const text = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
    let start: number | null = null;
    let end: number | null = null;
    if (text) {
      try {
        start = active.selectionStart;
        end = active.selectionEnd;
      } catch {
        // Inputs of numbers and dates have no selection.
      }
    }
    return { id: active.dataset.focus, start, end };
  }

  /** restore gives the focus to the element of the form that had it before the form showed itself again. */
  private restore(focus: Focus | undefined): void {
    if (!focus) {
      return;
    }
    const target = [...this.dom.querySelectorAll<HTMLElement>('[data-focus]')].find((item) => item.dataset.focus === focus.id);
    if (!target) {
      return;
    }
    target.focus();
    if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && focus.start !== null) {
      try {
        target.setSelectionRange(focus.start, focus.end ?? focus.start);
      } catch {
        // Inputs of numbers and dates have no selection.
      }
    }
  }
}

/**
 * onCommit calls a function when the user changes an input: when it loses the focus, and on Enter. An input of a date
 * also reports a change while the user types the parts of the date, so it writes its value only when it loses the
 * focus.
 */
function onCommit(input: HTMLInputElement, commit: () => void): void {
  let last = input.value;
  const run = () => {
    if (input.value !== last && !input.validity.badInput) {
      last = input.value;
      commit();
    }
  };
  if (input.type !== 'date') {
    input.addEventListener('change', run);
  }
  input.addEventListener('blur', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      run();
    }
  });
}

/**
 * frontMatterView returns the function that creates the view of the front matter, for the prop `nodeViews` of a plugin.
 * @param host - What the form needs from the interaction.
 */
export function frontMatterView(host: FrontMatterFormHost): (node: PmNode, view: EditorView, getPos: () => number | undefined) => FrontMatterForm {
  return (node, view, getPos) => new FrontMatterForm(node, view, getPos, host);
}
