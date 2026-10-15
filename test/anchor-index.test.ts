import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anchorsNaming, codeLink, indexAnchors, pairingProblems } from '../src/core/anchor-index.ts';
import { sourceContract } from './support.ts';

const index = indexAnchors(
	[
		{
			path: 'src/store.go',
			text: [
				'package store',
				'// ariadne-kadmou[store-put|implements|kadmos://oikos/decisions/put.md] put survives restart',
				'func Put() {}',
				'// ariadne-kadmou[twice|tests|kadmos://oikos/decisions/put.md]',
				'// ariadne-kadmou[broken|realises|kadmos://oikos/decisions/put.md]',
			].join('\n'),
		},
		{ path: 'test/store_test.go', text: '# ariadne-kadmou[twice|tests|kadmos://oikos/decisions/other.md]' },
		{ path: 'README.md', text: 'no marker here' },
	],
	sourceContract(),
);

void test('declarations are indexed by slug with their file and line', () => {
	const [site] = index.sites.get('store-put') ?? [];
	assert.ok(site !== undefined);
	assert.deepEqual([site.file, site.line, site.declaration.message], ['src/store.go', 2, 'put survives restart']);
	assert.equal(index.sites.get('twice')?.length, 2);
});

void test('a marked line that is no declaration is a problem, not an anchor', () => {
	assert.deepEqual(
		index.problems.map(({ file, line }) => `${file}:${line}`),
		['src/store.go:5'],
	);
	assert.equal(index.sites.has('broken'), false);
});

void test('the anchors naming a note are found by its path', () => {
	assert.deepEqual(
		anchorsNaming(index, 'decisions/put.md').map((site) => site.declaration.slug),
		['store-put', 'twice'],
	);
	assert.deepEqual(anchorsNaming(index, 'decisions/none.md'), []);
});

void test('anchored_by is exact: listed slugs exist and name the note, naming slugs are listed', () => {
	assert.deepEqual(pairingProblems(index, 'decisions/put.md', ['store-put', 'twice']), []);
	assert.deepEqual(pairingProblems(index, 'decisions/put.md', ['store-put', 'ghost']), [
		'"ghost" is listed but declared nowhere',
		'"twice" names this note but is not listed',
	]);
	assert.deepEqual(pairingProblems(index, 'decisions/other.md', ['store-put', 'twice']), [
		'"store-put" is listed but does not name this note',
	]);
});

void test('a code link fills the template', () => {
	assert.equal(
		codeLink('vscode://file/{path}:{line}', '/repo/my src/a.go', 'file:///repo/my%20src/a.go', 7),
		'vscode://file//repo/my%20src/a.go:7',
	);
	assert.equal(codeLink('{url}', '/a.go', 'file:///a.go', 1), 'file:///a.go');
});
