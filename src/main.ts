import { debounce, Plugin, type TAbstractFile } from 'obsidian';
import { EditorLinks } from './obsidian/editor.ts';
import { decorate, HOVER_SOURCE, LinkFollower } from './obsidian/links.ts';
import { NoteIndex } from './obsidian/note-index.ts';
import { ReferenceSuggest } from './obsidian/suggest.ts';
import { type KadmosVault, loadKadmosVault } from './obsidian/vault.ts';

export const STATUS_CLASS = 'ariadne-kadmou-status';
const REFERENCE_ANCHORS = 'a[href^="kadmos://"]';

export default class AriadnePlugin extends Plugin {
	kadmos: KadmosVault = { kind: 'none' };
	index: NoteIndex | undefined;
	private readonly editorLinks = new EditorLinks(() => this.index);
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

		const follower = new LinkFollower(this.app, () => this.index);
		this.registerHoverLinkSource(HOVER_SOURCE, { display: 'Ariadne kadmou', defaultMod: true });
		this.registerDomEvent(activeDocument, 'click', (event) => follower.click(event), { capture: true });
		this.registerDomEvent(activeDocument, 'mouseover', (event) => {
			follower.hover(event);
		});
		this.registerMarkdownPostProcessor((element) => {
			const index = this.index;
			if (index === undefined) return;
			decorateAll(element, index);
		});
		this.registerEditorExtension(this.editorLinks.extension);
		this.registerEditorSuggest(new ReferenceSuggest(this.app, () => this.index));

		const changed = debounce(() => {
			this.index?.invalidate();
			this.refresh();
		}, 300);
		const onFile = (file: TAbstractFile): void => {
			if (file.path.endsWith('.md')) changed();
		};
		this.registerEvent(this.app.vault.on('create', onFile));
		this.registerEvent(this.app.vault.on('delete', onFile));
		this.registerEvent(this.app.vault.on('rename', onFile));
		this.registerEvent(this.app.metadataCache.on('changed', onFile));

		this.app.workspace.onLayoutReady(() => void this.reload());
	}

	private async reload(): Promise<void> {
		this.kadmos = await loadKadmosVault(this.app);
		this.index =
			this.kadmos.kind === 'vault' ? new NoteIndex(this.app, this.kadmos.path, this.kadmos.contract) : undefined;
		this.renderStatus();
		this.refresh();
	}

	// Editors redraw their marks; rendered links are marked again in place,
	// since a rendered section is not processed again while its text stands.
	private refresh(): void {
		this.editorLinks.refresh();
		const index = this.index;
		if (index === undefined) return;
		this.app.workspace.iterateAllLeaves((leaf) => {
			decorateAll(leaf.view.containerEl, index);
		});
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

function decorateAll(container: HTMLElement, index: NoteIndex): void {
	for (const anchor of container.querySelectorAll<HTMLAnchorElement>(REFERENCE_ANCHORS)) {
		decorate(anchor, anchor.getAttribute('href') ?? '', index);
	}
}
