import assert from 'node:assert/strict';
import fs, { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
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
	const found = await filesMentioning(root, path.join(root, 'docs'), MARKER);
	assert.deepEqual(
		found.map((file) => file.path),
		['src/a.go', 'src/deep/b.py'],
	);
});

void test('a root that cannot be read yields nothing', async () => {
	assert.deepEqual(await filesMentioning(path.join(os.tmpdir(), 'no-such-root'), '', MARKER), []);
});

void test('a file that vanishes after it was listed is skipped', async (context) => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'source-scan-'));
	await writeFile(path.join(root, 'a.go'), MARKER);
	context.mock.method(fs, 'stat', async () => await Promise.reject(new Error('gone')));
	syncBuiltinESMExports();
	try {
		assert.deepEqual(await filesMentioning(root, '', MARKER), []);
	} finally {
		context.mock.restoreAll();
		syncBuiltinESMExports();
	}
});
