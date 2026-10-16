// Finds the files of a repository that mention the anchor marker. The walk
// honours the .gitignore files it meets, so build output and vendored copies
// are left out without running Git, and descends into submodules like any
// directory. Symbolic links are not followed. One unreadable entry costs that
// entry, not the scan.

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';

/** Files larger than this are not source a person annotates. */
const MAX_FILE_BYTES = 1024 * 1024;
/** Files read at once. */
const PARALLEL_READS = 16;
const SKIPPED_DIRECTORIES = new Set(['node_modules']);

export interface SourceFile {
	/** Path relative to the root, with `/` separators. */
	readonly path: string;
	readonly text: string;
}

/** What a scan learned of each file, by absolute path: unchanged files are not read again. */
export type SourceCache = ReadonlyMap<
	string,
	{ readonly mtimeMs: number; readonly size: number; readonly text?: string }
>;

/** The .gitignore rules of one directory, which apply below it. */
interface Rules {
	readonly base: string;
	readonly ignores: Ignore;
}

/**
 * Text files below `root` that contain `marker`, outside `excluded`, ignored
 * paths, dot-entries and dependency trees, with the cache the next scan
 * starts from. `previous` is only read, so overlapping scans do not disturb
 * each other.
 */
export async function filesMentioning(
	root: string,
	excluded: string,
	marker: string,
	previous: SourceCache = new Map(),
): Promise<{ readonly files: SourceFile[]; readonly cache: SourceCache }> {
	const cache = new Map<string, { mtimeMs: number; size: number; text?: string }>();
	const read = async (file: string): Promise<void> => {
		try {
			const { mtimeMs, size } = await stat(file);
			const known = previous.get(file);
			if (known?.mtimeMs === mtimeMs && known.size === size) {
				cache.set(file, known);
				return;
			}
			const text = size > MAX_FILE_BYTES ? '' : await readFile(file, 'utf8');
			cache.set(file, { mtimeMs, size, ...(text.includes(marker) && !text.includes('\0') ? { text } : {}) });
		} catch {
			// Gone or unreadable since it was listed.
		}
	};
	const listed: string[] = [];
	await walk(root, excluded, [], listed);
	for (let start = 0; start < listed.length; start += PARALLEL_READS) {
		await Promise.all(listed.slice(start, start + PARALLEL_READS).map(read));
	}
	const files: SourceFile[] = [];
	for (const [file, { text }] of cache) {
		if (text !== undefined) files.push({ path: posix(path.relative(root, file)), text });
	}
	return { files: files.sort((a, b) => a.path.localeCompare(b.path)), cache };
}

// Directories one at a time, so a large tree does not exhaust file handles.
async function walk(directory: string, excluded: string, inherited: readonly Rules[], files: string[]): Promise<void> {
	const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
	const own = entries.some((entry) => entry.name === '.gitignore' && entry.isFile())
		? await readFile(path.join(directory, '.gitignore'), 'utf8').catch(() => '')
		: '';
	const rules = own === '' ? inherited : [{ base: directory, ignores: ignore().add(own) }, ...inherited];
	for (const entry of entries) {
		const full = path.join(directory, entry.name);
		const isDirectory = entry.isDirectory();
		if (entry.name.startsWith('.') || within(excluded, full) || ignored(rules, full, isDirectory)) continue;
		if (isDirectory && !SKIPPED_DIRECTORIES.has(entry.name)) await walk(full, excluded, rules, files);
		else if (entry.isFile()) files.push(full);
	}
}

// As in Git, the deepest .gitignore that decides a path wins, so it may re-include what an outer one ignores.
function ignored(rules: readonly Rules[], file: string, isDirectory: boolean): boolean {
	for (const { base, ignores } of rules) {
		const { ignored: excluded, unignored } = ignores.test(
			posix(path.relative(base, file)) + (isDirectory ? '/' : ''),
		);
		if (excluded || unignored) return excluded;
	}
	return false;
}

function within(directory: string, file: string): boolean {
	const relative = path.relative(directory, file);
	return directory !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function posix(relative: string): string {
	return relative.split(path.sep).join('/');
}
