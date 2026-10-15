import assert from 'node:assert/strict';
import { test } from 'node:test';
import { complete, type CompletionSource } from '../src/core/completion.ts';
import { parseReference } from '../src/core/reference.ts';
import { sourceContract } from './support.ts';

const source: CompletionSource = {
	authorities: ['oikos'],
	notes: () => [
		'decisions/2026/10/D-001-standards-matter.md',
		'standards/note-lifecycle.md',
		'standards/validation.md',
	],
	headings: (_authority, path) =>
		path === 'standards/validation.md' ? ['Validation', 'Hard checks', 'C# bindings', 'L12'] : [],
	anchors: () => ['store-put', 'single-writer'],
	accepts: (reference) => reference.endsWith('/') || parseReference(reference, sourceContract()).ok,
};

void test('the authority is completed first', () => {
	assert.deepEqual(complete('oi', source), [{ label: 'oikos', reference: 'kadmos://oikos/' }]);
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
		{ label: 'Hard checks', reference: 'kadmos://oikos/standards/validation.md#Hard%20checks' },
	]);
});

void test('an undeclared authority completes nothing', () => {
	assert.deepEqual(complete('nomos/a', source), []);
});

void test('anchor slugs are completed after the hash', () => {
	assert.deepEqual(complete('oikos/#put', source), [{ label: 'store-put', reference: 'kadmos://oikos/#store-put' }]);
});

void test('a malformed escape is matched as typed', () => {
	assert.deepEqual(complete('oikos/%E0', source), []);
});

void test('a malformed path before the hash completes nothing, not anchors', () => {
	assert.deepEqual(complete('oikos/50%#', source), []);
});

void test('a heading the grammar rejects is not offered', () => {
	assert.deepEqual(
		complete('oikos/standards/validation.md#', source).map((completion) => completion.label),
		['Hard checks', 'Validation'],
	);
});
