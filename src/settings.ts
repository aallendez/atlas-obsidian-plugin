import {App, PluginSettingTab, Setting} from "obsidian";
import type AtlasPlugin from "./main";
import type {EntityTypeConfig} from "./types";

export interface AtlasSettings {
	atlasServerUrl: string;
	debounceMs: number;
	entityTypes: EntityTypeConfig[];
}

export const DEFAULT_ENTITY_TYPES: EntityTypeConfig[] = [
	{name: "Person", color: "var(--color-blue)"},
	{name: "Company", color: "var(--color-purple)"},
	{name: "Community", color: "var(--color-green)"},
	{name: "Project", color: "var(--color-orange)"},
];

export const DEFAULT_SETTINGS: AtlasSettings = {
	atlasServerUrl: "http://localhost:3001/mcp",
	debounceMs: 300,
	entityTypes: DEFAULT_ENTITY_TYPES,
};

export class AtlasSettingTab extends PluginSettingTab {
	plugin: AtlasPlugin;

	constructor(app: App, plugin: AtlasPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Knowledge Graph server URL")
			.setDesc("Full URL of the Knowledge Graph MCP endpoint (e.g. http://localhost:3001/mcp)")
			.addText(text => text
				.setPlaceholder("http://localhost:3001/mcp")
				.setValue(this.plugin.settings.atlasServerUrl)
				.onChange(async (value) => {
					this.plugin.settings.atlasServerUrl = value.replace(/\/+$/, "");
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Search debounce (ms)")
			.setDesc("Delay before searching after typing (100–2000)")
			.addText(text => text
				.setPlaceholder("300")
				.setValue(String(this.plugin.settings.debounceMs))
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed)) {
						this.plugin.settings.debounceMs = Math.max(100, Math.min(2000, parsed));
						await this.plugin.saveSettings();
					}
				}));

		// --- Entity types section ---
		containerEl.createEl("h3", {text: "Entity types"});

		for (const [i, et] of this.plugin.settings.entityTypes.entries()) {
			new Setting(containerEl)
				.setName(et.name)
				.addColorPicker(cp => cp
					.setValue(cssVarToHex(et.color))
					.onChange(async (value) => {
						et.color = value;
						await this.plugin.saveSettings();
						this.plugin.refreshEntityTypeStyles();
					}))
				.addExtraButton(btn => btn
					.setIcon("trash")
					.setTooltip("Remove entity type")
					.onClick(async () => {
						this.plugin.settings.entityTypes.splice(i, 1);
						await this.plugin.saveSettings();
						this.plugin.refreshEntityTypeStyles();
						this.display();
					}));
		}

		// "Add new type" row
		let newTypeName = "";
		new Setting(containerEl)
			.setName("Add entity type")
			.addText(text => text
				.setPlaceholder("e.g. Event")
				.onChange(value => { newTypeName = value.trim(); }))
			.addButton(btn => btn
				.setButtonText("Add")
				.setCta()
				.onClick(async () => {
					if (!newTypeName) return;
					const exists = this.plugin.settings.entityTypes
						.some(t => t.name.toLowerCase() === newTypeName.toLowerCase());
					if (exists) return;
					this.plugin.settings.entityTypes.push({
						name: newTypeName,
						color: "#888888",
					});
					await this.plugin.saveSettings();
					this.plugin.refreshEntityTypeStyles();
					this.display();
				}));
	}
}

/** Best-effort conversion so the color picker has a starting value for CSS vars. */
function cssVarToHex(color: string): string {
	if (color.startsWith("#")) return color;
	// For CSS variables, return a reasonable default — the picker will override with a hex value
	const varMap: Record<string, string> = {
		"var(--color-blue)": "#4488ee",
		"var(--color-purple)": "#9966cc",
		"var(--color-green)": "#44bb88",
		"var(--color-orange)": "#ee8844",
	};
	return varMap[color] ?? "#888888";
}
