// Finds the files of a repository that mention the anchor marker. It reads
// the file system directly and tolerates what it cannot read: one unreadable
// entry costs that entry, not the scan.

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

/**
 * Text files below `root` that contain `marker`, outside `excluded`,
 * dot-entries and dependency trees.
 */
export async function filesMentioning(root: string, excluded: string, marker: string): Promise<SourceFile[]> {
	const found: SourceFile[] = [];
	const read = async (file: string): Promise<void> => {
		try {
			const { size } = await stat(file);
			if (size > MAX_FILE_BYTES) return;
			const text = await readFile(file, 'utf8');
			if (text.includes(marker) && !text.includes('\0')) {
				found.push({ path: path.relative(root, file).split(path.sep).join('/'), text });
			}
		} catch {
			// Gone or unreadable since it was listed.
		}
	};
	const walk = async (directory: string): Promise<void> => {
		const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
		const files: string[] = [];
		for (const entry of entries) {
			const full = path.join(directory, entry.name);
			if (entry.name.startsWith('.') || full === excluded) continue;
			if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) await walk(full);
			else if (entry.isFile()) files.push(full);
		}
		for (let start = 0; start < files.length; start += PARALLEL_READS) {
			await Promise.all(files.slice(start, start + PARALLEL_READS).map(read));
		}
	};
	await walk(root);
	return found.toSorted((a, b) => a.path.localeCompare(b.path));
}
