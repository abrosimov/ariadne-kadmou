import { $, $$, browser, expect } from '@wdio/globals';

const SOURCE = 'docs/decisions/source.md';
const ACTIVE = '.workspace-leaf.mod-active';

type Mode = 'reading' | 'live-preview' | 'source';

async function open(path: string, mode: Mode): Promise<void> {
	await browser.executeObsidian(
		async ({ app, obsidian }, file, viewMode) => {
			const target = app.vault.getAbstractFileByPath(file);
			if (!(target instanceof obsidian.TFile)) throw new Error(`no file ${file}`);
			const leaf = app.workspace.getLeaf(false);
			await leaf.setViewState({
				type: 'markdown',
				active: true,
				state: { file, mode: viewMode === 'reading' ? 'preview' : 'source', source: viewMode === 'source' },
			});
			app.workspace.setActiveLeaf(leaf, { focus: true });
		},
		path,
		mode,
	);
	await browser.waitUntil(async () => (await activeFile()) === path, { timeoutMsg: `${path} did not open` });
	// Two Obsidian instances render side by side in CI; give a slow render time.
	const container = mode === 'reading' ? '.markdown-reading-view' : '.markdown-source-view';
	await $(`${ACTIVE} ${container} [data-kadmos-status]`).waitForExist({ timeout: 15_000 });
}

/** The marked link with this text in the active leaf. */
async function link(container: string, text: string): Promise<WebdriverIO.Element> {
	for (const element of await $$(`${ACTIVE} ${container} [data-kadmos-status]`).getElements()) {
		if ((await element.getText()) === text) return element;
	}
	throw new Error(`no link "${text}" in ${container}`);
}

async function clickLink(container: string, text: string): Promise<void> {
	const element = await link(container, text);
	await element.click();
}

async function activeFile(): Promise<string | undefined> {
	return await browser.executeObsidian(({ app }) => app.workspace.getActiveFile()?.path);
}

/** What a spy installed in the page recorded under a name. */
async function recorded(name: string): Promise<string[]> {
	return await browser.execute((key) => (window as unknown as Record<string, string[] | undefined>)[key] ?? [], name);
}

async function statuses(selector: string): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	for (const element of await $$(selector).getElements()) {
		const status = await element.getAttribute('data-kadmos-status');
		if (status !== null) result[await element.getText()] = status;
	}
	return result;
}

const EXPECTED: Record<string, string> = {
	resolved: 'resolved',
	heading: 'resolved',
	stale: 'stale',
	renamed: 'renamed',
	missing: 'missing',
	'missing heading': 'missing',
	invalid: 'invalid',
	foreign: 'foreign',
	anchor: 'unchecked',
};

