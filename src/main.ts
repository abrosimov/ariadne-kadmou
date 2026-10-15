import { Plugin } from 'obsidian';
import { type KadmosVault, loadKadmosVault } from './vault.ts';

export default class AriadnePlugin extends Plugin {
	kadmos: KadmosVault = { kind: 'none' };
	private statusEl!: HTMLElement;

	override onload(): void {
		this.statusEl = this.addStatusBarItem();
		this.addCommand({
			id: 'reload-kadmos-vault',
			name: 'Reload kadmos vault',
			callback: () => void this.reload(),
		});
		this.app.workspace.onLayoutReady(() => void this.reload());
	}

	private async reload() {
		this.kadmos = await loadKadmosVault(this.app);
		this.renderStatus();
	}

	private renderStatus() {
		const kadmos = this.kadmos;
		this.statusEl.toggle(kadmos.kind !== 'none');
		if (kadmos.kind === 'vault') {
			this.statusEl.setText(`Kadmos: ${kadmos.path === '' ? '/' : kadmos.path} (${kadmos.profile})`);
			this.statusEl.setAttr('aria-label', 'Kadmos vault located by its markers');
		} else if (kadmos.kind === 'error') {
			this.statusEl.setText('Kadmos: error');
			this.statusEl.setAttr('aria-label', kadmos.reason);
		}
	}
}
