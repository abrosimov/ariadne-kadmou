import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findReferenceLinks, referencePrefixAt } from '../src/core/link-scan.ts';

void test('a Markdown link to a reference is found with its text and target', () => {
	const text = 'See [the target](kadmos://oikos/a/b.md#Section%20A) here.';
	const [link] = findReferenceLinks(text);
	assert.ok(link !== undefined);
	assert.equal(link.uri, 'kadmos://oikos/a/b.md#Section%20A');
	assert.equal(text.slice(link.textFrom, link.textTo), 'the target');
	assert.equal(text.slice(link.uriFrom, link.uriTo), link.uri);
	assert.equal(text.slice(link.from, link.to), '[the target](kadmos://oikos/a/b.md#Section%20A)');
});

void test('an angle-bracketed target and a title are understood', () => {
	const text = '[x](<kadmos://oikos/a.md> "title")';
	const [link] = findReferenceLinks(text);
	assert.equal(link?.uri, 'kadmos://oikos/a.md');
	assert.equal(text.slice(link.uriFrom, link.uriTo), 'kadmos://oikos/a.md');
	assert.equal(link.to, text.length);
});

void test('several links on a line are found in order', () => {
	const links = findReferenceLinks('[a](kadmos://oikos/a.md) and [b](kadmos://nomos/b.md)');
	assert.deepEqual(
		links.map((link) => link.uri),
		['kadmos://oikos/a.md', 'kadmos://nomos/b.md'],
	);
});

void test('links to other schemes, bare URIs and escaped brackets are not references', () => {
	assert.deepEqual(
		findReferenceLinks(String.raw`[a](https://example.org) kadmos://oikos/a.md \[b](kadmos://oikos/b.md)`),
		[],
	);
});

void test('the text after the scheme is the query while a reference is typed', () => {
	const line = 'see [x](kadmos://oikos/sta';
	assert.deepEqual(referencePrefixAt(line, line.length), { start: 8, query: 'oikos/sta' });
	assert.equal(referencePrefixAt('[x](kadmos://oikos/a.md) more', 29), undefined);
	assert.equal(referencePrefixAt('nothing here', 5), undefined);
});
