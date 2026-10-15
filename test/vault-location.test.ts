import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type MarkerReader, locateVault } from '../src/core/vault-location.ts';

function folder(files: Record<string, string>, folders: string[] = []): MarkerReader {
	return {
		read: (path) => Promise.resolve(files[path]),
		isFolder: (path) => Promise.resolve(folders.includes(path)),
	};
}

void test('a root profile makes the opened folder the vault', async () => {
	assert.deepEqual(await locateVault(folder({ '.vault-profile': 'scaffold\n' })), {
		kind: 'vault',
		path: '',
		profile: 'scaffold',
	});
});

void test('a root declaration selects the named child', async () => {
	const reader = folder({ '.vault-root': 'docs\n', 'docs/.vault-profile': 'instance\n' }, ['docs']);
	assert.deepEqual(await locateVault(reader), { kind: 'vault', path: 'docs', profile: 'instance' });
});

void test('the declaration is followed whatever the child is called', async () => {
	const reader = folder({ '.vault-root': 'cadmus\n', 'cadmus/.vault-profile': 'instance\n' }, ['cadmus']);
	assert.deepEqual(await locateVault(reader), { kind: 'vault', path: 'cadmus', profile: 'instance' });
});

void test('a child marker alone selects nothing', async () => {
	const reader = folder({ 'docs/.vault-profile': 'instance\n' }, ['docs']);
	assert.deepEqual(await locateVault(reader), { kind: 'none' });
});

for (const [name, files, folders] of [
	['both root markers', { '.vault-profile': 'scaffold\n', '.vault-root': 'docs\n' }, ['docs']],
	['a profile without LF', { '.vault-profile': 'scaffold' }, []],
	['a profile with whitespace', { '.vault-profile': ' scaffold\n' }, []],
	['an empty declaration', { '.vault-root': '\n' }, []],
	['a dot-prefixed child', { '.vault-root': '.docs\n', '.docs/.vault-profile': 'instance\n' }, ['.docs']],
	['a nested path', { '.vault-root': 'a/docs\n', 'a/docs/.vault-profile': 'instance\n' }, ['a/docs']],
	['a missing child', { '.vault-root': 'docs\n' }, []],
	['a child without profile', { '.vault-root': 'docs\n' }, ['docs']],
] as const) {
	void test(`${name} is an error`, async () => {
		const location = await locateVault(folder(files, [...folders]));
		assert.equal(location.kind, 'error');
	});
}
