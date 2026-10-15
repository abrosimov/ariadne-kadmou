// Where the kadmos vault lies within the opened folder. The markers of kadmos
// `standards/validation.md` decide it, and nothing else does: a root
// `.vault-profile` makes the folder itself the vault, a root `.vault-root`
// names one immediate child that carries `.vault-profile`. A child marker
// alone never selects the child, and there is no search.

export const PROFILE_MARKER = '.vault-profile';
export const ROOT_MARKER = '.vault-root';

export interface MarkerReader {
	/** File contents, or undefined when no file is at the path. */
	read(path: string): Promise<string | undefined>;
	isFolder(path: string): Promise<boolean>;
}

export type VaultLocation =
	/** `path` is the vault folder relative to the opened folder; '' for the folder itself. */
	| { readonly kind: 'vault'; readonly path: string; readonly profile: string }
	/** Neither marker: not a kadmos vault, Ariadne stays idle. */
	| { readonly kind: 'none' }
	| { readonly kind: 'error'; readonly reason: string };

export async function locateVault(reader: MarkerReader): Promise<VaultLocation> {
	const profile = await reader.read(PROFILE_MARKER);
	const root = await reader.read(ROOT_MARKER);

	if (profile !== undefined && root !== undefined) {
		return error(`${PROFILE_MARKER} and ${ROOT_MARKER} are mutually exclusive`);
	}
	if (profile !== undefined) {
		const name = markerLine(profile, PROFILE_MARKER);
		if (!name.ok) return error(name.reason);
		return { kind: 'vault', path: '', profile: name.value };
	}
	if (root === undefined) return { kind: 'none' };

	const child = markerLine(root, ROOT_MARKER);
	if (!child.ok) return error(child.reason);
	const name = child.value;
	if (name === '.' || name === '..' || name.startsWith('.') || /[/\\]/u.test(name)) {
		return error(`${ROOT_MARKER} names one immediate, non-dot-prefixed child, not "${name}"`);
	}
	if (!(await reader.isFolder(name))) return error(`${ROOT_MARKER} names "${name}", which is not a folder`);
	const childProfile = await reader.read(`${name}/${PROFILE_MARKER}`);
	if (childProfile === undefined) return error(`${ROOT_MARKER} names "${name}", which carries no ${PROFILE_MARKER}`);
	const childName = markerLine(childProfile, `${name}/${PROFILE_MARKER}`);
	if (!childName.ok) return error(childName.reason);
	return { kind: 'vault', path: name, profile: childName.value };
}

// A marker is one UTF-8 line with one terminating LF and no surrounding whitespace.
function markerLine(content: string, file: string): { ok: true; value: string } | { ok: false; reason: string } {
	if (!content.endsWith('\n')) return { ok: false, reason: `${file} ends with one LF` };
	const value = content.slice(0, -1);
	if (value === '' || /\s/u.test(value) || value.trim() !== value) {
		return { ok: false, reason: `${file} holds one non-empty line without whitespace` };
	}
	return { ok: true, value };
}

function error(reason: string): VaultLocation {
	return { kind: 'error', reason };
}
