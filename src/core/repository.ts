// Where the repository of a kadmos vault lies, as the markers say. The vault
// folder Obsidian opened is its own repository root unless the folder above
// declares it, in its `.vault-root`, as its vault.

import { markerLine } from './vault-location.ts';

/**
 * Whether the repository root is the parent of the opened folder: true only
 * when the opened folder is the vault itself and the parent's `.vault-root`
 * names it.
 */
export function repositoryIsParent(
	vaultPath: string,
	folderName: string,
	parentRootMarker: string | undefined,
): boolean {
	if (vaultPath !== '' || parentRootMarker === undefined) return false;
	const named = markerLine(parentRootMarker, '.vault-root');
	return named.ok && named.value === folderName;
}
