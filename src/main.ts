import { Plugin } from 'obsidian';
import { type KadmosVault, loadKadmosVault } from './vault.ts';

export const STATUS_CLASS = 'ariadne-kadmou-status';

export default class AriadnePlugin extends Plugin {
	kadmos: KadmosVault = { kind: 'none' };
	private statusEl!: HTMLElement;

	override onload(): void {
		this.statusEl = this.addStatusBarItem();
		this.statusEl.addClass(STATUS_CLASS);
		this.statusEl.toggle(false);
		this.addCommand({
			id: 'reload-kadmos-vault',
			name: 'Reload kadmos vault',
			callback: () => void this.reload(),
		});
		this.app.workspace.onLayoutReady(() => void this.reload());
	}

	private async reload(): Promise<void> {
		this.kadmos = await loadKadmosVault(this.app);
		this.renderStatus();
	}

	private renderStatus(): void {
		const kadmos = this.kadmos;
		this.statusEl.dataset['kadmos'] = kadmos.kind;
		switch (kadmos.kind) {
			case 'none': {
				this.statusEl.toggle(false);
				break;
			}
			case 'vault': {
				this.statusEl.toggle(true);
				this.statusEl.setText(`Kadmos: ${kadmos.path === '' ? '/' : kadmos.path} (${kadmos.profile})`);
				this.statusEl.setAttr('aria-label', 'Kadmos vault located by its markers');
				break;
			}
			case 'error': {
				this.statusEl.toggle(true);
				this.statusEl.setText('Kadmos: error');
				this.statusEl.setAttr('aria-label', kadmos.reason);
				break;
			}
		}
	}
}
