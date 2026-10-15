// The kadmos vault inside the folder Obsidian opened, as the markers and the
// root schema declare it.

import { type App, normalizePath } from 'obsidian';
import { ContractError, SCHEMA_FILE, type VaultContract, parseContract } from '../core/contract.ts';
import { type MarkerReader, locateVault } from '../core/vault-location.ts';

export type KadmosVault =
	| {
			readonly kind: 'vault';
			/** The vault folder relative to the Obsidian vault root; '' for the root. */
			readonly path: string;
			readonly profile: string;
			readonly contract: VaultContract;
	  }
	| { readonly kind: 'none' }
	| { readonly kind: 'error'; readonly reason: string };

export async function loadKadmosVault(app: App): Promise<KadmosVault> {
	const adapter = app.vault.adapter;
	// Markers are dotfiles, which the vault index does not list: read them through the adapter.
	const reader: MarkerReader = {
		read: async (path) => {
			const normalized = normalizePath(path);
			return (await adapter.exists(normalized)) ? await adapter.read(normalized) : undefined;
		},
		isFolder: async (path) => {
			const stat = await adapter.stat(normalizePath(path));
			return stat?.type === 'folder';
		},
	};

	const location = await locateVault(reader);
	if (location.kind !== 'vault') return location;

	const schemaPath = location.path === '' ? SCHEMA_FILE : `${location.path}/${SCHEMA_FILE}`;
	const schema = await reader.read(schemaPath);
	if (schema === undefined) return { kind: 'error', reason: `${schemaPath} is missing` };
	try {
		return { ...location, contract: parseContract(schema) };
	} catch (error) {
		if (error instanceof ContractError) return { kind: 'error', reason: error.message };
		throw error;
	}
}
