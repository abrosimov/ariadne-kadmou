// Completion of a kadmos:// reference as it is typed: the authority, then an
// active note path and a heading of it, or a code anchor slug.

import { decode, formatReference, OIKOS, SCHEME } from './reference.ts';

export interface CompletionSource {
	/** Active note paths of the authority's vault, vault-relative. */
	notes: (authority: string) => readonly string[];
	headings: (authority: string, path: string) => readonly string[];
	/** Code anchor slugs of the authority's repository. */
	anchors: (authority: string) => readonly string[];
	/** Authorities that may be referenced: oikos and the direct dependencies. */
	readonly authorities: readonly string[];
}

export interface Completion {
	/** What the list shows. */
	readonly label: string;
	/** The full reference that replaces the typed one. */
	readonly reference: string;
}

const LIMIT = 50;

export function complete(query: string, source: CompletionSource): Completion[] {
	const slash = query.indexOf('/');
	if (slash === -1) {
		return source.authorities
			.filter((authority) => authority.startsWith(query))
			.map((authority) => ({ label: authority, reference: `${SCHEME}${authority}/` }));
	}
	const authority = query.slice(0, slash);
	if (!source.authorities.includes(authority)) return [];
	const rest = query.slice(slash + 1);
	const hash = rest.indexOf('#');
	if (hash === -1) {
		return matching(source.notes(authority), rest, (path) => formatReference({ kind: 'note', authority, path }));
	}
	const path = decode(rest.slice(0, hash));
	const typed = rest.slice(hash + 1);
	if (path === undefined) return [];
	if (path === '') {
		return matching(source.anchors(authority), typed, (slug) =>
			formatReference({ kind: 'anchor', authority, slug }),
		);
	}
	return matching(source.headings(authority, path), typed, (fragment) =>
		formatReference({ kind: 'note', authority, path, fragment }),
	);
}

// What contains the typed text, best matches first, each with the reference it completes to.
function matching(items: readonly string[], typed: string, reference: (item: string) => string): Completion[] {
	const needle = (decode(typed) ?? typed).toLowerCase();
	return items
		.filter((item) => item.toLowerCase().includes(needle))
		.sort((a, b) => {
			const byRank = rank(a, needle) - rank(b, needle);
			return byRank === 0 ? a.localeCompare(b) : byRank;
		})
		.slice(0, LIMIT)
		.map((item) => ({ label: item, reference: reference(item) }));
}

export const DEFAULT_AUTHORITIES: readonly string[] = [OIKOS];

// Items whose last path segment starts with the needle come first, then those containing it.
function rank(path: string, needle: string): number {
	const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
	if (name.startsWith(needle)) return 0;
	if (name.includes(needle)) return 1;
	return 2;
}
