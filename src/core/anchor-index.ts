// The code anchors of a repository, gathered from its files, and what a
// note's `anchored_by` field should say about them.

import { type AnchorDeclaration, parseAnchorLine } from './anchor.ts';
import type { CodeAnchorContract, VaultContract } from './contract.ts';
import { OIKOS } from './reference.ts';

export interface AnchorSite {
	/** Repository-relative path, with `/` separators. */
	readonly file: string;
	/** One-based line number. */
	readonly line: number;
	readonly declaration: AnchorDeclaration;
}

export interface AnchorProblem {
	readonly file: string;
	readonly line: number;
	readonly reason: string;
}

export interface AnchorIndex {
	readonly sites: ReadonlyMap<string, readonly AnchorSite[]>;
	/** Lines that carry the marker but are not declarations. */
	readonly problems: readonly AnchorProblem[];
}

export function indexAnchors(
	files: Iterable<{ readonly path: string; readonly text: string }>,
	contract: VaultContract & { readonly codeAnchors: CodeAnchorContract },
): AnchorIndex {
	const sites = new Map<string, AnchorSite[]>();
	const problems: AnchorProblem[] = [];
	for (const { path, text } of files) {
		if (!text.includes(contract.codeAnchors.marker)) continue;
		for (const [number, line] of text.split('\n').entries()) {
			const parsed = parseAnchorLine(line, contract);
			if (parsed === undefined) continue;
			if (!parsed.ok) {
				problems.push({ file: path, line: number + 1, reason: parsed.reason });
				continue;
			}
			const site = { file: path, line: number + 1, declaration: parsed.value };
			const same = sites.get(parsed.value.slug);
			if (same === undefined) sites.set(parsed.value.slug, [site]);
			else same.push(site);
		}
	}
	return { sites, problems };
}

/** Anchors of this repository whose reference names the note at `path`, by slug. */
export function anchorsNaming(index: AnchorIndex, path: string): AnchorSite[] {
	return [...index.sites.values()]
		.flat()
		.filter(({ declaration: { target } }) => target.authority === OIKOS && target.path === path)
		.toSorted((a, b) => a.declaration.slug.localeCompare(b.declaration.slug));
}

/**
 * What is wrong with a note's `anchored_by` list, which is exact when present:
 * every listed slug exists and names the note, every anchor naming it is listed.
 */
export function pairingProblems(index: AnchorIndex, path: string, listed: readonly string[]): string[] {
	const naming = new Set(anchorsNaming(index, path).map((site) => site.declaration.slug));
	const problems = listed.flatMap((slug) => {
		if (!index.sites.has(slug)) return [`"${slug}" is listed but declared nowhere`];
		return naming.has(slug) ? [] : [`"${slug}" is listed but does not name this note`];
	});
	for (const slug of naming) if (!listed.includes(slug)) problems.push(`"${slug}" names this note but is not listed`);
	return problems;
}

/**
 * The address a code location opens at: `{url}` is the file URL, `{path}` the
 * absolute path with `/` separators, escaped for a URL path, `{line}` the line.
 */
export function codeLink(template: string, absolutePath: string, fileUrl: string, line: number): string {
	const path = encodeURI(absolutePath.replaceAll('\\', '/')).replaceAll('#', '%23').replaceAll('?', '%3F');
	return template.replaceAll('{url}', fileUrl).replaceAll('{path}', path).replaceAll('{line}', String(line));
}
