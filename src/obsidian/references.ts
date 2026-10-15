// What a kadmos:// reference resolves to in the opened kadmos vault, how a
// link to it is presented, and where following it leads.

import type { AnchorSite } from '../core/anchor-index.ts';
import { type AnchorReference, type NoteReference, OIKOS, parseReference } from '../core/reference.ts';
import { type Resolution, resolveNote } from '../core/resolve.ts';
import type { KadmosIndex } from './kadmos-index.ts';

export type ReferenceState =
	| { readonly kind: 'invalid'; readonly reason: string }
	/** `sites` is undefined when the repository was not scanned for anchors. */
	| {
			readonly kind: 'anchor';
			readonly reference: AnchorReference;
			readonly sites: readonly AnchorSite[] | undefined;
	  }
	| { readonly kind: 'note'; readonly reference: NoteReference; readonly resolution: Resolution };

export type Target =
	{ readonly kind: 'note'; readonly linktext: string } | { readonly kind: 'code'; readonly site: AnchorSite };

export interface Presentation {
	/** One of: resolved, stale, renamed, missing, foreign, invalid, unchecked. */
	readonly status: string;
	readonly description: string;
}

/** The kadmos vault currently declares no dependencies: only oikos is referenced. */
const NO_DEPENDENCIES: ReadonlySet<string> = new Set();

export function referenceState(uri: string, index: KadmosIndex): ReferenceState {
	const parsed = parseReference(uri, index.contract);
	if (!parsed.ok) return { kind: 'invalid', reason: parsed.reason };
	const reference = parsed.value;
	if (reference.kind === 'anchor') {
		const anchors = index.anchors?.index;
		return {
			kind: 'anchor',
			reference,
			sites: anchors === undefined ? undefined : (anchors.sites.get(reference.slug) ?? []),
		};
	}
	const resolution = resolveNote(reference, {
		contract: index.contract,
		directDependencies: NO_DEPENDENCIES,
		vault: (authority) => (authority === OIKOS ? index.vault() : undefined),
	});
	return { kind: 'note', reference, resolution };
}

export function present(state: ReferenceState): Presentation {
	switch (state.kind) {
		case 'invalid': {
			return shown('invalid', `Invalid reference: ${state.reason}`);
		}
		case 'anchor': {
			return presentAnchor(state.reference, state.sites);
		}
		case 'note': {
			return presentNote(state.reference, state.resolution);
		}
	}
}

/** Where following the reference leads, or undefined when it leads nowhere. */
export function target(state: ReferenceState, index: KadmosIndex): Target | undefined {
	if (state.kind === 'anchor') {
		const [site, ...others] = state.sites ?? [];
		const usable = state.reference.authority === OIKOS && site !== undefined && others.length === 0;
		return usable ? { kind: 'code', site } : undefined;
	}
	if (state.kind !== 'note') return undefined;
	const { resolution, reference } = state;
	if (resolution.file === undefined || resolution.outcome === 'missing') return undefined;
	const path = index.obsidianPath(resolution.file);
	// A renamed note opens without the heading, which belonged to the address, not to the note found.
	const heading =
		resolution.outcome === 'renamed' || reference.fragment === undefined ? '' : `#${reference.fragment}`;
	return { kind: 'note', linktext: path + heading };
}

function presentAnchor(reference: AnchorReference, sites: readonly AnchorSite[] | undefined): Presentation {
	if (reference.authority !== OIKOS) return foreign(reference.authority);
	if (sites === undefined) return shown('unchecked', 'Code anchors are not scanned: the schema declares none');
	const [site] = sites;
	if (site === undefined) return shown('missing', `Missing: no anchor "${reference.slug}" in this repository`);
	if (sites.length > 1) {
		const places = sites.map(({ file, line }) => `${file}:${line}`).join(', ');
		return shown('invalid', `"${reference.slug}" is declared ${sites.length} times: ${places}`);
	}
	return shown('resolved', `${site.file}:${site.line} ${site.declaration.relation} ${site.declaration.reference}`);
}

function presentNote(reference: NoteReference, { outcome, file = '' }: Resolution): Presentation {
	const address = reference.fragment === undefined ? reference.path : `${reference.path}#${reference.fragment}`;
	switch (outcome) {
		case 'resolved': {
			return shown('resolved', address);
		}
		case 'stale': {
			return shown('stale', `Stale: ${address} lies at ${file}; its frontmatter names what replaced it`);
		}
		case 'renamed': {
			return shown('renamed', `Renamed: nothing at ${reference.path}; a note of that name lies at ${file}`);
		}
		case 'missing': {
			const reason =
				file === '' ? `no note at ${reference.path}` : `${file} has no heading "${reference.fragment ?? ''}"`;
			return shown('missing', `Missing: ${reason}`);
		}
		case 'not-a-direct-dependency': {
			return foreign(reference.authority);
		}
	}
}

function foreign(authority: string): Presentation {
	return shown('foreign', `"${authority}" is neither oikos nor a direct dependency of this vault`);
}

function shown(status: string, description: string): Presentation {
	return { status, description };
}
