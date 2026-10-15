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
import { referencePrefixAt } from '../core/link-scan.ts';
import { OIKOS } from '../core/reference.ts';
import type { NoteIndex } from './note-index.ts';

export class ReferenceSuggest extends EditorSuggest<Completion> {
	private readonly index: () => NoteIndex | undefined;

	constructor(app: App, index: () => NoteIndex | undefined) {
		super(app);
		this.index = index;
	}

	override onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
		if (this.index() === undefined) return null;
		const prefix = referencePrefixAt(editor.getLine(cursor.line), cursor.ch);
		if (prefix === undefined) return null;
		return { start: { line: cursor.line, ch: prefix.start }, end: cursor, query: prefix.query };
	}

	override getSuggestions(context: EditorSuggestContext): Completion[] {
		const index = this.index();
		if (index === undefined) return [];
		return complete(context.query, {
			authorities: DEFAULT_AUTHORITIES,
			notes: (authority) => (authority === OIKOS ? index.activeNotes() : []),
			headings: (authority, path) => (authority === OIKOS ? index.headings(path) : []),
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
