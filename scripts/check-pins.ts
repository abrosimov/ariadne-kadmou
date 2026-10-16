// Checks every digest in pins.env against what its publisher states for the
// pinned version, and names each one that differs with the value it should
// be. Run by `task pins`; online by nature.
import { readFileSync } from 'node:fs';

const PLATFORMS = [
	['darwin', 'arm64'],
	['darwin', 'amd64'],
	['linux', 'arm64'],
	['linux', 'amd64'],
] as const;

const pins = new Map(
	readFileSync(new URL('../pins.env', import.meta.url), 'utf8')
		.split('\n')
		.filter((line) => line !== '' && !line.startsWith('#'))
		.map((line) => line.split('=', 2) as [string, string]),
);

function pin(key: string): string {
	const value = pins.get(key);
	if (value === undefined || value === '') throw new Error(`pins.env declares no ${key}`);
	return value;
}

// A checksum manifest as `<sha256>  <file name>` lines, by file name.
async function manifest(url: string): Promise<Map<string, string>> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${url}: HTTP ${String(response.status)}`);
	const text = await response.text();
	return new Map(
		text.split('\n').map((line) => {
			const [digest = '', file = ''] = line.trim().split(/\s+/u);
			return [file, digest];
		}),
	);
}

const node = pin('NODE_VERSION');
const task = pin('TASK_VERSION');
const published = {
	node: await manifest(`https://nodejs.org/dist/${node}/SHASUMS256.txt`),
	task: await manifest(`https://github.com/go-task/task/releases/download/${task}/task_checksums.txt`),
};

const wrong: string[] = [];
for (const [os, arch] of PLATFORMS) {
	const checks = [
		[
			`NODE_SHA256_${os}_${arch}`,
			published.node.get(`node-${node}-${os}-${arch === 'amd64' ? 'x64' : arch}.tar.gz`),
		],
		[`TASK_SHA256_${os}_${arch}`, published.task.get(`task_${os}_${arch}.tar.gz`)],
	] as const;
	for (const [key, expected] of checks) {
		if (expected === undefined) wrong.push(`${key}: the publisher states no digest`);
		else if (pins.get(key) !== expected) wrong.push(`${key}=${expected}`);
	}
}

if (wrong.length > 0) {
	console.error(`pins.env disagrees with the publishers; set:\n${wrong.join('\n')}`);
	process.exitCode = 1;
} else {
	console.log(`pins.env: ${String(PLATFORMS.length * 2)} digests match Node ${node} and Task ${task}`);
}
