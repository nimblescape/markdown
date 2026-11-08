// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The interaction of the editor (docs/editor.md, R-GEN-003, R-EDIT-007, R-GEN-008): it puts the toolbar,
// the bar of find and replace, the format bar, the menus and the handles of the blocks around the text, and gives the
// editor the plugins and the keys of these parts as one Tiptap extension. The keys are those of R-EDIT-007, and also
// Ctrl+F for find and replace and Alt+Up and Alt+Down to move the block of the cursor (Cmd in place of Ctrl on macOS).
// The front matter shows as a form (R-FM-001), with the schema and the inputs of plugins that the options give; the
// arrow up and left at the start of the text after the front matter go into the form (R-FM-008).

import { type Editor, Extension } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin, Selection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { readFrontMatter, type FrontMatterFormat, type JsonSchema } from '@nimblescape/markdowntext';
import { alertTextStart, alertsPlugin } from './alerts';
import { Asker } from './ask';
import { BlockHandles, moveCurrentBlock } from './blockHandle';
import { element } from './dom';
import { findPlugin } from './find';
import { FindBar } from './findBar';
import { FormatBar, type FormatButton } from './formatBar';
import { type FrontMatterForm, type FrontMatterInput, frontMatterView } from './frontMatterForm';
import { insertItems } from './items';
import { canGo, goBack, goForward, hasPlaces, jumpsPlugin, type JumpsOptions } from './jumps';
import { Menu, type MenuItem } from './menu';
import { slashPlugin } from './slash';
import { TableHandles } from './table/tableHandles';
import { tablesPlugin } from './table/tables';
import { Toolbar } from './toolbar';

/** InteractionOptions configure the interaction of the editor. */
export interface InteractionOptions {
  /** toolbar false leaves the toolbar out; the default is true. */
  toolbar?: boolean;
  /** readOnlyToggle false leaves out the button that switches between editing and reading; the default is true. */
  readOnlyToggle?: boolean;
  /** formatButtons are the buttons that extensions add to the format bar, for example Comment of Notes. */
  formatButtons?: FormatButton[];
  /** insertItems returns the items that extensions add to the insert menu and to the slash commands. */
  insertItems?: (editor: Editor) => MenuItem[];
  /** blockItems returns the items that extensions add to the menu of a block, under its handle. */
  blockItems?: (editor: Editor, block: { node: PmNode; pos: number }) => MenuItem[];
  /** tableItems returns the items that extensions add to the table menu of a table. */
  tableItems?: (editor: Editor, table: { node: PmNode; pos: number }) => MenuItem[];
  /**
   * language is the language of the document, for example `de`, for the order of the texts of a sorted column. The
   * default is the key `lang` of the front matter, else the language of the page.
   */
  language?: string;
  /** frontMatterForm false shows the front matter as its text, without the form; the default is true (R-FM-001). */
  frontMatterForm?: boolean;
  /**
   * frontMatterSchema is the JSON schema of the front matter, or returns it, for example the schema of the layout of
   * a paper (R-FM-004). Without a schema, the form opens in the mode to edit the keys.
   */
  frontMatterSchema?: JsonSchema | ((editor: Editor) => JsonSchema | undefined);
  /** frontMatterInputs are the inputs of plugins for the values of keys of the front matter (R-FM-006). */
  frontMatterInputs?: FrontMatterInput[];
  /**
   * jumps gives the keys of Go Back and Go Forward after a jump to a place of the document, for example those of VS
   * Code, and whether the editor takes the back and forward buttons of the mouse (R-EDIT-014).
   */
  jumps?: JumpsOptions;
}

/** frontMatterLanguage returns the key `lang` or `language` of the front matter of a document. */
function frontMatterLanguage(editor: Editor): string | undefined {
  const first = editor.state.doc.firstChild;
  if (first?.type.name !== 'frontMatter') {
    return undefined;
  }
  try {
    const data = readFrontMatter(first.attrs.text as string, first.attrs.format as FrontMatterFormat) as Record<string, unknown>;
    const language = data.lang ?? data.language;
    return typeof language === 'string' ? language : undefined;
  } catch {
    return undefined;
  }
}

