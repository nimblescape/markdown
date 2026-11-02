// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The source of a file (docs/source.md, R-SRC-001, R-SRC-002; docs/specification.md, R-ARCH-001): the text of the file
// is the only truth. Every change, by the user in an editor, by an AI or by another program, is a list of text patches
// with its origin, and the source sends it to every listener: the other editors of the file, the renderer and, for
// example, a history. The source holds the selections of each editor and moves them with each change. It reads and
// saves the file through a TextFile, which the platform adapter gives, and a change of the file from outside, for
// example by Git, becomes a change of the text with the origin `program`.

import { applyPatches, checkPatches, mapPosition, patchesBetween, type TextPatch } from './patch';

/** OriginKind is who made a change: a user in an editor, an AI, or another program, for example Git or a formatter. */
export type OriginKind = 'user' | 'ai' | 'program';

/** Origin is the origin of a change of the text. */
export interface Origin {
  /** kind is who made the change. */
  readonly kind: OriginKind;
  /** editor is the ID of the editor that made the change, so that this editor does not take the change again. */
  readonly editor?: string;
  /** name names the program or the AI, for example `git`, `file` or the name of an AI agent. */
  readonly name?: string;
}

/** TextChange is a change of the text that the source sends to its listeners. */
export interface TextChange {
  /** patches are the patches of the change, with the positions of the text before it. */
  readonly patches: readonly TextPatch[];
  /** origin is who made the change. */
  readonly origin: Origin;
  /** before is the text before the change. */
  readonly before: string;
  /** text is the text after the change. */
  readonly text: string;
  /** version counts the changes of the text; the first text has version 0. */
  readonly version: number;
}

/** TextSelection is a selection in the text: from `anchor`, where it starts, to `head`, where the cursor is. */
export interface TextSelection {
  readonly anchor: number;
  readonly head: number;
}

/** TextFile is the file of a source, as the platform adapter gives it (docs/platforms.md, R-PLAT-001). */
export interface TextFile {
  /** read returns the text of the file. */
  read(): Promise<string>;
  /** write saves a text as the text of the file. */
  write(text: string): Promise<void>;
  /** watch calls a listener with the new text when the file changes from outside, and returns a function that ends it. */
  watch?(listener: (text: string) => void): () => void;
}

/**
 * mapSelection returns a selection after a change: it keeps the text that it selects, and text that the change inserts
 * at a cursor comes before the cursor.
 */
function mapSelection(selection: TextSelection, patches: readonly TextPatch[]): TextSelection {
  const { anchor, head } = selection;
  if (anchor === head) {
    const cursor = mapPosition(head, patches, 1);
    return { anchor: cursor, head: cursor };
  }
  const forward = anchor < head;
  return { anchor: mapPosition(anchor, patches, forward ? 1 : -1), head: mapPosition(head, patches, forward ? -1 : 1) };
}

/** fileOrigin is the origin of a change of the file from outside. */
const fileOrigin: Origin = { kind: 'program', name: 'file' };

/** TextSource holds the text of a file, the selections of its editors and the changes to the text. */
export class TextSource {
  private current: string;
  private count = 0;
  private savedText: string;
  private readonly changeListeners = new Set<(change: TextChange) => void>();
  private readonly selectionListeners = new Set<(editor: string, selections: readonly TextSelection[]) => void>();
  private readonly editorSelections = new Map<string, readonly TextSelection[]>();
  private readonly queue: (() => void)[] = [];
  private sending = false;
  private stopWatching: (() => void) | undefined;

  /**
   * @param text - The text of the file.
   * @param file - The file, to save the text and to take its changes from outside; without it the text stays in memory.
   */
  constructor(
    text = '',
    private readonly file?: TextFile,
  ) {
    this.current = text;
    this.savedText = text;
    this.stopWatching = file?.watch?.((fileText) => this.fileChanged(fileText));
  }

  /**
   * open reads a file and returns its source, which takes the changes of the file from outside.
   * @param file - The file.
   */
  static async open(file: TextFile): Promise<TextSource> {
    return new TextSource(await file.read(), file);
  }

  /** text is the text of the file. */
  get text(): string {
    return this.current;
  }

  /** version counts the changes of the text; the first text has version 0. */
  get version(): number {
    return this.count;
  }

  /** dirty is true while the text differs from the text of the file as it was read or saved last. */
  get dirty(): boolean {
    return this.current !== this.savedText;
  }

  /**
   * apply changes the text with patches and sends the change to every listener. A change without an effect sends
   * nothing.
   * @param patches - The patches, with the positions of the current text, in their order and without overlap.
   * @param origin - Who makes the change.
   * @returns The change, or undefined when the text stays the same.
   */
  apply(patches: readonly TextPatch[], origin: Origin): TextChange | undefined {
    checkPatches(this.current.length, patches);
    const effective = patches.filter((patch) => patch.from !== patch.to || patch.insert !== '');
    const text = applyPatches(this.current, effective);
    if (text === this.current) {
      return undefined;
    }
    return this.commit(effective, text, origin);
  }

