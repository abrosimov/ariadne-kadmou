import assert from 'node:assert/strict';
import { test } from 'node:test';
import { messages, onlyMessage, onlyString, parseTextproto, strings, TextprotoError } from '../src/core/textproto.ts';

void test('scalars, nested messages, separators and comments are read', () => {
	const message = parseTextproto(String.raw`
		# a comment
		name: "a" 'b'   # adjacent strings concatenate
		count: -1.5e2; flag: true, off: false
		kind: ENUM_VALUE
		child { leaf: "x\t\"y\"" }
		other: < leaf: "z" >
	`);
	assert.deepEqual(message.fields.get('name'), ['ab']);
	assert.deepEqual(message.fields.get('count'), [-150]);
	assert.deepEqual(message.fields.get('flag'), [true]);
	assert.deepEqual(message.fields.get('off'), [false]);
	assert.equal(onlyString(message, 'kind'), 'ENUM_VALUE');
	const child = onlyMessage(message, 'child');
	assert.ok(child !== undefined);
	assert.equal(onlyString(child, 'leaf'), 'x\t"y"');
	assert.deepEqual(strings(messages(message, 'other')[0] ?? message, 'leaf'), ['z']);
});

for (const [name, source] of [
	['an unterminated string', 'a: "x'],
	['a string broken by a newline', 'a: "x\n"'],
	['an unsupported escape', String.raw`a: "\q"`],
	['an unexpected character', 'a: @'],
	['a number that is not one', 'a: 1.2.3'],
	['a missing value', 'a:'],
	['a value where a name belongs', '"a": 1'],
	['punctuation as a value', 'a: }'],
	['an unclosed message', 'a { b: 1'],
] as const) {
	void test(`${name} is an error`, () => {
		assert.throws(() => parseTextproto(source), TextprotoError);
	});
}

void test('typed readers reject a field of another kind or set twice', () => {
	const message = parseTextproto('n: 1 m { } s: "a" s: "b"');
	assert.throws(() => strings(message, 'n'), TextprotoError);
	assert.throws(() => messages(message, 'n'), TextprotoError);
	assert.throws(() => onlyString(message, 's'), TextprotoError);
	assert.throws(() => onlyMessage(parseTextproto('m {} m {}'), 'm'), TextprotoError);
});