/** Interaction holds the parts of the interaction of one editor. */
export class Interaction {
  /** header holds the toolbar and the bar of find and replace, at the top of the editor. */
  readonly header: HTMLElement;
  /** box holds the text and the parts that show over it, for example the format bar. */
  readonly box: HTMLElement;
  private readonly menu: Menu;
  private readonly asker: Asker;
  /** readOnlyShown is false while the toolbar hides the switch between editing and reading. */
  private readOnlyShown = true;
  private editor: Editor | undefined;
  private formatBar: FormatBar | undefined;
  private handles: BlockHandles | undefined;
  private tableHandles: TableHandles | undefined;
  private toolbar: Toolbar | undefined;
  private findBar: FindBar | undefined;
  private schema: JsonSchema | ((editor: Editor) => JsonSchema | undefined) | undefined;
  private readonly forms = new Set<FrontMatterForm>();

  /**
   * @param root - The element of the editor.
   * @param options - The configuration of the interaction.
   */
  constructor(
    root: HTMLElement,
    private readonly options: InteractionOptions = {},
  ) {
    this.header = element('div', { class: 'nsmd-header' });
    this.box = element('div', { class: 'nsmd-box' });
    root.append(this.header, this.box);
    this.menu = new Menu(this.box, 'Items');
    this.asker = new Asker(this.box);
    this.schema = options.frontMatterSchema;
    document.addEventListener('mousedown', this.onDocumentDown, true);
    document.addEventListener('mouseup', this.onDocumentUp, true);
  }

  /** extension returns the Tiptap extension with the plugins and the keys of the interaction. */
  extension(): Extension {
    // The functions are arrow functions, so that `this` is the interaction and not the context of Tiptap.
    const plugins = () => [
      slashPlugin({ menu: this.menu, items: () => this.insertItems(true) }),
      findPlugin(),
      alertsPlugin(),
      tablesPlugin(),
      ...(this.options.frontMatterForm === false
        ? []
        : [
            new Plugin({
              props: {
                nodeViews: {
                  frontMatter: frontMatterView({
                    editor: () => this.editor,
                    schema: () => this.frontMatterSchema(),
                    inputs: this.options.frontMatterInputs ?? [],
                    forms: this.forms,
                  }),
                },
              },
            }),
          ]),
      new Plugin({
        view: () => ({ update: (view) => this.update(view) }),
        props: {
          handleKeyDown: (view, event) => this.menuKey(event) || this.toFrontMatter(view, event),
          handleDOMEvents: {
            mousedown: (view) => {
              this.formatBar?.pointer(true, view);
              return false;
            },
            blur: (view, event) => {
              this.blur(view, event);
              return false;
            },
            focus: (view) => {
              this.update(view);
              return false;
            },
          },
        },
      }),
    ];
    const keys = () => ({
      'Mod-k': () => this.editLink(),
      'Mod-f': () => this.openFind(),
      'Alt-ArrowUp': ({ editor }: { editor: Editor }) => moveCurrentBlock(editor.state, -1, editor.view.dispatch),
      'Alt-ArrowDown': ({ editor }: { editor: Editor }) => moveCurrentBlock(editor.state, 1, editor.view.dispatch),
    });
    return Extension.create({ name: 'nsmdInteraction', addProseMirrorPlugins: plugins, addKeyboardShortcuts: keys });
  }

  /**
   * jumpsExtension returns the Tiptap extension of the jumps (R-EDIT-014). Its priority is the lowest, so that its
   * Ctrl+click on a link comes after the plugins, for example after a generated part of a plugin with its own target.
   */
  jumpsExtension(): Extension {
    return Extension.create({ name: 'nsmdJumps', priority: 1, addProseMirrorPlugins: () => [jumpsPlugin(this.options.jumps)] });
  }

