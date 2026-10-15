// Marks kadmos:// links in the editor, in live preview and in source mode.

import { syntaxTree } from '@codemirror/language';
import { type Extension, RangeSetBuilder, StateEffect } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { findReferenceLinks } from '../core/link-scan.ts';
import { attributes } from './links.ts';
import type { NoteIndex } from './note-index.ts';

// Asks an editor to mark its links again. A transaction carrying only this
// effect leaves the document, the selection and an open suggestion alone,
// which reconfiguring every editor would not.
const remark = StateEffect.define();

export class EditorLinks {
	readonly extension: Extension;
	private readonly views = new Set<EditorView>();

	constructor(index: () => NoteIndex | undefined) {
		const views = this.views;
		this.extension = ViewPlugin.fromClass(
			class {
				decorations: DecorationSet;
				private readonly view: EditorView;

				constructor(view: EditorView) {
					this.view = view;
					views.add(view);
					this.decorations = build(view, index());
				}

				update(update: ViewUpdate): void {
					const asked = update.transactions.some((transaction) =>
						transaction.effects.some((effect) => effect.is(remark)),
					);
					if (asked || update.docChanged || update.viewportChanged) {
						this.decorations = build(update.view, index());
					}
				}

				destroy(): void {
					views.delete(this.view);
				}
			},
			{ decorations: (plugin) => plugin.decorations },
		);
	}

	/** Marks the links of every open editor again. */
	refresh(): void {
		for (const view of this.views) view.dispatch({ effects: remark.of(null) });
	}
}

function build(view: EditorView, index: NoteIndex | undefined): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	if (index === undefined) return builder.finish();
	const tree = syntaxTree(view.state);
	for (const { from, to } of view.visibleRanges) {
		let line = view.state.doc.lineAt(from);
		for (;;) {
			for (const link of findReferenceLinks(line.text)) {
				const start = line.from + link.from;
				if (inCode(tree.resolveInner(start + 1, 1).name)) continue;
				const mark = Decoration.mark({ attributes: attributes(link.uri, index) });
				builder.add(line.from + link.textFrom, line.from + link.textTo, mark);
				builder.add(line.from + link.uriFrom, line.from + link.uriTo, mark);
			}
			if (line.to >= to || line.number >= view.state.doc.lines) break;
			line = view.state.doc.line(line.number + 1);
		}
	}
	return builder.finish();
}

function inCode(nodeName: string): boolean {
	return /(?:^|[_-])(?:inline-code|codeblock|code)(?:$|[_-])/u.test(nodeName);
}
