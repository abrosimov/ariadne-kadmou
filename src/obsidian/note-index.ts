// The notes of the kadmos vault as Obsidian sees them, keyed by their path
// relative to the kadmos vault root. The note population follows the
// contract's validation scope; headings come from the metadata cache.

import { type App, TFile } from 'obsidian';
import type { VaultContract } from '../core/contract.ts';
import { type VaultView, vaultFromFiles } from '../core/resolve.ts';

export class NoteIndex {
	private view: VaultView | undefined;
	private active: readonly string[] | undefined;

	private readonly app: App;
	/** The kadmos vault folder relative to the Obsidian vault root; '' for the root. */
	readonly root: string;
	readonly contract: VaultContract;

	constructor(app: App, root: string, contract: VaultContract) {
		this.app = app;
		this.root = root;
		this.contract = contract;
	}

	/** Drops what was computed; the next read recomputes it. */
	invalidate(): void {
		this.view = undefined;
		this.active = undefined;
	}

	vault(): VaultView {
		this.view ??= vaultFromFiles(this.notePaths(), (path) => this.headings(path));
		return this.view;
	}

	/** Note paths outside the retention roots: what a reference may name. */
	activeNotes(): readonly string[] {
		this.active ??= this.notePaths()
			.filter((path) => !this.contract.retentionRoots.includes(firstSegment(path)))
			.toSorted((a, b) => a.localeCompare(b));
		return this.active;
	}

	headings(path: string): readonly string[] {
		const file = this.file(path);
		if (file === undefined) return [];
		return (this.app.metadataCache.getFileCache(file)?.headings ?? []).map((heading) => heading.heading);
	}

	/** The Obsidian file of a vault-relative note path. */
	file(path: string): TFile | undefined {
		const file = this.app.vault.getAbstractFileByPath(this.obsidianPath(path));
		return file instanceof TFile ? file : undefined;
	}

	obsidianPath(path: string): string {
		return this.root === '' ? path : `${this.root}/${path}`;
	}

	private notePaths(): string[] {
		const prefix = this.root === '' ? '' : `${this.root}/`;
		const { excludedRootDirectories, excludedFileNames } = this.contract;
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(prefix))
			.map((file) => file.path.slice(prefix.length))
			.filter(
				(path) =>
					!(path.includes('/') && excludedRootDirectories.includes(firstSegment(path))) &&
					!excludedFileNames.includes(path.slice(path.lastIndexOf('/') + 1)),
			);
	}
}

function firstSegment(path: string): string {
	const slash = path.indexOf('/');
	return slash === -1 ? path : path.slice(0, slash);
}
