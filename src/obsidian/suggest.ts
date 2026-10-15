// Completion of a kadmos:// reference while it is typed.

import {
	type App,
	type Editor,
	type EditorPosition,
	EditorSuggest,
	type EditorSuggestContext,
	type EditorSuggestTriggerInfo,
} from 'obsidian';
import { type Completion, complete, DEFAULT_AUTHORITIES } from '../core/completion.ts';
import { referenceAt } from '../core/link-scan.ts';
import { OIKOS, parseReference } from '../core/reference.ts';
import type { KadmosIndex } from './kadmos-index.ts';

export class ReferenceSuggest extends EditorSuggest<Completion> {
	private readonly index: () => KadmosIndex | undefined;

	constructor(app: App, index: () => KadmosIndex | undefined) {
		super(app);
		this.index = index;
	}

	override onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
		if (this.index() === undefined) return null;
		const reference = referenceAt(editor.getLine(cursor.line), cursor.ch);
		if (reference === undefined) return null;
		const { start, end, query } = reference;
		return { start: { line: cursor.line, ch: start }, end: { line: cursor.line, ch: end }, query };
	}

	override getSuggestions(context: EditorSuggestContext): Completion[] {
		const index = this.index();
		if (index === undefined) return [];
		return complete(context.query, {
			authorities: DEFAULT_AUTHORITIES,
			notes: (authority) => (authority === OIKOS ? index.activeNotes() : []),
			headings: (authority, path) => (authority === OIKOS ? index.headings(path) : []),
			anchors: (authority) => (authority === OIKOS ? [...(index.anchors?.index.sites.keys() ?? [])] : []),
			accepts: (reference) => reference.endsWith('/') || parseReference(reference, index.contract).ok,
		});
	}

	override renderSuggestion(completion: Completion, element: HTMLElement): void {
		element.setText(completion.label);
	}

	override selectSuggestion(completion: Completion): void {
		const context = this.context;
		if (context === null) return;
		context.editor.replaceRange(completion.reference, context.start, context.end);
	}
}
