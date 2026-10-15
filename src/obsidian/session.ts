// The open kadmos vault as the plugin sees it: where it is, its index, the
// code scan, and the marks and status that show them.

import type { App } from 'obsidian';
import { Latest } from '../core/latest.ts';
import { scanCodeAnchors } from './code-anchors.ts';
import { EditorLinks } from './editor.ts';
import { KadmosIndex } from './kadmos-index.ts';
import { decorate } from './links.ts';
import { type KadmosVault, loadKadmosVault } from './vault.ts';

const REFERENCE_ANCHORS = 'a[href^="kadmos://"]';
/** A return to the window rescans the code at most this often. */
const RESCAN_INTERVAL_MS = 2000;

export class Session {
	kadmos: KadmosVault = { kind: 'none' };
	index: KadmosIndex | undefined;
	readonly editorLinks = new EditorLinks(() => this.index);

	private readonly app: App;
	private readonly status: HTMLElement;
	// Sections rendered before the first load finished, marked once it has: a
	// later refresh reaches only what is attached by then. Undefined after it.
	private pending: HTMLElement[] | undefined = [];
	private readonly loads = new Latest();
	private readonly scans = new Latest();
	private scannedAt = 0;

	constructor(app: App, status: HTMLElement) {
		this.app = app;
		this.status = status;
	}

	/** Marks the links of a rendered section. */
	postProcess(element: HTMLElement): void {
		if (this.index === undefined) this.pending?.push(element);
		else decorateAll(element, this.index);
	}

	async reload(): Promise<void> {
		const loaded = await this.loads.run(
			async () =>
				await loadKadmosVault(this.app).catch((error: unknown) => ({
					kind: 'error' as const,
					reason: `The kadmos vault could not be read: ${String(error)}`,
				})),
		);
		// A later reload, or the plugin's unload, has superseded this one.
		if (loaded === undefined) return;
		const kadmos = loaded.value;
		this.kadmos = kadmos;
		this.index = kadmos.kind === 'vault' ? new KadmosIndex(this.app, kadmos.path, kadmos.contract) : undefined;
		const index = this.index;
		if (index !== undefined) for (const element of this.pending ?? []) decorateAll(element, index);
		this.pending = undefined;
		this.render();
		await this.scan();
	}

	async scan(): Promise<void> {
		const index = this.index;
		if (index === undefined) return;
		const result = await this.scans.run(
			async () =>
				await scanCodeAnchors(this.app, index.root, index.contract, index.anchors?.cache).catch(
					(error: unknown) => `Code anchors could not be scanned: ${String(error)}`,
				),
		);
		// A later scan, another vault or the plugin's unload has superseded this one.
		if (result === undefined || index !== this.index) return;
		this.scannedAt = Date.now();
		index.scan = result.value;
		this.render();
	}

	/** Code changes outside Obsidian; a return to the window picks them up. */
	rescanIfStale(): void {
		if (!this.scans.busy && Date.now() - this.scannedAt > RESCAN_INTERVAL_MS) void this.scan();
	}

	/** A note was added, removed or moved: the index is rebuilt and the links marked again. */
	reindex(): void {
		this.index?.invalidate();
		this.refresh();
	}

	/**
	 * Marks the links of every editor and rendered view again; rendered links
	 * are marked in place, since a section is not processed again while its
	 * text stands.
	 */
	refresh(): void {
		this.editorLinks.refresh();
		this.app.workspace.iterateAllLeaves((leaf) => {
			decorateAll(leaf.view.containerEl, this.index);
		});
	}

	close(): void {
		this.loads.cancel();
		this.scans.cancel();
	}

	private render(): void {
		renderStatus(this.status, this.kadmos, this.index);
		this.refresh();
	}
}

function decorateAll(container: HTMLElement, index: KadmosIndex | undefined): void {
	for (const anchor of container.querySelectorAll<HTMLAnchorElement>(REFERENCE_ANCHORS)) {
		decorate(anchor, anchor.getAttribute('href') ?? '', index);
	}
}

function renderStatus(element: HTMLElement, kadmos: KadmosVault, index: KadmosIndex | undefined): void {
	element.dataset['kadmos'] = kadmos.kind;
	element.toggle(kadmos.kind !== 'none');
	if (kadmos.kind === 'error') {
		element.setText('Kadmos: error');
		element.setAttr('aria-label', kadmos.reason);
	} else if (kadmos.kind === 'vault') {
		const anchors = index?.anchors?.index;
		const count = anchors === undefined ? undefined : [...anchors.sites.values()].flat().length;
		const problems = anchors?.problems.map(({ file, line, reason }) => `\n${file}:${line} ${reason}`).join('');
		if (count === undefined) delete element.dataset['anchors'];
		else element.dataset['anchors'] = String(count);
		element.setText(`Kadmos: ${kadmos.path === '' ? '/' : kadmos.path} (${kadmos.profile})`);
		const summary = count === undefined ? '' : `; ${count} code anchors${problems ?? ''}`;
		element.setAttr('aria-label', `Kadmos vault located by its markers${summary}`);
	}
}