  /**
   * attach creates the parts that need the editor, after the editor is created.
   * @param editor - The Tiptap editor.
   * @param editing - The switch between editing and reading of the editor.
   */
  attach(editor: Editor, editing: { toggle: () => void }): void {
    this.editor = editor;
    const { view } = editor;
    this.findBar = new FindBar(view);
    this.formatBar = new FormatBar({ editor, box: this.box, menu: this.menu, buttons: this.options.formatButtons ?? [], editLink: () => this.editLink() });
    this.box.append(this.formatBar.dom);
    this.handles = new BlockHandles(view, {
      box: this.box,
      menu: this.menu,
      insertItems: () => this.insertItems(),
      blockItems: (block) => this.options.blockItems?.(editor, block) ?? [],
    });
    this.tableHandles = new TableHandles(view, {
      box: this.box,
      menu: this.menu,
      ask: (label, value) => this.ask(label, value),
      language: () => this.options.language ?? frontMatterLanguage(editor) ?? (document.documentElement.lang || undefined),
      insertItems: () => this.insertItems(),
      menuOpened: () => this.formatBar?.hide(),
      tableItems: (table) => this.options.tableItems?.(editor, table) ?? [],
    });
    if (this.options.toolbar ?? true) {
      this.toolbar = new Toolbar({
        editor,
        menu: this.menu,
        insertItems: () => this.insertItems(),
        openFind: () => this.openFind(),
        jumps: {
          shown: () => hasPlaces(editor.state),
          canGoBack: () => canGo(editor.state, 'back'),
          canGoForward: () => canGo(editor.state, 'forward'),
          back: () => goBack(editor.view),
          forward: () => goForward(editor.view),
          keys: this.options.jumps?.keys,
        },
        editing: (this.options.readOnlyToggle ?? true) ? { isOn: () => editor.isEditable, toggle: editing.toggle, isShown: () => this.readOnlyShown } : undefined,
      });
      this.header.append(this.toolbar.dom);
    }
    this.header.append(this.findBar.dom);
    this.update(view);
  }

  /**
   * setFrontMatterSchema gives the front matter a new JSON schema, or none, and shows the form again (R-FM-004).
   * @param schema - The schema, a function that returns it, or undefined for none.
   */
  setFrontMatterSchema(schema: JsonSchema | ((editor: Editor) => JsonSchema | undefined) | undefined): void {
    this.schema = schema;
    this.forms.forEach((form) => form.refresh());
  }

  /** refreshFrontMatter shows the forms of the front matter again, for example after a plugin received a new schema. */
  refreshFrontMatter(): void {
    this.forms.forEach((form) => form.refresh());
  }

  /** frontMatterSchema returns the JSON schema of the front matter now. */
  frontMatterSchema(): JsonSchema | undefined {
    const editor = this.editor;
    return typeof this.schema === 'function' ? (editor ? this.schema(editor) : undefined) : this.schema;
  }

  /** openFind opens the bar of find and replace. */
  openFind(): boolean {
    this.menu.close();
    this.findBar?.open();
    return true;
  }

  /**
   * setReadOnlyToggle shows or hides the switch between editing and reading in the toolbar, for example while the
   * editor shows a version that cannot change (R-GEN-008).
   * @param shown - false hides the switch.
   */
  setReadOnlyToggle(shown: boolean): void {
    this.readOnlyShown = shown;
    this.toolbar?.update();
  }

  /** refresh shows the state of the editor again, after a new text or a switch between editing and reading. */
  refresh(): void {
    if (!this.editor) {
      return;
    }
    this.menu.close();
    this.handles?.hide();
    this.tableHandles?.hide();
    this.findBar?.search();
    this.forms.forEach((form) => form.refresh());
    this.update(this.editor.view);
  }

  /** destroy removes the parts of the interaction from the page. */
  destroy(): void {
    document.removeEventListener('mousedown', this.onDocumentDown, true);
    document.removeEventListener('mouseup', this.onDocumentUp, true);
    this.handles?.destroy();
    this.tableHandles?.destroy();
    this.menu.destroy();
    this.asker.destroy();
    this.header.remove();
    this.box.remove();
  }

  /**
   * ask asks the user for a text in a field at the cursor.
   * @param label - What the field asks for.
   * @param value - The text that the field starts with.
   */
  ask(label: string, value = ''): Promise<string | undefined> {
    const view = this.editor?.view;
    let left = this.box.getBoundingClientRect().left;
    let top = this.box.getBoundingClientRect().top;
    if (view) {
      try {
        const coords = view.coordsAtPos(view.state.selection.to);
        left = coords.left;
        top = coords.bottom + 8;
      } catch {
        // The field shows at the top left of the text.
      }
    }
    this.formatBar?.hide();
    return this.asker.ask(label, value, left, top);
  }