  /**
   * setText changes the text to a new text, for example from an editor that gives its whole text or from a program
   * outside. The change holds only the patches of the lines that differ (R-SRC-002).
   * @param text - The new text.
   * @param origin - Who makes the change.
   * @returns The change, or undefined when the text stays the same.
   */
  setText(text: string, origin: Origin): TextChange | undefined {
    if (text === this.current) {
      return undefined;
    }
    return this.commit(patchesBetween(this.current, text), text, origin);
  }

  /**
   * onChange calls a listener after each change of the text.
   * @param listener - The listener.
   * @returns A function that removes the listener.
   */
  onChange(listener: (change: TextChange) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * setSelections sets the selections of an editor and sends them to every listener.
   * @param editor - The ID of the editor.
   * @param selections - The selections, with the positions of the current text.
   */
  setSelections(editor: string, selections: readonly TextSelection[]): void {
    const length = this.current.length;
    const fitted = selections.map(({ anchor, head }) => ({ anchor: Math.max(0, Math.min(anchor, length)), head: Math.max(0, Math.min(head, length)) }));
    const before = this.editorSelections.get(editor);
    if (before && before.length === fitted.length && before.every((selection, index) => selection.anchor === fitted[index].anchor && selection.head === fitted[index].head)) {
      return;
    }
    this.editorSelections.set(editor, fitted);
    this.send([...this.selectionListeners].map((listener) => () => listener(editor, fitted)));
  }

  /**
   * selections returns the selections of an editor, or an empty list.
   * @param editor - The ID of the editor.
   */
  selections(editor: string): readonly TextSelection[] {
    return this.editorSelections.get(editor) ?? [];
  }

  /** editors returns the IDs of the editors that have selections. */
  editors(): string[] {
    return [...this.editorSelections.keys()];
  }

  /**
   * removeEditor removes the selections of an editor, for example when it closes.
   * @param editor - The ID of the editor.
   */
  removeEditor(editor: string): void {
    if (this.editorSelections.delete(editor)) {
      this.send([...this.selectionListeners].map((listener) => () => listener(editor, [])));
    }
  }

  /**
   * onSelections calls a listener after each change of the selections of an editor, also when a change of the text
   * moves them.
   * @param listener - The listener, with the ID of the editor and its selections.
   * @returns A function that removes the listener.
   */
  onSelections(listener: (editor: string, selections: readonly TextSelection[]) => void): () => void {
    this.selectionListeners.add(listener);
    return () => this.selectionListeners.delete(listener);
  }

  /** save writes the text to the file. */
  async save(): Promise<void> {
    if (!this.file) {
      throw new Error('The source has no file.');
    }
    const text = this.current;
    await this.file.write(text);
    this.savedText = text;
  }

  /** dispose ends the watch of the file and removes all listeners. */
  dispose(): void {
    this.stopWatching?.();
    this.stopWatching = undefined;
    this.changeListeners.clear();
    this.selectionListeners.clear();
  }

  /** fileChanged takes a new text of the file from outside. */
  private fileChanged(text: string): void {
    this.savedText = text;
    this.setText(text, fileOrigin);
  }

  /** commit makes a change the text of the source, moves the selections and sends the change. */
  private commit(patches: readonly TextPatch[], text: string, origin: Origin): TextChange {
    const change: TextChange = { patches, origin, before: this.current, text, version: ++this.count };
    this.current = text;
    const moved: [string, TextSelection[]][] = [];
    for (const [editor, selections] of this.editorSelections) {
      // The editor that makes the change sets its own selections after it.
      if (editor === origin.editor) {
        continue;
      }
      const mapped = selections.map((selection) => mapSelection(selection, patches));
      if (mapped.some((selection, index) => selection.anchor !== selections[index].anchor || selection.head !== selections[index].head)) {
        this.editorSelections.set(editor, mapped);
        moved.push([editor, mapped]);
      }
    }
    this.send([
      ...[...this.changeListeners].map((listener) => () => listener(change)),
      ...moved.flatMap(([editor, selections]) => [...this.selectionListeners].map((listener) => () => listener(editor, selections))),
    ]);
    return change;
  }

  /**
   * send calls the listeners. A change that a listener makes while the source sends waits until every listener has the
   * change before it, so that each listener gets the changes in their order. An error of a listener stops no other
   * listener; the first error comes after all listeners ran.
   * @param calls - One call for each listener.
   */
  private send(calls: readonly (() => void)[]): void {
    this.queue.push(...calls);
    if (this.sending) {
      return;
    }
    this.sending = true;
    let failure: unknown;
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift() as () => void;
        try {
          next();
        } catch (error) {
          failure ??= error;
        }
      }
    } finally {
      this.sending = false;
    }
    if (failure !== undefined) {
      throw failure;
    }
  }
}
