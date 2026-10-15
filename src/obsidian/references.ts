// What a kadmos:// reference resolves to in the opened kadmos vault, how a
// link to it is presented, and where following it leads.

import { parseReference, type AnchorReference, type NoteReference, OIKOS } from '../core/reference.ts';
import { resolveNote, type Resolution } from '../core/resolve.ts';
import type { NoteIndex } from './note-index.ts';

export type ReferenceState =
	| { readonly kind: 'invalid'; readonly reason: string }
	| { readonly kind: 'anchor'; readonly reference: AnchorReference }
	| { readonly kind: 'note'; readonly reference: NoteReference; readonly resolution: Resolution };

export interface Presentation {
	/** One of: resolved, stale, renamed, missing, foreign, invalid, unchecked. */
	readonly status: string;
	readonly description: string;
}

/** The kadmos vault currently declares no dependencies: only oikos is referenced. */
const NO_DEPENDENCIES: ReadonlySet<string> = new Set();

export function referenceState(uri: string, index: NoteIndex): ReferenceState {
	const parsed = parseReference(uri, index.contract);
	if (!parsed.ok) return { kind: 'invalid', reason: parsed.reason };
	const reference = parsed.value;
	if (reference.kind === 'anchor') return { kind: 'anchor', reference };
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
			return { status: 'invalid', description: `Invalid reference: ${state.reason}` };
		}
		case 'anchor': {
			return { status: 'unchecked', description: 'Code anchors are not resolved yet' };
		}
		case 'note': {
			return presentNote(state.reference, state.resolution);
		}
	}
}

function presentNote(reference: NoteReference, resolution: Resolution): Presentation {
	const target = reference.fragment === undefined ? reference.path : `${reference.path}#${reference.fragment}`;
	switch (resolution.outcome) {
		case 'resolved': {
			return { status: 'resolved', description: target };
		}
		case 'stale': {
			return {
				status: 'stale',
				description: `Stale: ${target} lies at ${resolution.file ?? ''}; its frontmatter names what replaced it`,
			};
		}
		case 'renamed': {
			return {
				status: 'renamed',
				description: `Renamed: nothing at ${reference.path}; a note of that name lies at ${resolution.file ?? ''}`,
			};
		}
		case 'missing': {
			return {
				status: 'missing',
				description:
					resolution.file === undefined
						? `Missing: no note at ${reference.path}`
						: `Missing: ${resolution.file} has no heading "${reference.fragment ?? ''}"`,
			};
		}
		case 'not-a-direct-dependency': {
			return {
				status: 'foreign',
				description: `"${reference.authority}" is neither oikos nor a direct dependency of this vault`,
			};
		}
	}
}

/**
 * The Obsidian link text that opens the target, or undefined when the
 * reference leads nowhere. A renamed note opens without the heading, which
 * belonged to the address, not to the note found.
 */
export function linktext(state: ReferenceState, index: NoteIndex): string | undefined {
	if (state.kind !== 'note') return undefined;
	const { resolution, reference } = state;
	if (resolution.file === undefined || resolution.outcome === 'missing') return undefined;
	const path = index.obsidianPath(resolution.file);
	if (resolution.outcome === 'renamed' || reference.fragment === undefined) return path;
	return `${path}#${reference.fragment}`;
}