describe('kadmos:// navigation', () => {
	before(async () => {
		await browser.reloadObsidian({ vault: 'test/e2e/vaults/navigation' });
		// Nothing a test clicks may leave the app as an external link.
		await browser.execute(() => {
			const opened: string[] = [];
			Object.assign(window, { ariadneOpened: opened });
			window.open = (url?: string | URL) => {
				opened.push(String(url));
				return null;
			};
		});
	});

	afterEach(async () => {
		expect(await recorded('ariadneOpened')).toEqual([]);
	});

	describe('reading view', () => {
		it('marks every reference with its resolution', async () => {
			await open(SOURCE, 'reading');
			expect(await statuses(`${ACTIVE} .markdown-reading-view a[data-kadmos-status]`)).toEqual(EXPECTED);
		});

		it('explains a status on the link', async () => {
			await open(SOURCE, 'reading');
			const stale = await link('.markdown-reading-view', 'stale');
			expect(await stale.getAttribute('aria-label')).toContain('archive/decisions/old.md');
		});

		for (const [text, target] of [
			['resolved', 'docs/standards/target.md'],
			['heading', 'docs/standards/target.md'],
			['stale', 'docs/archive/decisions/old.md'],
			['renamed', 'docs/notes/moved/renamed.md'],
		] as const) {
			it(`follows "${text}" to ${target}`, async () => {
				await open(SOURCE, 'reading');
				await clickLink('.markdown-reading-view', text);
				await browser.waitUntil(async () => (await activeFile()) === target, {
					timeoutMsg: `"${text}" did not open ${target}`,
				});
			});
		}

		it('stays and says why when the target is missing', async () => {
			await open(SOURCE, 'reading');
			await clickLink('.markdown-reading-view', 'missing');
			await expect($('.notice')).toHaveText(expect.stringContaining('Missing: no note at standards/absent.md'));
			expect(await activeFile()).toBe(SOURCE);
		});

		it('offers the target to the page preview on hover', async () => {
			await open(SOURCE, 'reading');
			await browser.executeObsidian(({ app }) => {
				const seen: string[] = [];
				Object.assign(window, { ariadneHovered: seen });
				const workspace = app.workspace;
				const trigger = workspace.trigger.bind(workspace);
				workspace.trigger = (name: string, ...data: unknown[]) => {
					const [info] = data as [{ source?: string; linktext?: string } | undefined];
					if (name === 'hover-link' && info?.source === 'ariadne-kadmou') seen.push(info.linktext ?? '');
					trigger(name, ...data);
				};
			});
			const heading = await link('.markdown-reading-view', 'heading');
			await heading.moveTo();
			await browser.waitUntil(async () => {
				const hovered = await recorded('ariadneHovered');
				return hovered.includes('docs/standards/target.md#Section A');
			});
		});
	});

	describe('when the vault changes', () => {
		it('follows its target appearing and moving away, in both views', async () => {
			await browser.executeObsidian(async ({ app }) => {
				await app.vault.create('docs/standards/absent.md', '# Absent\n\nNo longer.\n');
			});
			await open(SOURCE, 'reading');
			await browser.waitUntil(async () => {
				const marks = await statuses(`${ACTIVE} .markdown-reading-view a[data-kadmos-status]`);
				return marks['missing'] === 'resolved';
			});
			await open(SOURCE, 'live-preview');
			await browser.waitUntil(async () => {
				const marks = await statuses(`${ACTIVE} .cm-content [data-kadmos-status]`);
				return marks['missing'] === 'resolved';
			});
			await browser.executeObsidian(async ({ app, obsidian }) => {
				const file = app.vault.getAbstractFileByPath('docs/standards/absent.md');
				if (file instanceof obsidian.TFile) await app.fileManager.renameFile(file, 'docs/standards/present.md');
			});
			await browser.waitUntil(async () => {
				const marks = await statuses(`${ACTIVE} .cm-content [data-kadmos-status]`);
				return marks['missing'] === 'missing';
			});
			await open(SOURCE, 'reading');
			await browser.waitUntil(async () => {
				const marks = await statuses(`${ACTIVE} .markdown-reading-view a[data-kadmos-status]`);
				return marks['missing'] === 'missing';
			});
		});
	});

	describe('live preview', () => {
		it('marks every reference with its resolution, and none in code', async () => {
			await open(SOURCE, 'live-preview');
			const marks = await statuses(`${ACTIVE} .cm-content [data-kadmos-status]`);
			for (const [text, status] of Object.entries(EXPECTED)) expect(marks[text]).toBe(status);
			expect(marks['in code']).toBeUndefined();
		});

		it('follows a rendered link on a click', async () => {
			await open(SOURCE, 'live-preview');
			await clickLink('.cm-content', 'resolved');
			await browser.waitUntil(async () => (await activeFile()) === 'docs/standards/target.md');
		});
	});

	describe('completion', () => {
		it('completes a path after kadmos://oikos/', async () => {
			await open(SOURCE, 'source');
			await browser.executeObsidian(({ app, obsidian }) => {
				const editor = app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.editor;
				if (editor === undefined) throw new Error('no editor');
				const last = editor.lastLine();
				editor.replaceRange('\n', { line: last, ch: editor.getLine(last).length });
				editor.setCursor({ line: last + 1, ch: 0 });
				editor.focus();
			});
			await browser.keys('[x](kadmos://oikos/targ');
			const item = $('.suggestion-container .suggestion-item');
			await item.waitForExist();
			// A change to the vault re-marks the links; it must not close the open suggestion.
			await browser.executeObsidian(async ({ app }) => {
				await app.vault.create('docs/standards/unrelated.md', '# Unrelated\n');
			});
			await browser.pause(1000);
			await expect(item).toExist();
			const labels: string[] = [];
			for (const element of await $$('.suggestion-container .suggestion-item').getElements()) {
				labels.push(await element.getText());
			}
			expect(labels).toEqual(['standards/target.md']);
			await browser.keys(['Enter']);
			const line = await browser.executeObsidian(({ app, obsidian }) => {
				const editor = app.workspace.getActiveViewOfType(obsidian.MarkdownView)?.editor;
				return editor?.getLine(editor.getCursor().line);
			});
			// Obsidian closes the parenthesis as it is typed.
			expect(line).toBe('[x](kadmos://oikos/standards/target.md)');
		});
	});
});
