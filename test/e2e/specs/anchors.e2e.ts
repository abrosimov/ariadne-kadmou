import { cp, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { $, $$, browser, expect } from '@wdio/globals';
import { captureWindowOpen, clickLink, open, recorded, statuses } from '../support.ts';

const FIXTURE = 'test/e2e/vaults/anchors';
const NOTE = 'docs/decisions/put.md';
const STATUS = '.status-bar .ariadne-kadmou-status';

async function anchorCount(): Promise<string | null> {
	return await $(STATUS).getAttribute('data-anchors');
}

describe('code anchors', () => {
	describe('with Obsidian opened at the repository root', () => {
		before(async () => {
			await browser.reloadObsidian({ vault: FIXTURE });
			await captureWindowOpen();
		});

		it('counts the declarations and reports a malformed one', async () => {
			await browser.waitUntil(async () => (await anchorCount()) === '4');
			expect(await $(STATUS).getAttribute('aria-label')).toContain(
				'src/store.go:9 "realises" is not a declared relation',
			);
		});

		it('marks anchor links by what the scan found', async () => {
			await open(NOTE, 'reading');
			expect(await statuses('.workspace-leaf.mod-active .markdown-reading-view a[data-kadmos-status]')).toEqual({
				'put anchor': 'resolved',
				'absent anchor': 'missing',
				'twice anchor': 'invalid',
				'script anchor': 'resolved',
			});
		});

		it('opens an allowed file type with the default application, and nothing else', async () => {
			await browser.executeObsidian(({ require }) => {
				const opened: string[] = [];
				Object.assign(window, { openedPaths: opened });
				const electron = require('electron') as { shell: { openPath: (path: string) => Promise<string> } };
				const original = electron.shell.openPath;
				Object.assign(window, { restoreOpenPath: () => (electron.shell.openPath = original) });
				electron.shell.openPath = async (file) => {
					opened.push(file);
					return await Promise.resolve('');
				};
			});
			await open(NOTE, 'reading');
			await clickLink('.markdown-reading-view', 'script anchor');
			await clickLink('.markdown-reading-view', 'put anchor');
			let opened: string[] = [];
			await browser.waitUntil(async () => {
				opened = await recorded('openedPaths');
				return opened.length === 1;
			});
			// The shell script, clicked first, was not opened.
			expect(opened).toHaveLength(1);
			expect(opened[0]).toMatch(/[/\\]src[/\\]store\.go$/u);
			await browser.execute(() => {
				(window as unknown as { restoreOpenPath: () => void }).restoreOpenPath();
			});
		});

		it('lists the anchors of a note with what is wrong in anchored_by', async () => {
			await open(NOTE, 'reading');
			await browser.executeObsidianCommand('ariadne-kadmou:show-code-anchors');
			const items = await $$('.prompt .suggestion-item').getElements();
			const labels: string[] = [];
			for (const item of items) labels.push(await item.getText());
			expect(labels).toEqual([
				'"ghost" is listed but declared nowhere',
				'"build-script" names this note but is not listed',
				'"twice" names this note but is not listed',
				'build-script · implements · scripts/build.sh:2',
				'store-put · implements · src/store.go:3',
				'twice · implements · src/store.go:6',
				'twice · tests · test/store_test.go:3',
			]);
			await browser.keys(['Escape']);
		});

		it('rescans when the window regains focus', async () => {
			await browser.executeObsidian(async ({ app }) => {
				await app.vault.adapter.append(
					'src/store.go',
					'\n// ariadne-kadmou[absent|implements|kadmos://oikos/decisions/put.md]\n',
				);
			});
			await browser.pause(2100);
			await browser.execute(() => window.dispatchEvent(new Event('focus')));
			await browser.waitUntil(async () => (await anchorCount()) === '5');
			await open(NOTE, 'reading');
			await browser.waitUntil(async () => {
				const marks = await statuses('.workspace-leaf.mod-active .markdown-reading-view a[data-kadmos-status]');
				return marks['absent anchor'] === 'resolved';
			});
		});
	});

	describe('with Obsidian opened at the vault', () => {
		it('reads nothing outside the opened folder and says why anchors are unchecked', async () => {
			const repository = path.join(await mkdtemp(path.join(os.tmpdir(), 'ariadne-')), 'repo');
			await cp(FIXTURE, repository, { recursive: true });
			await browser.reloadObsidian({ vault: path.join(repository, 'docs'), copy: false });
			await browser.waitUntil(async () => (await $(STATUS).getText()) === 'Kadmos: / (instance)');
			expect(await anchorCount()).toBeNull();
			await open('decisions/put.md', 'reading');
			const marks = await statuses('.workspace-leaf.mod-active .markdown-reading-view a[data-kadmos-status]');
			expect(marks['put anchor']).toBe('unchecked');
		});
	});
});
