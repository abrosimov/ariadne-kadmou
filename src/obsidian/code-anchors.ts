// The code anchors of the kadmos vault's repository. The code lies outside
// what Obsidian indexes, so the scan reads the file system and runs on the
// desktop only.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type App, FileSystemAdapter } from 'obsidian';
import { type AnchorIndex, type AnchorSite, codeLink, indexAnchors } from '../core/anchor-index.ts';
import type { VaultContract } from '../core/contract.ts';
import { repositoryIsParent } from '../core/repository.ts';
import { filesMentioning, type SourceCache } from '../core/source-scan.ts';
import { ROOT_MARKER } from '../core/vault-location.ts';

export interface CodeAnchors {
	/** Absolute path of the repository root. */
	readonly root: string;
	readonly index: AnchorIndex;
}

/** The anchors of the repository, or why there are none to show. */
export async function scanCodeAnchors(
	app: App,
	vaultPath: string,
	contract: VaultContract,
	cache: SourceCache,
): Promise<CodeAnchors | string> {
	const { codeAnchors } = contract;
	const adapter = app.vault.adapter;
	if (codeAnchors === undefined) return 'Code anchors are not checked: the schema declares none';
	if (!(adapter instanceof FileSystemAdapter)) return 'Code anchors are checked on the desktop only';
	const opened = adapter.getBasePath();
	const parentMarker = await readFile(path.join(path.dirname(opened), ROOT_MARKER), 'utf8').catch(() => undefined);
	const root = repositoryIsParent(vaultPath, path.basename(opened), parentMarker) ? path.dirname(opened) : opened;
	const vault = path.join(opened, vaultPath);
	// A vault at the repository root leaves no file outside it to anchor.
	const files = root === vault ? [] : await filesMentioning(root, vault, codeAnchors.marker, cache);
	return { root, index: indexAnchors(files, { ...contract, codeAnchors }) };
}

/** Opens the code at an anchor through the address the template builds. */
export function openCode(anchors: CodeAnchors, site: AnchorSite, template: string): void {
	const file = path.join(anchors.root, ...site.file.split('/'));
	window.open(codeLink(template, file, pathToFileURL(file).href, site.line));
}
