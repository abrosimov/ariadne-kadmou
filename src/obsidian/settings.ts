import { type App, type Plugin, PluginSettingTab, Setting } from 'obsidian';

export interface Settings {
	/** The address a code anchor opens at; see `codeLink`. */
	codeLinkTemplate: string;
}

export const DEFAULT_SETTINGS: Settings = { codeLinkTemplate: '{url}' };

export class SettingsTab extends PluginSettingTab {
	private readonly settings: Settings;
	private readonly save: () => Promise<void>;

	constructor(app: App, plugin: Plugin, settings: Settings, save: () => Promise<void>) {
		super(app, plugin);
		this.settings = settings;
		this.save = save;
	}

	override display(): void {
		this.containerEl.empty();
		new Setting(this.containerEl)
			.setName('Open code anchors with')
			.setDesc(
				'The address a code anchor opens at. {url} is the file URL, {path} the absolute path, {line} the line; for example vscode://file/{path}:{line}.',
			)
			.addText((text) =>
				text.setValue(this.settings.codeLinkTemplate).onChange(async (value) => {
					this.settings.codeLinkTemplate = value.trim() === '' ? DEFAULT_SETTINGS.codeLinkTemplate : value;
					await this.save();
				}),
			);
	}
}
