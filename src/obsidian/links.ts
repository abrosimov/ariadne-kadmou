// Following and previewing kadmos:// links, in reading view and in the
// editor alike. Both mark a link with the attribute below; one delegated
// listener handles every marked element.

import { type App, type HoverParent, type HoverPopover, Keymap, Notice } from 'obsidian';
import type { NoteIndex } from './note-index.ts';
import { linktext, present, referenceState } from './references.ts';

export const HOVER_SOURCE = 'ariadne-kadmou';
export const URI_ATTRIBUTE = 'data-kadmos-uri';
export const LINK_CLASS = 'ariadne-kadmou-link';

/** Marks an element as a kadmos:// link and presents its status, replacing an earlier one. */
export function decorate(element: HTMLElement, uri: string, index: NoteIndex): void {
	const { status, description } = present(referenceState(uri, index));
	const previous = element.dataset['kadmosStatus'];
	if (previous !== undefined) element.removeClass(`is-${previous}`);
	element.addClass(LINK_CLASS, `is-${status}`);
	element.setAttr(URI_ATTRIBUTE, uri);
	element.setAttr('aria-label', description);
	element.dataset['kadmosStatus'] = status;
}

/** The attributes `decorate` sets, for editor decorations that cannot take an element. */
export function attributes(uri: string, index: NoteIndex): Record<string, string> {
	const { status, description } = present(referenceState(uri, index));
	return {
		class: `${LINK_CLASS} is-${status}`,
		[URI_ATTRIBUTE]: uri,
		'aria-label': description,
		'data-kadmos-status': status,
	};
}

export class LinkFollower implements HoverParent {
	hoverPopover: HoverPopover | null = null;

	private readonly app: App;
	private readonly index: () => NoteIndex | undefined;

	constructor(app: App, index: () => NoteIndex | undefined) {
		this.app = app;
		this.index = index;
	}

	/** Handles a click on a marked link; returns whether it did. */
	click(event: MouseEvent): boolean {
		const element = marked(event);
		if (element === undefined || !followsOnClick(element, event.target as HTMLElement, event)) return false;
		event.preventDefault();
		event.stopPropagation();
		void this.open(element.getAttribute(URI_ATTRIBUTE) ?? '', Keymap.isModEvent(event));
		return true;
	}

	hover(event: MouseEvent): void {
		const element = marked(event);
		const index = this.index();
		if (element === undefined || index === undefined) return;
		const target = linktext(referenceState(element.getAttribute(URI_ATTRIBUTE) ?? '', index), index);
		if (target === undefined) return;
		this.app.workspace.trigger('hover-link', {
			event,
			source: HOVER_SOURCE,
			hoverParent: this,
			targetEl: element,
			linktext: target,
			sourcePath: this.app.workspace.getActiveFile()?.path ?? '',
		});
	}

	async open(uri: string, newLeaf: ReturnType<typeof Keymap.isModEvent>): Promise<void> {
		const index = this.index();
		if (index === undefined) {
			new Notice('No kadmos vault is open');
			return;
		}
		const state = referenceState(uri, index);
		const target = linktext(state, index);
		if (target === undefined) {
			new Notice(present(state).description);
			return;
		}
		await this.app.workspace.openLinkText(target, this.app.workspace.getActiveFile()?.path ?? '', newLeaf);
	}
}

function marked(event: MouseEvent): HTMLElement | undefined {
	const target = event.target;
	if (!(target instanceof HTMLElement)) return undefined;
	return target.closest<HTMLElement>('[data-kadmos-uri]') ?? undefined;
}

// Reading view follows a link on a click. Live preview does so where the link
// is rendered, as Obsidian does; where it shows the Markdown, and in the
// source editor, only a modified click follows, so a click places the cursor.
function followsOnClick(element: HTMLElement, target: HTMLElement, event: MouseEvent): boolean {
	if (element.closest('.markdown-source-view') === null) return true;
	const rendered = target.closest('.cm-underline') !== null;
	if (rendered && element.closest('.markdown-source-view.is-live-preview') !== null) return true;
	return Keymap.isModEvent(event) !== false;
}
