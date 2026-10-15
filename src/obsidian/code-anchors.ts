// Scans the repository of the kadmos vault for code anchors. The code lies
// outside what Obsidian indexes, so this reads the file system directly and
// works on the desktop only.

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { type App, FileSystemAdapter } from 'obsidian';
import { type AnchorIndex, type AnchorSite, codeLink, indexAnchors } from '../core/anchor-index.ts';
import type { VaultContract } from '../core/contract.ts';
import { repositoryIsParent } from '../core/repository.ts';
import { ROOT_MARKER } from '../core/vault-location.ts';

/** Files larger than this are not source a person annotates. */
const MAX_FILE_BYTES = 1024 * 1024;
const SKIPPED_DIRECTORIES = new Set(['node_modules']);

export interface CodeAnchors {
	/** Absolute path of the repository root. */
	readonly root: string;
	readonly index: AnchorIndex;
}

/** The anchors of the repository, or undefined when the schema declares no anchor contract or no file system is at hand. */
export async function scanCodeAnchors(
	app: App,
	vaultPath: string,
	contract: VaultContract,
): Promise<CodeAnchors | undefined> {
	const { codeAnchors } = contract;
	const adapter = app.vault.adapter;
	if (codeAnchors === undefined || !(adapter instanceof FileSystemAdapter)) return undefined;
	const opened = adapter.getBasePath();
	const parentMarker = await readFile(path.join(path.dirname(opened), ROOT_MARKER), 'utf8').catch(() => undefined);
	const root = repositoryIsParent(vaultPath, path.basename(opened), parentMarker) ? path.dirname(opened) : opened;
	const vault = path.join(opened, vaultPath);
	const files = await sourceFiles(root, vault);
	return {
		root,
		index: indexAnchors(files, { ...contract, codeAnchors }),
	};
}

/** Opens the code at an anchor through the address the template builds. */
export function openCode(anchors: CodeAnchors, site: AnchorSite, template: string): void {
	const file = path.join(anchors.root, ...site.file.split('/'));
	window.open(codeLink(template, file, pathToFileURL(file).href, site.line));
}

// Text files below the root, outside the vault, dot-directories and dependency trees.
async function sourceFiles(root: string, vault: string): Promise<{ path: string; text: string }[]> {
	const found: { path: string; text: string }[] = [];
	const walk = async (directory: string): Promise<void> => {
		const entries = await readdir(directory, { withFileTypes: true });
		await Promise.all(
			entries.map(async (entry) => {
				const full = path.join(directory, entry.name);
				if (entry.name.startsWith('.') || full === vault) return;
				if (entry.isDirectory()) {
					if (!SKIPPED_DIRECTORIES.has(entry.name)) await walk(full);
					return;
				}
				if (!entry.isFile()) return;
				const { size } = await stat(full);
				if (size > MAX_FILE_BYTES) return;
				const text = await readFile(full, 'utf8');
				if (!text.includes('\0'))
					found.push({ path: path.relative(root, full).split(path.sep).join('/'), text });
			}),
		);
	};
	await walk(root);
	return found;
}
