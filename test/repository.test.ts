import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repositoryIsParent } from '../src/core/repository.ts';

void test('the parent is the repository only when its .vault-root names the opened vault', () => {
	assert.equal(repositoryIsParent('', 'docs', 'docs\n'), true);
	assert.equal(repositoryIsParent('', 'docs', 'cadmus\n'), false);
	assert.equal(repositoryIsParent('', 'docs', 'docs'), false);
	assert.equal(repositoryIsParent('', 'docs', undefined), false);
	// The opened folder holds the vault in a child: it is the repository itself.
	assert.equal(repositoryIsParent('docs', 'repo', 'repo\n'), false);
});
