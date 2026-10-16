// Sets the plugin version in package.json and manifest.json, and records in
// versions.json the minimum Obsidian version it needs. Usage: task version -- 0.2.0
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2] ?? '';
if (!/^\d+\.\d+\.\d+$/u.test(version)) {
	console.error(`expected a version x.y.z, got "${version}"`);
	process.exit(1);
}

const update = (file, change) => {
	const data = JSON.parse(readFileSync(file, 'utf8'));
	change(data);
	writeFileSync(file, `${JSON.stringify(data, null, '\t')}\n`);
	return data;
};

update('package.json', (data) => (data.version = version));
const { minAppVersion } = update('manifest.json', (data) => (data.version = version));
update('versions.json', (data) => (data[version] = minAppVersion));
