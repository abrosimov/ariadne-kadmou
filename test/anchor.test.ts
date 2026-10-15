import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseAnchorLine } from '../src/core/anchor.ts';
import { messages, onlyString } from '../src/core/textproto.ts';
import { sourceContract, vectors } from './support.ts';

const contract = sourceContract();
const cases = messages(vectors('code_anchors_vectors.txtpb'), 'anchor_declaration');

void test('the anchor vectors are present', () => {
	assert.ok(cases.length > 0);
});

for (const vector of cases) {
	const line = onlyString(vector, 'line') ?? '';
	const valid = (vector.fields.get('valid') ?? [false])[0] === true;
	void test(`anchor: ${line}`, () => {
		const parsed = parseAnchorLine(line, contract);
		assert.ok(parsed !== undefined, 'the line carries the marker');
		assert.equal(parsed.ok, valid, parsed.ok ? 'parsed' : parsed.reason);
		if (!parsed.ok) return;
		assert.equal(parsed.value.slug, onlyString(vector, 'slug'));
		assert.equal(parsed.value.relation, onlyString(vector, 'relation'));
		assert.equal(parsed.value.reference, onlyString(vector, 'reference'));
		assert.equal(parsed.value.message, onlyString(vector, 'message'));
	});
}

void test('a line without the marker is not a declaration', () => {
	assert.equal(parseAnchorLine('// an ordinary comment', contract), undefined);
});

void test('the message is separated from the brackets by whitespace', () => {
	const parsed = parseAnchorLine('// ariadne-kadmou[a|tests|kadmos://oikos/a.md]x', contract);
	assert.equal(parsed?.ok, false);
});

void test('a comment continuation and an HTML comment are comment syntax', () => {
	for (const line of [
		' * ariadne-kadmou[a|tests|kadmos://oikos/a.md]',
		'<!-- ariadne-kadmou[a|tests|kadmos://oikos/a.md] -->',
		'-- ariadne-kadmou[a|tests|kadmos://oikos/a.md]',
	]) {
		assert.equal(parseAnchorLine(line, contract)?.ok, true, line);
	}
});
