// Listeners for every Obsidian window: the main one, pop-outs open when the
// plugin loads, and pop-outs opened later. A closed pop-out releases its own.

import type { Plugin } from 'obsidian';

/** `attach` adds listeners to a window and returns what removes them. */
export function onEveryWindow(plugin: Plugin, attach: (doc: Document, win: Window) => () => void): void {
	const { workspace } = plugin.app;
	const detach = new Map<Window, () => void>();
	const add = (doc: Document, win: Window): void => {
		if (!detach.has(win)) detach.set(win, attach(doc, win));
	};
	add(activeDocument, activeWindow);
	workspace.onLayoutReady(() => {
		workspace.iterateAllLeaves((leaf) => {
			const { doc, win } = leaf.getContainer();
			add(doc, win);
		});
	});
	plugin.registerEvent(
		workspace.on('window-open', ({ doc, win }) => {
			add(doc, win);
		}),
	);
	plugin.registerEvent(
		workspace.on('window-close', ({ win }) => {
			detach.get(win)?.();
			detach.delete(win);
		}),
	);
	plugin.register(() => {
		for (const remove of detach.values()) remove();
		detach.clear();
	});
}

/** Adds a listener and returns what removes it. */
export function listen<K extends keyof WindowEventMap & keyof DocumentEventMap>(
	target: Document | Window,
	type: K,
	listener: (event: DocumentEventMap[K]) => void,
	options?: AddEventListenerOptions,
): () => void {
	const handler = listener as EventListener;
	target.addEventListener(type, handler, options);
	return () => {
		target.removeEventListener(type, handler, options);
	};
}
