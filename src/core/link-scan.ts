// Markdown links whose target is a kadmos:// reference. In a note body a
// reference is a Markdown link with free text, so this finds the links, not
// bare URIs.

import { SCHEME } from './reference.ts';

export interface ReferenceLink {
	/** Offset of the opening bracket. */
	readonly from: number;
	/** Offset after the closing parenthesis. */
	readonly to: number;
	readonly textFrom: number;
	readonly textTo: number;
	readonly uriFrom: number;
	readonly uriTo: number;
	readonly uri: string;
}

// [text](kadmos://...) or [text](<kadmos://...>), with an optional title, matched
// where a bracket opens. Link text holds no unescaped bracket, so the innermost
// link wins, as in CommonMark; a bare target may hold balanced parentheses.
const LINK =
	/\[((?:\\.|[^\\[\]\n])*)\]\(\s*(<kadmos:\/\/[^>\n]*>|kadmos:\/\/(?:[^\s()]|\([^\s()]*\))*)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/uy;
// What ends a reference being typed.
const BOUNDARY = /[\s()<>[\]]/u;

export function findReferenceLinks(text: string): ReferenceLink[] {
	const links: ReferenceLink[] = [];
	for (let from = text.indexOf('['); from !== -1; from = text.indexOf('[', from + 1)) {
		// A bracket after an odd run of backslashes is escaped and opens no link.
		const backslashes = /\\*$/u.exec(text.slice(0, from))?.[0].length ?? 0;
		LINK.lastIndex = from;
		const match = backslashes % 2 === 1 ? null : LINK.exec(text);
		if (match === null) continue;
		const [whole, label = '', target = ''] = match;
		const textFrom = from + 1;
		const targetFrom = from + whole.indexOf(target, label.length + 2);
		const angled = target.startsWith('<');
		const uri = angled ? target.slice(1, -1) : target;
		const uriFrom = angled ? targetFrom + 1 : targetFrom;
		links.push({
			from,
			to: from + whole.length,
			textFrom,
			textTo: textFrom + label.length,
			uriFrom,
			uriTo: uriFrom + uri.length,
			uri,
		});
		from += whole.length - 1;
	}
	return links;
}

/**
 * The reference the cursor sits in while it is typed: where it starts and
 * ends on the line, and the text between `kadmos://` and the cursor.
 */
export function referenceAt(
	line: string,
	cursor: number,
): { readonly start: number; readonly end: number; readonly query: string } | undefined {
	const before = line.slice(0, cursor);
	const start = before.lastIndexOf(SCHEME);
	if (start === -1) return undefined;
	const query = before.slice(start + SCHEME.length);
	if (BOUNDARY.test(query)) return undefined;
	// Completing a path keeps the fragment after it; completing a fragment replaces it.
	const boundary = query.includes('#') ? BOUNDARY : /[\s()<>[\]#]/u;
	const rest = line.slice(cursor).search(boundary);
	return { start, end: rest === -1 ? line.length : cursor + rest, query };
}
