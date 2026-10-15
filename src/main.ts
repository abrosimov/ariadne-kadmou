import { debounce, Plugin, type TAbstractFile } from 'obsidian';
import type { AnchorSite } from './core/anchor-index.ts';
import { AnchorModal } from './obsidian/anchor-modal.ts';
import { openCode, scanCodeAnchors } from './obsidian/code-anchors.ts';
import { EditorLinks } from './obsidian/editor.ts';
import { KadmosIndex } from './obsidian/kadmos-index.ts';
import { decorate, HOVER_SOURCE, LinkFollower } from './obsidian/links.ts';
import { DEFAULT_SETTINGS, type Settings, SettingsTab } from './obsidian/settings.ts';
import { ReferenceSuggest } from './obsidian/suggest.ts';
import { type KadmosVault, loadKadmosVault } from './obsidian/vault.ts';

export const STATUS_CLASS = 'ariadne-kadmou-status';
const REFERENCE_ANCHORS = 'a[href^="kadmos://"]';
/** A return to the window rescans the code at most this often. */
const RESCAN_INTERVAL_MS = 2000;

export default class AriadnePlugin extends Plugin {
	kadmos: KadmosVault = { kind: 'none' };
	index: KadmosIndex | undefined;
	settings: Settings = { ...DEFAULT_SETTINGS };
	private readonly editorLinks = new EditorLinks(() => this.index);
	// Rendered before the first load finished; marked once it has. Undefined after it.
	private pending: HTMLElement[] | undefined = [];
	// Scans in flight and their order: only the latest one's result is kept.
	private readonly scans = { started: 0, running: 0, finishedAt: 0 };
	private statusEl!: HTMLElement;

	override async onload(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<Settings> | null) };
		this.addSettingTab(
			new SettingsTab(this.app, this, this.settings, async () => {
				await this.saveData(this.settings);
			}),
		);
		this.statusEl = this.addStatusBarItem();
		this.statusEl.addClass(STATUS_CLASS);
		this.statusEl.toggle(false);

		const open = (site: AnchorSite): void => {
			if (this.index?.anchors !== undefined) openCode(this.index.anchors, site, this.settings.codeLinkTemplate);
		};
		this.addCommand({ id: 'reload-kadmos-vault', name: 'Reload kadmos vault', callback: () => void this.reload() });
		this.addCommand({ id: 'rescan-code-anchors', name: 'Rescan code anchors', callback: () => void this.scan() });
		this.addCommand({
			id: 'show-code-anchors',
			name: 'Show code anchors of this note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				const anchors = this.index?.anchors;
				const path = file === null ? undefined : this.index?.notePath(file.path);
				if (anchors === undefined || path === undefined) return false;
				if (!checking)
					new AnchorModal(this.app, anchors, { path, listed: this.index?.anchoredBy(path) }, open).open();
				return true;
			},
		});

		const follower = new LinkFollower(this.app, () => this.index, open);
		this.registerHoverLinkSource(HOVER_SOURCE, { display: 'Ariadne kadmou', defaultMod: true });
		// Every window, the main one and each pop-out, follows links and rescans on focus.
		const listen = (doc: Document, win: Window): void => {
			this.registerDomEvent(doc, 'click', (event) => follower.click(event), { capture: true });
			this.registerDomEvent(doc, 'mouseover', (event) => {
				follower.hover(event);
			});
			// Code changes outside Obsidian; a return to the window picks them up.
			this.registerDomEvent(win, 'focus', () => {
				const { running, finishedAt } = this.scans;
				if (running === 0 && Date.now() - finishedAt > RESCAN_INTERVAL_MS) void this.scan();
			});
		};
		listen(activeDocument, activeWindow);
		this.registerEvent(
			this.app.workspace.on('window-open', ({ doc, win }) => {
				listen(doc, win);
			}),
		);
		this.registerMarkdownPostProcessor((element) => {
			if (this.index === undefined) this.pending?.push(element);
			else decorateAll(element, this.index);
		});
		this.registerEditorExtension(this.editorLinks.extension);
		this.registerEditorSuggest(new ReferenceSuggest(this.app, () => this.index));

		// A new, removed or moved note changes the index; an edited one only what its headings answer.
		const reindex = debounce(() => {
			this.index?.invalidate();
			this.refresh();
		}, 300);
		const remark = debounce(() => {
			this.refresh();
		}, 300);
		this.registerEvent(this.app.vault.on('create', onNote(reindex)));
		this.registerEvent(this.app.vault.on('delete', onNote(reindex)));
		this.registerEvent(this.app.vault.on('rename', onNote(reindex)));
		this.registerEvent(this.app.metadataCache.on('changed', onNote(remark)));

		this.app.workspace.onLayoutReady(() => void this.reload());
	}

	private async reload(): Promise<void> {
		this.kadmos = await loadKadmosVault(this.app);
		this.index =
			this.kadmos.kind === 'vault'
				? new KadmosIndex(this.app, this.kadmos.path, this.kadmos.contract)
				: undefined;
		const index = this.index;
		if (index !== undefined) for (const element of this.pending ?? []) decorateAll(element, index);
		this.pending = undefined;
		this.renderStatus();
		this.refresh();
		await this.scan();
	}

	private async scan(): Promise<void> {
		const index = this.index;
		if (index === undefined) return;
		const run = ++this.scans.started;
		this.scans.running++;
		const result = await scanCodeAnchors(this.app, index.root, index.contract).catch(
			(error: unknown) => `Code anchors could not be scanned: ${String(error)}`,
		);
		this.scans.running--;
		// A later scan, or another vault, has superseded this one.
		if (run !== this.scans.started || index !== this.index) return;
		this.scans.finishedAt = Date.now();
		index.scan = result;
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
		this.statusEl.toggle(kadmos.kind !== 'none');
		if (kadmos.kind === 'error') {
			this.statusEl.setText('Kadmos: error');
			this.statusEl.setAttr('aria-label', kadmos.reason);
		} else if (kadmos.kind === 'vault') {
			const anchors = this.index?.anchors?.index;
			const count = anchors === undefined ? undefined : [...anchors.sites.values()].flat().length;
			const problems = anchors?.problems.map(({ file, line, reason }) => `\n${file}:${line} ${reason}`).join('');
			const summary = count === undefined ? '' : `; ${count} code anchors${problems ?? ''}`;
			if (count === undefined) delete this.statusEl.dataset['anchors'];
			else this.statusEl.dataset['anchors'] = String(count);
			this.statusEl.setText(`Kadmos: ${kadmos.path === '' ? '/' : kadmos.path} (${kadmos.profile})`);
			this.statusEl.setAttr('aria-label', `Kadmos vault located by its markers${summary}`);
		}
	}
}

function decorateAll(container: HTMLElement, index: KadmosIndex): void {
	for (const anchor of container.querySelectorAll<HTMLAnchorElement>(REFERENCE_ANCHORS)) {
		decorate(anchor, anchor.getAttribute('href') ?? '', index);
	}
}

function onNote(run: () => void): (file: TAbstractFile) => void {
	return (file) => {
		if (file.path.endsWith('.md')) run();
	};
}
