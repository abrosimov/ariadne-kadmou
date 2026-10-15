import { $, $$, browser, expect } from '@wdio/globals';
import type { WorkspaceLeaf } from 'obsidian';
import { obsidianPage } from 'wdio-obsidian-service';
import { ACTIVE, activeFile, captureWindowOpen, clickLink, link, open, recorded, statuses } from '../support.ts';

const SOURCE = 'docs/decisions/source.md';
const EXPECTED: Record<string, string> = {
	resolved: 'resolved',
	heading: 'resolved',
	stale: 'stale',
	renamed: 'renamed',
	missing: 'missing',
	'missing heading': 'missing',
	invalid: 'invalid',
	foreign: 'foreign',
	anchor: 'missing',
};

async function renameHeading(from: string, to: string): Promise<void> {
	await browser.executeObsidian(
		async ({ app, obsidian }, before, after) => {
			const file = app.vault.getAbstractFileByPath('docs/standards/target.md');
			if (file instanceof obsidian.TFile) await app.vault.process(file, (text) => text.replace(before, after));
		},
		from,
		to,
	);
}

async function headingLinkIs(status: string): Promise<void> {
	await browser.waitUntil(async () => {
		const marks = await statuses(`${ACTIVE} .markdown-reading-view a[data-kadmos-status]`);
		return marks['heading'] === status;
	});
}

describe('kadmos:// navigation', () => {
	before(async () => {
		await browser.reloadObsidian({ vault: 'test/e2e/vaults/navigation' });
		// Nothing a test clicks may leave the app as an external link.
		await captureWindowOpen();
	});

	afterEach(async () => {
		expect(await recorded('opened')).toEqual([]);
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

	describe('when a heading changes', () => {
		it('marks a link to a renamed heading missing, and resolved once it is back', async () => {
			await open(SOURCE, 'reading');
			await renameHeading('## Section A', '## Section B');
			await headingLinkIs('missing');
			await renameHeading('## Section B', '## Section A');
			await headingLinkIs('resolved');
		});
	});

	describe('in a pop-out window', () => {
		for (const [name, reloadPlugin] of [
			['opened after the plugin loaded', false],
			['already open when the plugin loads', true],
		] as const) {
			it(`follows a link in a window ${name}`, async () => {
				const main = await browser.getWindowHandle();
				await browser.executeObsidian(async ({ app, obsidian }, file) => {
					const target = app.vault.getAbstractFileByPath(file);
					if (!(target instanceof obsidian.TFile)) throw new Error(`no file ${file}`);
					await app.workspace.openPopoutLeaf().openFile(target, { state: { mode: 'preview' } });
				}, SOURCE);
				if (reloadPlugin) {
					await obsidianPage.disablePlugin('ariadne-kadmou');
					await obsidianPage.enablePlugin('ariadne-kadmou');
				}
				// Live preview renders in an unfocused pop-out; reading view may wait for focus.
				await browser.executeObsidian(async ({ app }) => {
					const leaves: WorkspaceLeaf[] = [];
					app.workspace.iterateAllLeaves((leaf) => {
						if (leaf.getContainer() !== app.workspace.rootSplit) leaves.push(leaf);
					});
					for (const leaf of leaves) {
						await leaf.setViewState({
							...leaf.getViewState(),
							state: { ...leaf.getViewState().state, mode: 'source', source: false },
						});
					}
				});
				let popout = main;
				await browser.waitUntil(async () => {
					const handles = await browser.getWindowHandles();
					popout = handles.find((handle) => handle !== main) ?? main;
					return popout !== main;
				});
				await browser.switchToWindow(popout);
				try {
					await clickLink('.cm-content', 'resolved', '.workspace-leaf');
					await browser.waitUntil(async () => (await activeFile()) === 'docs/standards/target.md');
				} finally {
					await browser.closeWindow();
					await browser.switchToWindow(main);
				}
			});
		}
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
