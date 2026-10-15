// The part of Electron the plugin uses. Obsidian provides `electron` at run
// time on the desktop; the bundle leaves it external.
declare module 'electron' {
	export const shell: {
		/** Opens a file with the operating system's default application; resolves to an error message, empty on success. */
		openPath: (path: string) => Promise<string>;
	};
}
