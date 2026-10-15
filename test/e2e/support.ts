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

/** The marked link with this text in `container` of the active leaf, once it is there. */
export async function link(container: string, text: string, leaf = ACTIVE): Promise<WebdriverIO.Element> {
	let found: WebdriverIO.Element | undefined;
	await browser.waitUntil(
		async () => {
			for (const element of await $$(`${leaf} ${container} [data-kadmos-status]`).getElements()) {
				if ((await element.getText()) === text) found = element;
			}
			return found !== undefined;
		},
		{ timeoutMsg: `no link "${text}" in ${container}` },
	);
	if (found === undefined) throw new Error(`no link "${text}" in ${container}`);
	return found;
}

export async function clickLink(container: string, text: string, leaf = ACTIVE): Promise<void> {
	const element = await link(container, text, leaf);
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

/**
 * Records every window.open that would leave the app instead of opening it;
 * read with `recorded('opened')`. Obsidian's own pop-out windows still open.
 */
export async function captureWindowOpen(): Promise<void> {
	await browser.execute(() => {
		const opened: string[] = [];
		const original = window.open.bind(window);
		Object.assign(window, { opened });
		window.open = (url?: string | URL, ...rest: [string?, string?]) => {
			const address = String(url ?? '');
			if (address === '' || address.startsWith('about:')) return original(url, ...rest);
			opened.push(address);
			return null;
		};
	});
}
