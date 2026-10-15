import assert from 'node:assert/strict';
import fs, { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { filesMentioning } from '../src/core/source-scan.ts';

const MARKER = 'ariadne-kadmou';

void test('only readable text files outside the vault and the skipped trees are returned', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'source-scan-'));
	const files: Record<string, string> = {
		'src/a.go': `// ${MARKER}[a|tests|kadmos://oikos/a.md]`,
		'src/deep/b.py': `# ${MARKER}[b|tests|kadmos://oikos/a.md]`,
		'src/plain.go': 'no marker',
		'docs/note.md': MARKER,
		'node_modules/dep/c.go': MARKER,
		'.git/d': MARKER,
		'bin.dat': `${MARKER}\0`,
		'big.go': `${MARKER}${' '.repeat(1024 * 1024)}`,
	};
	for (const [file, text] of Object.entries(files)) {
		await mkdir(path.dirname(path.join(root, file)), { recursive: true });
		await writeFile(path.join(root, file), text);
	}
	await symlink(path.join(root, 'src'), path.join(root, 'linked'));
	await symlink(path.join(root, 'absent'), path.join(root, 'dangling.go'));
	const { files: found } = await filesMentioning(root, path.join(root, 'docs'), MARKER);
	assert.deepEqual(
		found.map((file) => file.path),
		['src/a.go', 'src/deep/b.py'],
	);
});

void test('a root that cannot be read yields nothing', async () => {
	const { files } = await filesMentioning(path.join(os.tmpdir(), 'no-such-root'), '', MARKER);
	assert.deepEqual(files, []);
});

void test('a file that vanishes after it was listed is skipped', async (context) => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'source-scan-'));
	await writeFile(path.join(root, 'a.go'), MARKER);
	context.mock.method(fs, 'stat', async () => await Promise.reject(new Error('gone')));
	syncBuiltinESMExports();
	try {
		const { files } = await filesMentioning(root, '', MARKER);
		assert.deepEqual(files, []);
	} finally {
		context.mock.restoreAll();
		syncBuiltinESMExports();
	}
});

void test('a cached scan reads only what changed and forgets what is gone', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'source-scan-'));
	const a = path.join(root, 'a.go');
	const b = path.join(root, 'b.go');
	const c = path.join(root, 'c.go');
	await writeFile(a, MARKER);
	await writeFile(b, 'none');
	await writeFile(c, `${MARKER} kept`);
	const first = await filesMentioning(root, '', MARKER);
	assert.deepEqual(
		first.files.map((file) => file.path),
		['a.go', 'c.go'],
	);
	await writeFile(b, `${MARKER} now`);
	await utimes(b, new Date(), new Date(Date.now() + 5000));
	await rm(a);
	const second = await filesMentioning(root, '', MARKER, first.cache);
	assert.deepEqual(
		second.files.map((file) => [file.path, file.text]),
		[
			['b.go', `${MARKER} now`],
			['c.go', `${MARKER} kept`],
		],
	);
	assert.equal(second.cache.get(c), first.cache.get(c));
	assert.deepEqual([...second.cache.keys()].sort(), [b, c]);
	// The previous cache is left as it was, for a scan that overlaps.
	assert.deepEqual([...first.cache.keys()].sort(), [a, b, c]);
});

void test('in a Git work tree, what Git ignores is not scanned', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'source-scan-'));
	await mkdir(path.join(root, 'src'));
	await mkdir(path.join(root, 'dist'));
	await writeFile(path.join(root, '.gitignore'), 'dist/\n');
	await writeFile(path.join(root, 'src/a.ts'), MARKER);
	await writeFile(path.join(root, 'dist/a.js'), MARKER);
	await promisify(execFile)('git', ['init', '--quiet'], { cwd: root });
	const { files } = await filesMentioning(root, '', MARKER);
	assert.deepEqual(
		files.map((file) => file.path),
		['src/a.ts'],
	);
});
