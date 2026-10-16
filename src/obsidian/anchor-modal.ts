// The code anchors that name a note, and what is wrong with its `anchored_by` list.

import { type App, SuggestModal } from 'obsidian';
import { type AnchorSite, anchorsNaming, pairingProblems } from '../core/anchor-index.ts';
import type { CodeAnchors } from './code-anchors.ts';

type Item = { readonly site: AnchorSite } | { readonly problem: string };

export class AnchorModal extends SuggestModal<Item> {
	private readonly items: readonly Item[];
	private readonly openCode: (site: AnchorSite) => void;

	constructor(
		app: App,
		anchors: CodeAnchors,
		note: { readonly path: string; readonly listed: readonly string[] | undefined },
		openCode: (site: AnchorSite) => void,
	) {
		super(app);
		this.openCode = openCode;
		const problems = note.listed === undefined ? [] : pairingProblems(anchors.index, note.path, note.listed);
		this.items = [
			...problems.map((problem) => ({ problem })),
			...anchorsNaming(anchors.index, note.path).map((site) => ({ site })),
		];
		this.emptyStateText = 'No code anchor names this note';
		this.setPlaceholder('Code anchors naming this note');
	}

	override getSuggestions(query: string): Item[] {
		const needle = query.toLowerCase();
		return this.items.filter((item) => label(item).toLowerCase().includes(needle));
	}

	override renderSuggestion(item: Item, element: HTMLElement): void {
		element.setText(label(item));
		if ('problem' in item) element.addClass('mod-warning');
	}

	override onChooseSuggestion(item: Item): void {
		if ('site' in item) this.openCode(item.site);
	}
}

function label(item: Item): string {
	if ('problem' in item) return item.problem;
	const { file, line, declaration } = item.site;
	return `${declaration.slug} · ${declaration.relation} · ${file}:${line}`;
}
