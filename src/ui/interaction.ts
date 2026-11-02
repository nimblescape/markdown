// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The interaction of the editor (docs/editor.md, R-GEN-003, R-EDIT-007, R-GEN-008, R-GEN-013): it puts the toolbar,
// the bar of find and replace, the format bar, the menus and the handles of the blocks around the text, and gives the
// editor the plugins and the keys of these parts as one Tiptap extension. The keys are those of R-EDIT-007, and also
// Ctrl+F for find and replace and Alt+Up and Alt+Down to move the block of the cursor (Cmd in place of Ctrl on macOS).

import { type Editor, Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { alertsPlugin } from './alerts';
import { Asker } from './ask';
import { BlockHandles, moveCurrentBlock } from './blockHandle';
import { element } from './dom';
import { findPlugin } from './find';
import { FindBar } from './findBar';
import { FormatBar, type FormatButton } from './formatBar';
import { insertItems } from './items';
import { isLearning, type LearnMarks, learnPlugin, setLearning } from './learnMode';
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
  /** learnMode true starts the editor in the mode to learn Markdown; the default is false. */
  learnMode?: boolean;
  /** learnToggle false leaves out the button of the mode to learn Markdown; the default is true. */
  learnToggle?: boolean;
  /** formatButtons are the buttons that extensions add to the format bar, for example Comment of Notes. */
  formatButtons?: FormatButton[];
  /** insertItems returns the items that extensions add to the insert menu and to the slash commands. */
  insertItems?: (editor: Editor) => MenuItem[];
  /** learnMarks are the marks that the mode to learn Markdown shows for the nodes and marks of extensions. */
  learnMarks?: LearnMarks;
  /**
   * language is the language of the document, for example `de`, for the order of the texts of a sorted column. The
   * default is the key `lang` of the front matter, else the language of the page.
   */
  language?: string;
}

/** frontMatterLanguage returns the key `lang` or `language` of the front matter of a document. */
function frontMatterLanguage(editor: Editor): string | undefined {
  const first = editor.state.doc.firstChild;
  if (first?.type.name !== 'frontMatter') {
    return undefined;
  }
  return /^\s*"?(?:lang|language)"?\s*[:=]\s*["']?([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*)/m.exec((first.attrs.text as string) ?? '')?.[1];
}

/** Interaction holds the parts of the interaction of one editor. */
export class Interaction {
  /** header holds the toolbar and the bar of find and replace, at the top of the editor. */
  readonly header: HTMLElement;
  /** box holds the text and the parts that show over it, for example the format bar. */
  readonly box: HTMLElement;
  private readonly menu: Menu;
  private readonly asker: Asker;
  private learning: boolean;
  private editor: Editor | undefined;
  private formatBar: FormatBar | undefined;
  private handles: BlockHandles | undefined;
  private tableHandles: TableHandles | undefined;
  private toolbar: Toolbar | undefined;
  private findBar: FindBar | undefined;

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
    this.learning = options.learnMode ?? false;
    document.addEventListener('mousedown', this.onDocumentDown, true);
    document.addEventListener('mouseup', this.onDocumentUp, true);
  }

  /** extension returns the Tiptap extension with the plugins and the keys of the interaction. */
  extension(): Extension {
    // The functions are arrow functions, so that `this` is the interaction and not the context of Tiptap.
    const plugins = () => [
      slashPlugin({ menu: this.menu, items: () => this.insertItems() }),
      findPlugin(),
      learnPlugin(() => this.learning, this.options.learnMarks),
      alertsPlugin(isLearning),
      tablesPlugin(isLearning),
      new Plugin({
        view: () => ({ update: (view) => this.update(view) }),
        props: {
          handleKeyDown: (_view, event) => this.menuKey(event),
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
    this.handles = new BlockHandles(view, { box: this.box, menu: this.menu, insertItems: () => this.insertItems() });
    this.tableHandles = new TableHandles(view, {
      box: this.box,
      menu: this.menu,
      ask: (label, value) => this.ask(label, value),
      language: () => this.options.language ?? frontMatterLanguage(editor) ?? (document.documentElement.lang || undefined),
      insertItems: () => this.insertItems(),
      menuOpened: () => this.formatBar?.hide(),
    });
    if (this.options.toolbar ?? true) {
      this.toolbar = new Toolbar({
        editor,
        menu: this.menu,
        insertItems: () => this.insertItems(),
        openFind: () => this.openFind(),
        learn: (this.options.learnToggle ?? true) ? { isOn: () => this.learning, toggle: () => this.setLearnMode(!this.learning) } : undefined,
        editing: (this.options.readOnlyToggle ?? true) ? { isOn: () => editor.isEditable, toggle: editing.toggle } : undefined,
      });
      this.header.append(this.toolbar.dom);
    }
    this.header.append(this.findBar.dom);
    this.update(view);
  }

  /** isLearning is true while the mode to learn Markdown is on. */
  get isLearning(): boolean {
    return this.learning;
  }

  /**
   * setLearnMode switches the mode to learn Markdown on or off (R-GEN-013).
   * @param on - true to show the Markdown marks.
   */
  setLearnMode(on: boolean): void {
    this.learning = on;
    if (this.editor) {
      setLearning(this.editor.view, on);
    }
  }

  /** openFind opens the bar of find and replace. */
  openFind(): boolean {
    this.menu.close();
    this.findBar?.open();
    return true;
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

  private insertItems(): MenuItem[] {
    const editor = this.editor;
    if (!editor) {
      return [];
    }
    return [...insertItems(editor, (label, value) => this.ask(label, value)), ...(this.options.insertItems?.(editor) ?? [])];
  }

  private update(view: EditorView): void {
    this.formatBar?.update(view);
    this.toolbar?.update();
    this.findBar?.update();
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
