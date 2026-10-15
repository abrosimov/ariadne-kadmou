import path from 'node:path';
import type { Capabilities, Options } from '@wdio/types';
import type { ObsidianCapabilityOptions } from 'wdio-obsidian-service';

const cacheDir = path.resolve('.obsidian-cache');

// The plugin's minAppVersion on the oldest installer that runs it, and the
// latest release on the latest installer.
const versions: readonly (readonly [app: string, installer: string])[] = [
	['earliest', 'earliest'],
	['latest', 'latest'],
];

export const config: Options.Testrunner & Capabilities.WithRequestedTestrunnerCapabilities = {
	runner: 'local',
	framework: 'mocha',
	specs: ['./test/e2e/specs/**/*.e2e.ts'],
	maxInstances: 2,
	capabilities: versions.map(([app, installer]) => ({
		browserName: 'obsidian',
		browserVersion: app,
		'wdio:obsidianOptions': {
			installerVersion: installer,
			plugins: ['.'],
		} satisfies ObsidianCapabilityOptions,
	})),
	services: ['obsidian'],
	reporters: ['obsidian'],
	cacheDir,
	mochaOpts: {
		ui: 'bdd',
		timeout: 60_000,
	},
	logLevel: 'warn',
};
