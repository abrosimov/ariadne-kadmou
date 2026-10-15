import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContractError, parseContract } from '../src/core/contract.ts';
import { vector } from './support.ts';

void test('the source vault schema yields the contract', () => {
	const contract = parseContract(vector('source_vault_schema.txtpb'));
	assert.deepEqual(contract.retentionRoots, ['archive', 'graveyard']);
	assert.ok(contract.excludedRootDirectories.includes('templates'));
	assert.ok(contract.excludedFileNames.includes('README.md'));
	const anchors = contract.codeAnchors;
	assert.ok(anchors !== undefined);
	assert.equal(anchors.marker, 'ariadne-kadmou');
	assert.deepEqual(anchors.relations, ['implements', 'tests', 'evidences']);
	assert.equal(anchors.reverseField, 'anchored_by');
});

void test('the distributed schema parses and may lack code anchors', () => {
	const contract = parseContract(vector('vault_schema.txtpb'));
	assert.deepEqual(contract.retentionRoots, ['archive', 'graveyard']);
	assert.equal(contract.codeAnchors, undefined);
});

void test('a schema without retention roots is an error', () => {
	assert.throws(() => parseContract('config { validation_scope {} }'), ContractError);
});

void test('a malformed schema is an error', () => {
	assert.throws(() => parseContract('config { retention_projection {'), ContractError);
});

const anchors = (body: string): string =>
	`config { retention_projection { root_directory: "archive" } code_anchors { marker: "m" reverse_field: "r" ${body} } }`;

void test('an anchor contract with an invalid slug pattern or without relations is an error', () => {
	assert.throws(() => parseContract(anchors('slug_pattern: "(" relation: "tests"')), ContractError);
	assert.throws(() => parseContract(anchors('slug_pattern: "^a$"')), ContractError);
	assert.throws(() => parseContract(anchors('relation: "tests"')), ContractError);
});

void test('a schema without config is an error', () => {
	assert.throws(() => parseContract('version: 1'), ContractError);
});