  /** editLink asks for the address of the link of the selection, and sets, changes or removes the link. */
  editLink(): boolean {
    const editor = this.editor;
    if (!editor?.isEditable || !editor.schema.marks.link) {
      return false;
    }
    const inLink = editor.isActive('link');
    if (editor.state.selection.empty && !inLink) {
      return false;
    }
    if (inLink) {
      editor.commands.extendMarkRange('link');
    }
    const href = (editor.getAttributes('link').href as string | undefined) ?? '';
    void this.ask('Address of the link', href).then((address) => {
      const chain = editor.chain().focus();
      if (address === undefined) {
        chain.run();
      } else if (address === '') {
        chain.extendMarkRange('link').unsetLink().run();
      } else {
        chain.extendMarkRange('link').setLink({ href: address }).run();
      }
    });
    return true;
  }

  /**
   * insertItems returns the items of the insert menu and of the plugins. An item of a plugin with the id of an item of
   * the editor takes its place, for example a table with its caption, or hides it; the other items of the plugins
   * follow. Only the slash commands get the commands on selected text.
   * @param slash - true for the slash commands.
   */
  private insertItems(slash = false): MenuItem[] {
    const editor = this.editor;
    if (!editor) {
      return [];
    }
    const added = this.options.insertItems?.(editor) ?? [];
    const byId = new Map(added.map((item) => [item.id, item]));
    const own = insertItems(editor, (label, value) => this.ask(label, value));
    const replaced = new Set(own.filter((item) => byId.has(item.id)).map((item) => item.id));
    const items = [...own.map((item) => byId.get(item.id) ?? item), ...added.filter((item) => !replaced.has(item.id))].filter((item) => item.hidden !== true);
    return slash ? items : items.filter((item) => item.selection !== true);
  }

  private update(view: EditorView): void {
    this.formatBar?.update(view);
    this.toolbar?.update();
    this.findBar?.update();
  }

  /**
   * toFrontMatter gives the focus to the last line of the form of the front matter for the arrow up from the first line
   * of the text after the front matter, and for the arrow left from its start (R-FM-008).
   */
  private toFrontMatter(view: EditorView, event: KeyboardEvent): boolean {
    const up = event.key === 'ArrowUp';
    if ((!up && event.key !== 'ArrowLeft') || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
      return false;
    }
    const { doc, selection } = view.state;
    const first = doc.firstChild;
    const start = first?.type.name === 'frontMatter' ? Selection.findFrom(doc.resolve(first.nodeSize), 1) : null;
    if (!start) {
      return false;
    }
    const atStart =
      start instanceof NodeSelection
        ? selection.eq(start)
        : up
          ? selection.$head.start() === start.$head.start() && view.endOfTextblock('up')
          : selection.empty && (selection.head === start.head || selection.head === alertTextStart(view.state, start.head));
    const form = atStart ? [...this.forms].find((each) => view.dom.contains(each.dom)) : undefined;
    return form?.focusLast() ?? false;
  }

  /** menuKey gives the keys to an open menu that a button opened: the arrow keys, Enter and Escape. */
  private menuKey(event: KeyboardEvent): boolean {
    if (!this.menu.isOpen || this.menu.owner === 'slash') {
      return false;
    }
    if (this.menu.keydown(event)) {
      return true;
    }
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
      this.menu.close();
    }
    return false;
  }

  private blur(view: EditorView, event: Event): void {
    const next = (event as FocusEvent).relatedTarget;
    if (next instanceof Node && (this.box.contains(next) || this.header.contains(next))) {
      return;
    }
    if (this.menu.owner === 'slash') {
      this.menu.close();
    }
    this.formatBar?.update(view);
  }

  private readonly onDocumentDown = (event: MouseEvent) => {
    if (this.menu.isOpen && !(event.target instanceof Node && this.menu.dom.contains(event.target))) {
      this.menu.close();
    }
  };

  private readonly onDocumentUp = () => {
    const view = this.editor?.view;
    if (view) {
      // The selection is complete after the mouse is up, so the format bar shows after this event.
      setTimeout(() => {
        if (!this.editor?.isDestroyed) {
          this.formatBar?.pointer(false, view);
        }
      }, 0);
    }
  };
}
