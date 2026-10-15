// Finds the files of a repository that mention the anchor marker. In a Git
// work tree the files are those Git does not ignore, so build output and
// vendored copies are left out; elsewhere the tree is walked. One unreadable
// entry costs that entry, not the scan.

import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

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

/**
 * Text files below `root` that contain `marker`, outside `excluded`,
 * dot-entries and dependency trees, with the cache the next scan starts from.
 * `previous` is only read, so scans that overlap do not disturb each other.
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
	const keep = (file: string): boolean => included(root, excluded, file);
	const listed = ((await gitFiles(root)) ?? (await walk(root, keep))).filter(keep);
	for (let start = 0; start < listed.length; start += PARALLEL_READS) {
		await Promise.all(listed.slice(start, start + PARALLEL_READS).map(read));
	}
	const files: SourceFile[] = [];
	for (const [file, { text }] of cache) {
		if (text !== undefined) files.push({ path: path.relative(root, file).split(path.sep).join('/'), text });
	}
	return { files: files.sort((a, b) => a.path.localeCompare(b.path)), cache };
}

function included(root: string, excluded: string, file: string): boolean {
	const inside = path.relative(excluded, file);
	if (excluded !== '' && !inside.startsWith('..') && !path.isAbsolute(inside)) return false;
	return path
		.relative(root, file)
		.split(path.sep)
		.every((segment) => !segment.startsWith('.') && !SKIPPED_DIRECTORIES.has(segment));
}

// Tracked and untracked files Git does not ignore, or undefined outside a work tree.
async function gitFiles(root: string): Promise<string[] | undefined> {
	const args = ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];
	return await new Promise((resolve) => {
		execFile('git', args, { cwd: root, maxBuffer: 256 * 1024 * 1024 }, (error, stdout) => {
			resolve(
				error === null
					? stdout.split('\0').flatMap((file) => (file === '' ? [] : [path.join(root, file)]))
					: undefined,
			);
		});
	});
}

// Directories one at a time, so a large tree does not exhaust file handles.
async function walk(directory: string, keep: (file: string) => boolean): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
		const full = path.join(directory, entry.name);
		if (!keep(full)) continue;
		if (entry.isDirectory()) files.push(...(await walk(full, keep)));
		else if (entry.isFile()) files.push(full);
	}
	return files;
}
