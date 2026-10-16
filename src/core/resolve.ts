// Resolution of a note reference, with the outcome classes of kadmos
// `standards/cross-instance-references.md`.

import type { VaultContract } from './contract.ts';
import { type NoteReference, OIKOS } from './reference.ts';

export type ResolutionOutcome = 'resolved' | 'stale' | 'renamed' | 'missing' | 'not-a-direct-dependency';

export interface Resolution {
	readonly outcome: ResolutionOutcome;
	/** The file the reference was found at, vault-relative, unless missing. */
	readonly file?: string;
}

/** What the resolver can see of the authority's vault. */
export interface VaultView {
	/** Note files, vault-relative, retention roots included as on disk. */
	hasFile: (path: string) => boolean;
	/** Note files with this basename, vault-relative. */
	filesNamed: (basename: string) => readonly string[];
	/** Headings of a note file, as Obsidian spells a heading reference. */
	headings: (path: string) => readonly string[];
}

export interface ResolutionContext {
	readonly contract: Pick<VaultContract, 'retentionRoots'>;
	/** Canonical names of the referring vault's direct dependencies. */
	readonly directDependencies: ReadonlySet<string>;
	/** The authority's vault, or undefined when it is not available. */
	readonly vault: (authority: string) => VaultView | undefined;
}

export function resolveNote(reference: NoteReference, context: ResolutionContext): Resolution {
	const { authority, path, fragment } = reference;
	if (authority !== OIKOS && !context.directDependencies.has(authority)) {
		return { outcome: 'not-a-direct-dependency' };
	}
	const vault = context.vault(authority);
	if (vault === undefined) return { outcome: 'missing' };

	const withFragment = (outcome: ResolutionOutcome, file: string): Resolution =>
		fragment === undefined || vault.headings(file).includes(fragment)
			? { outcome, file }
			: { outcome: 'missing', file };

	if (vault.hasFile(path)) return withFragment('resolved', path);
	for (const root of context.contract.retentionRoots) {
		const retained = `${root}/${path}`;
		if (vault.hasFile(retained)) return withFragment('stale', retained);
	}
	const basename = path.slice(path.lastIndexOf('/') + 1);
	const elsewhere = vault.filesNamed(basename)[0];
	if (elsewhere !== undefined) return { outcome: 'renamed', file: elsewhere };
	return { outcome: 'missing' };
}

/** A VaultView over a plain list of files, for tests and for snapshots. */
export function vaultFromFiles(files: Iterable<string>, headings: (path: string) => readonly string[]): VaultView {
	const all = new Set(files);
	const byName = new Map<string, string[]>();
	for (const file of all) {
		const name = file.slice(file.lastIndexOf('/') + 1);
		const list = byName.get(name);
		if (list === undefined) byName.set(name, [file]);
		else list.push(file);
	}
	return {
		hasFile: (path) => all.has(path),
		filesNamed: (basename) => byName.get(basename) ?? [],
		headings,
	};
}
