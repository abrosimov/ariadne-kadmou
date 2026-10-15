import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Latest } from '../src/core/latest.ts';

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	const settle: { resolve?: (value: T) => void } = {};
	const promise = new Promise<T>((done) => {
		settle.resolve = done;
	});
	return { promise, resolve: (value) => settle.resolve?.(value) };
}

void test('an earlier run that finishes last is dropped', async () => {
	const latest = new Latest();
	const older = deferred<string>();
	const newer = deferred<string>();
	const first = latest.run(async () => await older.promise);
	const second = latest.run(async () => await newer.promise);
	assert.equal(latest.busy, true);
	newer.resolve('new');
	older.resolve('old');
	assert.deepEqual(await second, { value: 'new' });
	assert.equal(await first, undefined);
	assert.equal(latest.busy, false);
});

void test('cancel drops a run in flight, and a failed run still ends', async () => {
	const latest = new Latest();
	const pending = deferred<number>();
	const run = latest.run(async () => await pending.promise);
	latest.cancel();
	pending.resolve(1);
	assert.equal(await run, undefined);
	await assert.rejects(latest.run(async () => await Promise.reject(new Error('failed'))));
	assert.equal(latest.busy, false);
});
