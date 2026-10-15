import assert from 'node:assert/strict';
import { test } from 'node:test';
import { complete, type CompletionSource } from '../src/core/completion.ts';

const source: CompletionSource = {
	authorities: ['oikos'],
	notes: () => [
		'decisions/2026/10/D-001-standards-matter.md',
		'standards/note-lifecycle.md',
		'standards/validation.md',
	],
	headings: (_authority, path) => (path === 'standards/validation.md' ? ['Validation', 'Hard checks'] : []),
};

void test('the authority is completed first', () => {
	assert.deepEqual(complete('oi', source), [{ label: 'oikos', reference: 'kadmos://oikos/', complete: false }]);
	assert.deepEqual(complete('nomos', source), []);
});

void test('note paths match anywhere and rank a basename match first', () => {
	const labels = complete('oikos/stand', source).map((completion) => completion.label);
	assert.deepEqual(labels, [
		'decisions/2026/10/D-001-standards-matter.md',
		'standards/note-lifecycle.md',
		'standards/validation.md',
	]);
	assert.deepEqual(
		complete('oikos/valid', source).map((completion) => completion.reference),
		['kadmos://oikos/standards/validation.md'],
	);
});

void test('headings are completed and encoded', () => {
	assert.deepEqual(complete('oikos/standards/validation.md#hard', source), [
		{ label: 'Hard checks', reference: 'kadmos://oikos/standards/validation.md#Hard%20checks', complete: true },
	]);
});

void test('an undeclared authority completes nothing', () => {
	assert.deepEqual(complete('nomos/a', source), []);
});
