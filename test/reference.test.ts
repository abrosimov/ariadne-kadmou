import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatReference, parseReference } from '../src/core/reference.ts';
import { messages, onlyString, strings } from '../src/core/textproto.ts';
import { sourceContract, vectors } from './support.ts';

const contract = sourceContract();
const cases = messages(vectors('cross_instance_references_vectors.txtpb'), 'reference_grammar');

void test('the grammar vectors are present', () => {
	assert.ok(cases.length > 0);
});

for (const vector of cases) {
	const reference = onlyString(vector, 'reference') ?? '';
	const valid = (vector.fields.get('valid') ?? [false])[0] === true;
	void test(`grammar: ${reference}`, () => {
		const parsed = parseReference(reference, contract);
		assert.equal(parsed.ok, valid, parsed.ok ? 'parsed' : parsed.reason);
		if (!parsed.ok) return;
		const value = parsed.value;
		assert.equal(value.authority, onlyString(vector, 'authority'));
		if (value.kind === 'anchor') {
			assert.equal(value.slug, onlyString(vector, 'slug'));
			assert.deepEqual(strings(vector, 'path'), []);
		} else {
			assert.equal(value.path, onlyString(vector, 'path'));
			assert.equal(value.fragment, onlyString(vector, 'fragment'));
			assert.deepEqual(strings(vector, 'slug'), []);
		}
		assert.equal(formatReference(value), reference);
	});
}

void test('a heading with spaces is percent-encoded and decoded', () => {
	const parsed = parseReference('kadmos://oikos/standards/note-lifecycle.md#Body%20immutability', contract);
	assert.ok(parsed.ok);
	assert.equal(parsed.value.kind === 'note' && parsed.value.fragment, 'Body immutability');
	assert.equal(formatReference(parsed.value), 'kadmos://oikos/standards/note-lifecycle.md#Body%20immutability');
});

void test('an anchor address needs the code anchor contract', () => {
	const parsed = parseReference('kadmos://oikos/#store-put', { retentionRoots: ['archive', 'graveyard'] });
	assert.equal(parsed.ok, false);
});

for (const reference of [
	'kadmos://oikos/a b.md',
	'kadmos://oikos/a.md?x=1',
	'kadmos://oikos//a.md',
	'kadmos://oikos/../a.md',
	'kadmos://oikos/a.md#',
	'kadmos://oikos/a.md#%E0',
	'kadmos://oikos/',
	'kadmos://oikos',
	'https://oikos/a.md',
]) {
	void test(`grammar rejects ${reference}`, () => {
		assert.equal(parseReference(reference, contract).ok, false);
	});
}

void test('parentheses are encoded, so a formatted reference survives as a Markdown link target', () => {
	assert.equal(
		formatReference({ kind: 'note', authority: 'oikos', path: 'a/D (draft).md', fragment: 'Why (not)' }),
		'kadmos://oikos/a/D%20%28draft%29.md#Why%20%28not%29',
	);
});
