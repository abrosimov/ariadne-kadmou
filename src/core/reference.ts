// The kadmos:// grammar of kadmos `standards/cross-instance-references.md`.
//
//   kadmos://<authority>/<path>[#<fragment>]   a note, or a heading of it
//   kadmos://<authority>/#<slug>               a code anchor

import type { VaultContract } from './contract.ts';

export const SCHEME = 'kadmos://';
export const OIKOS = 'oikos';

export interface NoteReference {
	readonly kind: 'note';
	readonly authority: string;
	/** Active path relative to the vault root, decoded, with `.md`. */
	readonly path: string;
	/** Heading, decoded, when the reference names one. */
	readonly fragment?: string;
}

export interface AnchorReference {
	readonly kind: 'anchor';
	readonly authority: string;
	readonly slug: string;
}

export type KadmosReference = NoteReference | AnchorReference;

export type ParseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

type GrammarContract = Pick<VaultContract, 'retentionRoots'> & {
	readonly codeAnchors?: { readonly slugPattern: RegExp };
};

// A fragment shaped like an editor line address. Headings are the only
// fragments; line numbers are not addresses.
const LINE_ADDRESS = /^L\d+(?:-L?\d+)?$/u;

export function parseReference(uri: string, contract: GrammarContract): ParseResult<KadmosReference> {
	if (!uri.startsWith(SCHEME)) return fail(`not a ${SCHEME} reference`);
	const rest = uri.slice(SCHEME.length);
	if (/[\s?]/u.test(rest)) return fail('a reference contains no whitespace and no query');

	const slash = rest.indexOf('/');
	if (slash < 0) return fail('the authority is followed by "/"');
	const authority = rest.slice(0, slash);
	if (authority === '') return fail('the authority is required');
	if (authority.includes('#')) return fail('the authority is followed by "/"');

	const afterAuthority = rest.slice(slash + 1);
	const hash = afterAuthority.indexOf('#');
	const rawPath = hash < 0 ? afterAuthority : afterAuthority.slice(0, hash);
	const rawFragment = hash < 0 ? undefined : afterAuthority.slice(hash + 1);

	if (rawPath === '') {
		if (rawFragment === undefined) return fail('a reference names a note path or an anchor slug');
		if (!contract.codeAnchors) return fail('the vault schema declares no config.code_anchors');
		if (!contract.codeAnchors.slugPattern.test(rawFragment)) {
			return fail(`"${rawFragment}" does not match the declared slug pattern`);
		}
		return { ok: true, value: { kind: 'anchor', authority, slug: rawFragment } };
	}

	const path = decode(rawPath);
	if (path === undefined) return fail('the path is not validly percent-encoded');
	const segments = path.split('/');
	if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
		return fail('the path is relative to the vault root, without empty, "." or ".." segments');
	}
	if (!path.endsWith('.md')) return fail('a note path carries the .md extension');
	const first = segments[0] ?? '';
	if (contract.retentionRoots.includes(first)) {
		return fail(`"${first}/" is a retention root; a reference names the active path`);
	}

	if (rawFragment === undefined) return { ok: true, value: { kind: 'note', authority, path } };
	const fragment = decode(rawFragment);
	if (fragment === undefined || fragment === '') return fail('the heading is empty or not validly percent-encoded');
	if (fragment.includes('#')) return fail('a reference carries one fragment');
	if (LINE_ADDRESS.test(fragment)) return fail('line numbers are not addresses');
	return { ok: true, value: { kind: 'note', authority, path, fragment } };
}

export function formatReference(reference: KadmosReference): string {
	if (reference.kind === 'anchor') return `${SCHEME}${reference.authority}/#${reference.slug}`;
	const path = reference.path.split('/').map(encodeURIComponent).join('/');
	const fragment = reference.fragment === undefined ? '' : `#${encodeURIComponent(reference.fragment)}`;
	return `${SCHEME}${reference.authority}/${path}${fragment}`;
}

function decode(text: string): string | undefined {
	try {
		return decodeURIComponent(text);
	} catch {
		return undefined;
	}
}

function fail(reason: string): ParseResult<never> {
	return { ok: false, reason };
}
