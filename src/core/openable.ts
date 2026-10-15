// File types a code anchor may open with the operating system's default
// application: sources and data that no common default application runs.
// Anything else is not opened. Scripts are absent on purpose (`.js` runs under
// Windows Script Host, `.py` under the Python launcher, `.command` in macOS
// Terminal), as are pages and archives a browser or runtime would execute.
const OPENABLE = new Set([
	'c',
	'cc',
	'cfg',
	'conf',
	'cpp',
	'cs',
	'css',
	'csv',
	'cts',
	'cue',
	'dart',
	'ex',
	'exs',
	'go',
	'gradle',
	'graphql',
	'h',
	'hcl',
	'hpp',
	'hs',
	'ini',
	'java',
	'json',
	'jsonc',
	'kt',
	'kts',
	'less',
	'md',
	'ml',
	'mts',
	'nix',
	'proto',
	'rs',
	'scala',
	'scss',
	'sql',
	'swift',
	'tf',
	'textproto',
	'toml',
	'ts',
	'tsx',
	'txt',
	'txtpb',
	'xml',
	'yaml',
	'yml',
	'zig',
]);

/** Whether a repository-relative path may open with the default application. */
export function isOpenable(file: string): boolean {
	const name = file.slice(file.lastIndexOf('/') + 1);
	const dot = name.lastIndexOf('.');
	return dot > 0 && OPENABLE.has(name.slice(dot + 1).toLowerCase());
}
