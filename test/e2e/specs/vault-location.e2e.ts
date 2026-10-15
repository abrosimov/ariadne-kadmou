import { $, browser, expect } from '@wdio/globals';

const STATUS = '.status-bar .ariadne-kadmou-status';

async function openVault(name: string): Promise<void> {
	await browser.reloadObsidian({ vault: `test/e2e/vaults/${name}` });
}

async function status(): Promise<{ state: string | null; text: string; reason: string | null }> {
	const element = $(STATUS);
	await element.waitUntil(async () => (await element.getAttribute('data-kadmos')) !== null, {
		timeoutMsg: 'the plugin did not report a kadmos state',
	});
	return {
		state: await element.getAttribute('data-kadmos'),
		text: await element.getText(),
		reason: await element.getAttribute('aria-label'),
	};
}

describe('locating the kadmos vault', () => {
	it('follows .vault-root to the child it names', async () => {
		await openVault('nested');
		expect(await status()).toEqual({
			state: 'vault',
			text: 'Kadmos: docs (instance)',
			reason: 'Kadmos vault located by its markers',
		});
	});

	it('takes the opened folder when it carries .vault-profile', async () => {
		await openVault('root');
		const { state, text } = await status();
		expect(state).toBe('vault');
		expect(text).toBe('Kadmos: / (scaffold)');
	});

	it('stays idle without markers', async () => {
		await openVault('none');
		const { state } = await status();
		expect(state).toBe('none');
		await expect($(STATUS)).not.toBeDisplayed();
	});

	it('does not select a child by its own marker', async () => {
		await openVault('unnamed-child');
		const { state } = await status();
		expect(state).toBe('none');
	});

	it('reports both root markers as an error', async () => {
		await openVault('both');
		const { state, text, reason } = await status();
		expect(state).toBe('error');
		expect(text).toBe('Kadmos: error');
		expect(reason).toContain('mutually exclusive');
	});

	it('reports a schema it cannot read as an error', async () => {
		await openVault('bad-schema');
		const { state, reason } = await status();
		expect(state).toBe('error');
		expect(reason).toContain('.vault-schema.txtpb');
	});

	it('picks up a marker written after load on reload', async () => {
		await openVault('none');
		await browser.executeObsidian(async ({ app }) => {
			await app.vault.adapter.write('.vault-profile', 'scaffold\n');
			await app.vault.adapter.write(
				'.vault-schema.txtpb',
				'config { retention_projection { root_directory: "archive" } }\n',
			);
		});
		await browser.executeObsidianCommand('ariadne-kadmou:reload-kadmos-vault');
		const element = $(STATUS);
		await element.waitUntil(async () => (await element.getAttribute('data-kadmos')) === 'vault');
		expect(await element.getText()).toBe('Kadmos: / (scaffold)');
	});
});
