// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The text patches of the source (docs/source.md, R-SRC-001, R-SRC-002): a change of a text is a list of patches, each
// of which replaces a range of the text before the change with a new text. The positions count the UTF-16 code units of
// the text, as the strings of JavaScript and the offsets of VS Code do. patchesBetween finds the patches between two
// texts with the line diff of the library `diff`, so that a change from outside, which gives only the new text, changes
// only the lines that differ, and inside them only the characters that differ.

import { diffLines } from 'diff';

/** TextPatch replaces the range from `from` to `to` of the text before a change with `insert`. */
export interface TextPatch {
  /** from is the position of the start of the range in the text before the change. */
  readonly from: number;
  /** to is the position of the end of the range in the text before the change; `to` equal to `from` inserts. */
  readonly to: number;
  /** insert is the new text of the range. */
  readonly insert: string;
}

/** maxEditLength limits the work of the line diff; a larger change becomes one patch. */
const maxEditLength = 5000;

/**
 * checkPatches throws when the patches of a change do not fit a text: each patch must lie in the text, after the patch
 * before it and without overlap.
 * @param length - The length of the text before the change.
 * @param patches - The patches of the change.
 */
export function checkPatches(length: number, patches: readonly TextPatch[]): void {
  let end = 0;
  for (const patch of patches) {
    if (!Number.isInteger(patch.from) || !Number.isInteger(patch.to) || patch.from < end || patch.to < patch.from || patch.to > length) {
      throw new RangeError(`The patch from ${patch.from} to ${patch.to} does not fit a text of ${length} characters after the position ${end}.`);
    }
    end = patch.to;
  }
}

/**
 * applyPatches returns a text after its patches.
 * @param text - The text before the change.
 * @param patches - The patches, in the order of the text and without overlap.
 */
export function applyPatches(text: string, patches: readonly TextPatch[]): string {
  checkPatches(text.length, patches);
  let result = '';
  let position = 0;
  for (const patch of patches) {
    result += text.slice(position, patch.from) + patch.insert;
    position = patch.to;
  }
  return result + text.slice(position);
}

/**
 * mapPosition returns the place of a position of the text before a change in the text after it. A position in a
 * replaced range moves to the start of the new text, with `assoc` -1, or to its end, with `assoc` 1; the start of a
 * replaced range stays before the new text and its end stays after it.
 * @param position - The position in the text before the change.
 * @param patches - The patches of the change.
 * @param assoc - -1 or 1: the side of the new text that a position in a replaced range or at an insertion takes.
 */
export function mapPosition(position: number, patches: readonly TextPatch[], assoc: -1 | 1 = 1): number {
  let delta = 0;
  for (const patch of patches) {
    if (position < patch.from) {
      break;
    }
    const size = patch.to - patch.from;
    if (position > patch.to) {
      delta += patch.insert.length - size;
      continue;
    }
    const side = size === 0 ? assoc : position === patch.from ? -1 : position === patch.to ? 1 : assoc;
    return patch.from + delta + (side < 0 ? 0 : patch.insert.length);
  }
  return position + delta;
}

/** commonStart returns the length of the common start of two texts. */
function commonStart(a: string, b: string): number {
  const length = Math.min(a.length, b.length);
  let index = 0;
  while (index < length && a.charCodeAt(index) === b.charCodeAt(index)) {
    index++;
  }
  return index;
}

/** commonEnd returns the length of the common end of two texts, at most `limit`. */
function commonEnd(a: string, b: string, limit: number): number {
  let count = 0;
  while (count < limit && a.charCodeAt(a.length - 1 - count) === b.charCodeAt(b.length - 1 - count)) {
    count++;
  }
  return count;
}

/**
 * trimmed returns a patch without the characters at its start and its end that the old and the new text share, or
 * undefined when nothing changes.
 * @param text - The text before the change.
 * @param patch - The patch.
 */
function trimmed(text: string, patch: TextPatch): TextPatch | undefined {
  const old = text.slice(patch.from, patch.to);
  const start = commonStart(old, patch.insert);
  const end = commonEnd(old, patch.insert, Math.min(old.length, patch.insert.length) - start);
  if (start === old.length && start === patch.insert.length) {
    return undefined;
  }
  return { from: patch.from + start, to: patch.to - end, insert: patch.insert.slice(start, patch.insert.length - end) };
}

/**
 * patchesBetween returns the patches that change one text into another: one patch for each run of lines that differ,
 * without the characters at the start and at the end of the run that stay. Two equal texts give no patch.
 * @param before - The text before the change.
 * @param after - The text after the change.
 */
export function patchesBetween(before: string, after: string): TextPatch[] {
  if (before === after) {
    return [];
  }
  // The common start, from the start of its last line, and the common end need no diff; the line diff runs only on the
  // text between them.
  const common = commonStart(before, after);
  const start = common === 0 ? 0 : before.lastIndexOf('\n', common - 1) + 1;
  const end = commonEnd(before, after, Math.min(before.length, after.length) - start);
  const oldPart = before.slice(start, before.length - end);
  const newPart = after.slice(start, after.length - end);
  const whole = trimmed(before, { from: start, to: start + oldPart.length, insert: newPart });
  const parts = oldPart === '' || newPart === '' ? undefined : diffLines(oldPart, newPart, { maxEditLength });
  if (!parts) {
    return whole ? [whole] : [];
  }
  const patches: TextPatch[] = [];
  let position = start;
  let open: { from: number; to: number; insert: string } | undefined;
  const close = () => {
    const patch = open && trimmed(before, open);
    if (patch) {
      patches.push(patch);
    }
    open = undefined;
  };
  for (const part of parts) {
    if (!part.added && !part.removed) {
      close();
      position += part.value.length;
      continue;
    }
    open ??= { from: position, to: position, insert: '' };
    if (part.removed) {
      position += part.value.length;
      open.to = position;
    } else {
      open.insert += part.value;
    }
  }
  close();
  return patches;
}
