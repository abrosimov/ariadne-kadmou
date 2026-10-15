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

// [text](kadmos://...) or [text](<kadmos://...>), with an optional title.
const LINK =
	/\[((?:\\.|[^\\\]\n])*)\]\(\s*(<kadmos:\/\/[^>\n]*>|kadmos:\/\/[^\s)]*)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)/gu;

export function findReferenceLinks(text: string): ReferenceLink[] {
	const links: ReferenceLink[] = [];
	for (const match of text.matchAll(LINK)) {
		const [whole, label = '', target = ''] = match;
		const from = match.index;
		// An escaped bracket does not open a link.
		if (from > 0 && text.charAt(from - 1) === '\\') continue;
		const textFrom = from + 1;
		const textTo = textFrom + label.length;
		const targetFrom = from + whole.indexOf(target, label.length + 2);
		const angled = target.startsWith('<');
		const uri = angled ? target.slice(1, -1) : target;
		const uriFrom = angled ? targetFrom + 1 : targetFrom;
		links.push({ from, to: from + whole.length, textFrom, textTo, uriFrom, uriTo: uriFrom + uri.length, uri });
	}
	return links;
}

/** The text after `kadmos://` when the cursor sits inside a reference being typed, else undefined. */
export function referencePrefixAt(
	line: string,
	cursor: number,
): { readonly start: number; readonly query: string } | undefined {
	const before = line.slice(0, cursor);
	const start = before.lastIndexOf(SCHEME);
	if (start === -1) return undefined;
	const query = before.slice(start + SCHEME.length);
	if (/[\s()<>[\]]/u.test(query)) return undefined;
	return { start, query };
}
