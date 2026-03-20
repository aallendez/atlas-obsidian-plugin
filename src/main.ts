import {Notice, Plugin, TFile} from "obsidian";
import {AtlasSettings, DEFAULT_SETTINGS, AtlasSettingTab} from "./settings";
import {AtlasClient} from "./atlas-client";
import {EntitySuggest} from "./suggest";
import {atlasDecorationPlugin} from "./decoration";
import {createFrontmatterSync} from "./sync";
import {registerPropertyRenderer} from "./property-renderer";

export default class AtlasPlugin extends Plugin {
	settings: AtlasSettings;
	atlasClient: AtlasClient;
	private styleEl: HTMLStyleElement | null = null;

	async onload() {
		await this.loadSettings();

		this.atlasClient = new AtlasClient(() => this.settings.atlasServerUrl);

		// Inject dynamic entity-type colour styles
		this.refreshEntityTypeStyles();

		// Register suggest and settings immediately — don't block on connection
		this.registerEditorSuggest(
			new EntitySuggest(this.app, this.atlasClient, () => this.settings),
		);
		this.addSettingTab(new AtlasSettingTab(this.app, this));

		// Style atlas: mentions in live preview
		this.registerEditorExtension(atlasDecorationPlugin);

		// Render atlas_entities as styled blocks in reading mode
		registerPropertyRenderer(this);

		// Prevent atlas: links from navigating anywhere
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			const link = target.closest("a[href^='atlas:']") as HTMLAnchorElement | null;
			if (link) {
				evt.preventDefault();
				evt.stopPropagation();
			}
		}, true);

		// Command: backfill atlas_id on all existing notes missing one
		this.addCommand({
			id: "backfill-atlas-ids",
			name: "Backfill atlas_id on all notes",
			callback: () => this.backfillAtlasIds(),
		});

		// Stamp a unique atlas_id on every new markdown note
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file instanceof TFile && file.extension === "md") {
					this.app.fileManager.processFrontMatter(file, (fm) => {
						if (!fm.atlas_id) {
							fm.atlas_id = crypto.randomUUID();
						}
					});
				}
			}),
		);

		// Sync frontmatter when mentions are removed from note body
		const syncFrontmatter = createFrontmatterSync(this.app);
		this.registerEvent(
			this.app.vault.on("modify", (file) => syncFrontmatter(file)),
		);

		// Connect in background so plugin loads even if server is down
		this.atlasClient.connect();
	}

	async onunload() {
		this.styleEl?.remove();
		await this.atlasClient.disconnect();
	}

	/** Regenerate the <style> block for entity type colours from settings. */
	refreshEntityTypeStyles() {
		if (!this.styleEl) {
			this.styleEl = document.createElement("style");
			this.styleEl.id = "atlas-entity-type-styles";
			document.head.appendChild(this.styleEl);
		}

		const rules = this.settings.entityTypes.map(et => {
			const cls = et.name.toLowerCase().replace(/\s+/g, "-");
			return `.atlas-type-${cls} { background-color: ${et.color}; color: var(--text-on-accent); }`;
		});

		this.styleEl.textContent = rules.join("\n");
	}

	async backfillAtlasIds() {
		const files = this.app.vault.getMarkdownFiles();
		let count = 0;
		for (const file of files) {
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				if (!fm.atlas_id) {
					fm.atlas_id = crypto.randomUUID();
					count++;
				}
			});
		}
		new Notice(`Atlas: added atlas_id to ${count} note(s)`);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Ensure entityTypes exists for users upgrading from older settings
		if (!this.settings.entityTypes) {
			this.settings.entityTypes = DEFAULT_SETTINGS.entityTypes;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
