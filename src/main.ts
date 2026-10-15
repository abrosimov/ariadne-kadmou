import { debounce, Plugin, type TAbstractFile } from 'obsidian';
import type { AnchorSite } from './core/anchor-index.ts';
import { AnchorModal } from './obsidian/anchor-modal.ts';
import { openCode } from './obsidian/code-anchors.ts';
import { HOVER_SOURCE, LinkFollower } from './obsidian/links.ts';
import { Session } from './obsidian/session.ts';
import { DEFAULT_SETTINGS, type Settings, SettingsTab } from './obsidian/settings.ts';
import { ReferenceSuggest } from './obsidian/suggest.ts';
import { listen, onEveryWindow } from './obsidian/windows.ts';

export default class AriadnePlugin extends Plugin {
	settings: Settings = { ...DEFAULT_SETTINGS };
	session!: Session;

	override async onload(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<Settings> | null) };
		this.addSettingTab(
			new SettingsTab(this.app, this, this.settings, async () => {
				await this.saveData(this.settings);
			}),
		);
		const status = this.addStatusBarItem();
		status.addClass('ariadne-kadmou-status');
		status.toggle(false);
		const session = new Session(this.app, status);
		this.session = session;
		this.register(() => {
			session.close();
		});

		const open = (site: AnchorSite): void => {
			const anchors = session.index?.anchors;
			if (anchors !== undefined) openCode(anchors, site, this.settings.codeLinkTemplate);
		};
		this.addCommand({
			id: 'reload-kadmos-vault',
			name: 'Reload kadmos vault',
			callback: () => void session.reload(),
		});
		this.addCommand({
			id: 'rescan-code-anchors',
			name: 'Rescan code anchors',
			callback: () => void session.scan(),
		});
		this.addCommand({
			id: 'show-code-anchors',
			name: 'Show code anchors of this note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				const { index } = session;
				const path = file === null ? undefined : index?.notePath(file.path);
				if (index?.anchors === undefined || path === undefined) return false;
				if (!checking)
					new AnchorModal(this.app, index.anchors, { path, listed: index.anchoredBy(path) }, open).open();
				return true;
			},
		});

		const follower = new LinkFollower(this.app, () => session.index, open);
		this.registerHoverLinkSource(HOVER_SOURCE, { display: 'Ariadne kadmou', defaultMod: true });
		onEveryWindow(this, (doc, win) => {
			const removers = [
				listen(doc, 'click', (event) => follower.click(event), { capture: true }),
				listen(doc, 'mouseover', (event) => {
					follower.hover(event);
				}),
				listen(win, 'focus', () => {
					session.rescanIfStale();
				}),
			];
			return () => {
				for (const remove of removers) remove();
			};
		});
		this.registerMarkdownPostProcessor((element) => {
			session.postProcess(element);
		});
		this.registerEditorExtension(session.editorLinks.extension);
		this.registerEditorSuggest(new ReferenceSuggest(this.app, () => session.index));

		// A new, removed or moved note changes the index; an edited one only what its headings answer.
		const reindex = debounce(() => {
			session.reindex();
		}, 300);
		const refresh = debounce(() => {
			session.refresh();
		}, 300);
		this.registerEvent(this.app.vault.on('create', onNote(reindex)));
		this.registerEvent(this.app.vault.on('delete', onNote(reindex)));
		this.registerEvent(this.app.vault.on('rename', onNote(reindex)));
		this.registerEvent(this.app.metadataCache.on('changed', onNote(refresh)));

		this.app.workspace.onLayoutReady(() => void session.reload());
	}
}

function onNote(run: () => void): (file: TAbstractFile) => void {
	return (file) => {
		if (file.path.endsWith('.md')) run();
	};
}
