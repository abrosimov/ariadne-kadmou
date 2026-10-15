// The code anchors of the kadmos vault's repository, which is the folder
// Obsidian opened: Ariadne reads nothing outside it. The code lies outside
// what Obsidian indexes, so the scan reads the file system and runs on the
// desktop only.

import path from 'node:path';
import { shell } from 'electron';
import { type App, FileSystemAdapter, Notice } from 'obsidian';
import { type AnchorIndex, type AnchorSite, indexAnchors } from '../core/anchor-index.ts';
import type { VaultContract } from '../core/contract.ts';
import { filesMentioning, type SourceCache } from '../core/source-scan.ts';

export interface CodeAnchors {
	/** Absolute path of the repository root: the folder Obsidian opened. */
	readonly root: string;
	readonly index: AnchorIndex;
	/** Where the next scan starts from. */
	readonly cache: SourceCache;
}

/** The anchors of the repository, or why there are none to show. */
export async function scanCodeAnchors(
	app: App,
	vaultPath: string,
	contract: VaultContract,
	previous: SourceCache | undefined,
): Promise<CodeAnchors | string> {
	const { codeAnchors } = contract;
	const adapter = app.vault.adapter;
	if (codeAnchors === undefined) return 'Code anchors are not checked: the schema declares none';
	if (!(adapter instanceof FileSystemAdapter)) return 'Code anchors are checked on the desktop only';
	if (vaultPath === '') return 'Code anchors are not checked: open Obsidian at the repository root to scan its code';
	const root = adapter.getBasePath();
	const { files, cache } = await filesMentioning(root, path.join(root, vaultPath), codeAnchors.marker, previous);
	return { root, index: indexAnchors(files, { ...contract, codeAnchors }), cache };
}

/** Opens the code at an anchor with the operating system's default application. */
export async function openCode(anchors: CodeAnchors, site: AnchorSite): Promise<void> {
	const failure = await shell.openPath(path.join(anchors.root, ...site.file.split('/'))).catch(String);
	if (failure !== '') new Notice(`${site.file} could not be opened: ${failure}`);
}
