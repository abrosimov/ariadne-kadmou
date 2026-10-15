// Following and previewing kadmos:// links, in reading view and in the
// editor alike. Both mark a link with the attributes below; one delegated
// listener handles every marked element.

import { type App, type HoverParent, type HoverPopover, Keymap, Notice } from 'obsidian';
import type { AnchorSite } from '../core/anchor-index.ts';
import type { KadmosIndex } from './kadmos-index.ts';
import { present, referenceState, target } from './references.ts';

export const HOVER_SOURCE = 'ariadne-kadmou';
const URI_ATTRIBUTE = 'data-kadmos-uri';
const STATUS_ATTRIBUTE = 'data-kadmos-status';

/** The attributes that mark a kadmos:// link and present its status. */
export function attributes(uri: string, index: KadmosIndex): Record<string, string> {
	const { status, description } = present(referenceState(uri, index));
	return {
		class: `ariadne-kadmou-link is-${status}`,
		[URI_ATTRIBUTE]: uri,
		[STATUS_ATTRIBUTE]: status,
		'aria-label': description,
	};
}

/** Marks a rendered link, replacing an earlier mark. */
export function decorate(element: HTMLElement, uri: string, index: KadmosIndex): void {
	const previous = element.getAttribute(STATUS_ATTRIBUTE);
	if (previous !== null) element.removeClass(`is-${previous}`);
	const { class: classes = '', ...rest } = attributes(uri, index);
	element.addClasses(classes.split(' '));
	for (const [name, value] of Object.entries(rest)) element.setAttr(name, value);
}

export class LinkFollower implements HoverParent {
	hoverPopover: HoverPopover | null = null;

	private readonly app: App;
	private readonly index: () => KadmosIndex | undefined;
	private readonly openCode: (site: AnchorSite) => void;

	constructor(app: App, index: () => KadmosIndex | undefined, openCode: (site: AnchorSite) => void) {
		this.app = app;
		this.index = index;
		this.openCode = openCode;
	}

	/** Follows a click on a marked link; returns whether it did. */
	click(event: MouseEvent): boolean {
		const element = marked(event);
		if (element === undefined || !followsOnClick(element, event)) return false;
		event.preventDefault();
		event.stopPropagation();
		void this.open(element.getAttribute(URI_ATTRIBUTE) ?? '', Keymap.isModEvent(event));
		return true;
	}

	hover(event: MouseEvent): void {
		const element = marked(event);
		const index = this.index();
		if (element === undefined || index === undefined) return;
		const destination = target(referenceState(element.getAttribute(URI_ATTRIBUTE) ?? '', index), index);
		if (destination?.kind !== 'note') return;
		this.app.workspace.trigger('hover-link', {
			event,
			source: HOVER_SOURCE,
			hoverParent: this,
			targetEl: element,
			linktext: destination.linktext,
			sourcePath: this.sourcePath(),
		});
	}

	async open(uri: string, newLeaf: ReturnType<typeof Keymap.isModEvent>): Promise<void> {
		const index = this.index();
		if (index === undefined) {
			new Notice('No kadmos vault is open');
			return;
		}
		const state = referenceState(uri, index);
		const destination = target(state, index);
		if (destination === undefined) new Notice(present(state).description);
		else if (destination.kind === 'code') this.openCode(destination.site);
		else await this.app.workspace.openLinkText(destination.linktext, this.sourcePath(), newLeaf);
	}

	private sourcePath(): string {
		return this.app.workspace.getActiveFile()?.path ?? '';
	}
}

function marked(event: MouseEvent): HTMLElement | undefined {
	return event.target instanceof HTMLElement
		? (event.target.closest<HTMLElement>('[data-kadmos-uri]') ?? undefined)
		: undefined;
}

// Reading view follows a link on a click. Live preview does so where the link
// is rendered, as Obsidian does; where it shows the Markdown, and in the
// source editor, only a modified click follows, so a click places the cursor.
function followsOnClick(element: HTMLElement, event: MouseEvent): boolean {
	if (element.closest('.markdown-source-view') === null) return true;
	const rendered = event.target instanceof HTMLElement && event.target.closest('.cm-underline') !== null;
	if (rendered && element.closest('.markdown-source-view.is-live-preview') !== null) return true;
	return Keymap.isModEvent(event) !== false;
}
