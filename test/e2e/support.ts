import { $, $$, browser } from '@wdio/globals';

export const ACTIVE = '.workspace-leaf.mod-active';

export type Mode = 'reading' | 'live-preview' | 'source';

export async function open(path: string, mode: Mode): Promise<void> {
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
	const container = mode === 'reading' ? '.markdown-reading-view' : '.markdown-source-view';
	await $(`${ACTIVE} ${container} [data-kadmos-status]`).waitForExist();
}

/** The marked link with this text in the active leaf. */
export async function link(container: string, text: string): Promise<WebdriverIO.Element> {
	for (const element of await $$(`${ACTIVE} ${container} [data-kadmos-status]`).getElements()) {
		if ((await element.getText()) === text) return element;
	}
	throw new Error(`no link "${text}" in ${container}`);
}

export async function clickLink(container: string, text: string): Promise<void> {
	const element = await link(container, text);
	await element.click();
}

export async function activeFile(): Promise<string | undefined> {
	return await browser.executeObsidian(({ app }) => app.workspace.getActiveFile()?.path);
}

/** What a spy installed in the page recorded under a name. */
export async function recorded(name: string): Promise<string[]> {
	return await browser.execute((key) => (window as unknown as Record<string, string[] | undefined>)[key] ?? [], name);
}

export async function statuses(selector: string): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	for (const element of await $$(selector).getElements()) {
		const status = await element.getAttribute('data-kadmos-status');
		if (status !== null) result[await element.getText()] = status;
	}
	return result;
}

/** Records every window.open in the page instead of leaving the app; read with `recorded('opened')`. */
export async function captureWindowOpen(): Promise<void> {
	await browser.execute(() => {
		const opened: string[] = [];
		Object.assign(window, { opened });
		window.open = (url?: string | URL) => {
			opened.push(String(url));
			return null;
		};
	});
}
