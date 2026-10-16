import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOpenable } from '../src/core/openable.ts';

void test('sources and data open, by their extension in any case', () => {
	for (const file of ['src/store.go', 'a/b/Model.TS', 'api/v1/store.proto', 'docs/x.md', 'config.yaml']) {
		assert.equal(isOpenable(file), true, file);
	}
});

void test('scripts, executables, pages and files without an extension do not', () => {
	for (const file of [
		'build.sh',
		'run.bat',
		'run.cmd',
		'setup.ps1',
		'tool.js',
		'tool.mjs',
		'main.py',
		'Start.command',
		'app.desktop',
		'index.html',
		'lib.jar',
		'data.csv',
		'book.xml',
		'build.gradle',
		'run.exs',
		'Makefile',
		'.go',
		'dir.go/script.sh',
	]) {
		assert.equal(isOpenable(file), false, file);
	}
});
