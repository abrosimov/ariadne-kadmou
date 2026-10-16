import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReference } from '../src/core/reference.ts';
import { type ResolutionOutcome, resolveNote, vaultFromFiles } from '../src/core/resolve.ts';
import { messages, onlyString, strings } from '../src/core/textproto.ts';
import { sourceContract, vectors } from './support.ts';

const contract = sourceContract();
const cases = messages(vectors('cross_instance_references_vectors.txtpb'), 'reference_resolution');

const OUTCOMES: Record<string, ResolutionOutcome> = {
	RESOLVED: 'resolved',
	STALE: 'stale',
	RENAMED: 'renamed',
	MISSING: 'missing',
	NOT_A_DIRECT_DEPENDENCY: 'not-a-direct-dependency',
};

void test('the resolution vectors are present', () => {
	assert.ok(cases.length > 0);
});

for (const [index, vector] of cases.entries()) {
	const reference = onlyString(vector, 'reference') ?? '';
	const name = (vector.fields.get('expected') ?? [])[0];
	const expected = typeof name === 'string' ? OUTCOMES[name] : undefined;
	void test(`resolution ${index + 1}: ${reference} is ${expected}`, () => {
		assert.ok(expected !== undefined, 'the vector names a known outcome');
		const parsed = parseReference(reference, contract);
		assert.ok(parsed.ok && parsed.value.kind === 'note');
		const headings = strings(vector, 'heading');
		// The vault in a vector is the authority's vault, whichever it is.
		const vault = vaultFromFiles(strings(vector, 'file'), () => headings);
		const resolution = resolveNote(parsed.value, {
			contract,
			directDependencies: new Set(strings(vector, 'direct_dependency')),
			vault: () => vault,
		});
		assert.equal(resolution.outcome, expected);
	});
}

void test('a dependency that is declared but not materialised is missing', () => {
	const parsed = parseReference('kadmos://nomos/a.md', contract);
	assert.ok(parsed.ok && parsed.value.kind === 'note');
	const resolution = resolveNote(parsed.value, {
		contract,
		directDependencies: new Set(['nomos']),
		vault: () => undefined,
	});
	assert.equal(resolution.outcome, 'missing');
});

void test('a renamed target is found among several notes of the same name', () => {
	const parsed = parseReference('kadmos://oikos/a/n.md', contract);
	assert.ok(parsed.ok && parsed.value.kind === 'note');
	const resolution = resolveNote(parsed.value, {
		contract,
		directDependencies: new Set(),
		vault: () => vaultFromFiles(['b/n.md', 'c/n.md'], () => []),
	});
	assert.deepEqual(resolution, { outcome: 'renamed', file: 'b/n.md' });
});
