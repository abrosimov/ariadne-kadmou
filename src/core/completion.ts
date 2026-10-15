// Completion of a kadmos:// reference as it is typed: the authority, then an
// active note path, then a heading of that note.

import { OIKOS, SCHEME } from './reference.ts';

export interface CompletionSource {
	/** Active note paths of the authority's vault, vault-relative. */
	notes: (authority: string) => readonly string[];
	headings: (authority: string, path: string) => readonly string[];
	/** Authorities that may be referenced: oikos and the direct dependencies. */
	readonly authorities: readonly string[];
}

export interface Completion {
	/** What the list shows. */
	readonly label: string;
	/** The full reference that replaces the typed one. */
	readonly reference: string;
	/** Whether the reference is complete, or awaits more typing. */
	readonly complete: boolean;
}

const LIMIT = 50;

export function complete(query: string, source: CompletionSource): Completion[] {
	const slash = query.indexOf('/');
	if (slash === -1) {
		return source.authorities
			.filter((authority) => authority.startsWith(query))
			.map((authority) => ({ label: authority, reference: `${SCHEME}${authority}/`, complete: false }));
	}
	const authority = query.slice(0, slash);
	if (!source.authorities.includes(authority)) return [];
	const rest = query.slice(slash + 1);
	const hash = rest.indexOf('#');

	if (hash === -1) {
		const needle = safeDecode(rest).toLowerCase();
		return source
			.notes(authority)
			.filter((path) => path.toLowerCase().includes(needle))
			.toSorted((a, b) => {
				const byRank = rank(a, needle) - rank(b, needle);
				return byRank === 0 ? a.localeCompare(b) : byRank;
			})
			.slice(0, LIMIT)
			.map((path) => ({ label: path, reference: `${SCHEME}${authority}/${encodePath(path)}`, complete: true }));
	}

	const path = safeDecode(rest.slice(0, hash));
	const needle = safeDecode(rest.slice(hash + 1)).toLowerCase();
	return source
		.headings(authority, path)
		.filter((heading) => heading.toLowerCase().includes(needle))
		.slice(0, LIMIT)
		.map((heading) => ({
			label: heading,
			reference: `${SCHEME}${authority}/${encodePath(path)}#${encodeURIComponent(heading)}`,
			complete: true,
		}));
}

export const DEFAULT_AUTHORITIES: readonly string[] = [OIKOS];

// Paths whose basename starts with the needle come first, then those containing it.
function rank(path: string, needle: string): number {
	const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
	if (name.startsWith(needle)) return 0;
	if (name.includes(needle)) return 1;
	return 2;
}

function encodePath(path: string): string {
	return path
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

function safeDecode(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		return text;
	}
}
