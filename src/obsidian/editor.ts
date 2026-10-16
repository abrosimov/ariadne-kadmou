// Marks kadmos:// links in the editor, in live preview and in source mode.

import { syntaxTree } from '@codemirror/language';
import { type Extension, RangeSetBuilder, StateEffect } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { findReferenceLinks } from '../core/link-scan.ts';
import { attributes } from './links.ts';
import type { KadmosIndex } from './kadmos-index.ts';

// Asks an editor to mark its links again. A transaction carrying only this
// effect leaves the document, the selection and an open suggestion alone,
// which reconfiguring every editor would not.
const remark = StateEffect.define();

export class EditorLinks {
	readonly extension: Extension;
	private readonly views = new Set<EditorView>();

	constructor(index: () => KadmosIndex | undefined) {
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

function build(view: EditorView, index: KadmosIndex | undefined): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	if (index === undefined) return builder.finish();
	const { doc } = view.state;
	const tree = syntaxTree(view.state);
	// Visible ranges may split one line; each line is marked once, in order.
	let next = 1;
	for (const { from, to } of view.visibleRanges) {
		for (let number = Math.max(next, doc.lineAt(from).number); number <= doc.lineAt(to).number; number++) {
			const line = doc.line(number);
			for (const link of findReferenceLinks(line.text)) {
				if (inCode(tree.resolveInner(line.from + link.from + 1, 1).name)) continue;
				const mark = Decoration.mark({ attributes: attributes(link.uri, index) });
				builder.add(line.from + link.textFrom, line.from + link.textTo, mark);
				builder.add(line.from + link.uriFrom, line.from + link.uriTo, mark);
			}
			next = number + 1;
		}
	}
	return builder.finish();
}

function inCode(nodeName: string): boolean {
	return /(?:^|[_-])(?:inline-code|codeblock|code)(?:$|[_-])/u.test(nodeName);
}
