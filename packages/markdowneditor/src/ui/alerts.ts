// SPDX-License-Identifier: MIT
// © 2026 Hannes Stauss (scalarion@nimblescape.com)
// Licensed under the MIT License. See LICENSE in the repository root for details.

// The GitHub alerts in the rendered text (docs/editor.md, R-EDIT-003): a block quote whose first paragraph starts with
// `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` shows as an alert of its kind, with the name of
// the kind in place of the marker. The marker stays text of the document: when the cursor is in the first paragraph
// of the alert, the editor shows it as the file writes it, so that the user can change it.

import type { Node } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { alertKinds, type AlertKind } from './items';

/** Alert is a GitHub alert of the document: the position of its block quote and the range of its marker. */
export interface Alert {
  kind: AlertKind;
  /** pos is the position of the block quote. */
  pos: number;
  /** size is the size of the block quote. */
  size: number;
  /** from and to are the range of the marker, `[!NOTE]`, with the spaces and the line break after it. */
  from: number;
  to: number;
}

/** marker matches the marker of an alert at the start of the text of a paragraph, with the spaces after it. */
const marker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:[ \n]+|$)/i;

/**
 * alertsOf returns the GitHub alerts of a document.
 * @param doc - The document.
 */
export function alertsOf(doc: Node): Alert[] {
  const alerts: Alert[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'blockquote') {
      return !node.isTextblock;
    }
    const first = node.firstChild;
    const text = first?.type.name === 'paragraph' ? first.firstChild : null;
    const found = text?.isText && text.marks.length === 0 ? marker.exec(text.text ?? '') : null;
    if (found) {
      // The text of the paragraph starts after the open tags of the block quote and of the paragraph.
      alerts.push({ kind: found[1].toLowerCase() as AlertKind, pos, size: node.nodeSize, from: pos + 2, to: pos + 2 + found[0].length });
    }
    return true;
  });
  return alerts;
}

/** alertsKey is the key of the plugin of the alerts. */
export const alertsKey = new PluginKey<Alert[]>('nsmdAlerts');

/** decorationsOf returns the classes of the alerts, and the names of the kinds where the cursor is not at a marker. */
function decorationsOf(state: EditorState, alerts: readonly Alert[]): DecorationSet {
  const { $head } = state.selection;
  const decorations: Decoration[] = [];
  for (const alert of alerts) {
    decorations.push(Decoration.node(alert.pos, alert.pos + alert.size, { class: `nsmd-alert nsmd-alert-${alert.kind}` }));
    // The cursor is in the first paragraph of the alert when the paragraph starts at the start of the marker.
    const atMarker = $head.parent.type.name === 'paragraph' && $head.start() === alert.from;
    decorations.push(
      Decoration.inline(alert.from, alert.to, {
        class: atMarker ? 'nsmd-alert-marker nsmd-alert-marker-raw' : 'nsmd-alert-marker',
        'data-label': alertKinds[alert.kind],
      }),
    );
  }
  return DecorationSet.create(state.doc, decorations);
}

/** alertsPlugin returns the plugin of the GitHub alerts. */
export function alertsPlugin(): Plugin<Alert[]> {
  return new Plugin<Alert[]>({
    key: alertsKey,
    state: {
      init: (_config, state) => alertsOf(state.doc),
      apply: (tr, value) => (tr.docChanged ? alertsOf(tr.doc) : value),
    },
    props: {
      decorations(state) {
        const alerts = alertsKey.getState(state) ?? [];
        return alerts.length > 0 ? decorationsOf(state, alerts) : undefined;
      },
    },
  });
}
