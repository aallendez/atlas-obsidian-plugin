import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import type {AtlasClient} from "./atlas-client";
import type {AtlasSettings} from "./settings";
import type {Entity} from "./types";

export class EntitySuggest extends EditorSuggest<Entity> {
	private atlasClient: AtlasClient;
	private getSettings: () => AtlasSettings;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(app: App, atlasClient: AtlasClient, getSettings: () => AtlasSettings) {
		super(app);
		this.atlasClient = atlasClient;
		this.getSettings = getSettings;
	}

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const sub = line.substring(0, cursor.ch);

		// Find the last @ in the substring
		const atIndex = sub.lastIndexOf("@");
		if (atIndex < 0) return null;

		// Skip if preceded by a word character (email addresses)
		if (atIndex > 0 && /\w/.test(sub.charAt(atIndex - 1))) return null;

		// Skip if inside a markdown link already, e.g. [@Name](atlas:...)
		// Check if there's a ] after the @ on the same line
		const afterAt = line.substring(atIndex);
		if (/^\[@[^\]]*\]\(atlas:/.test(afterAt)) return null;

		const query = sub.substring(atIndex + 1);

		return {
			start: {line: cursor.line, ch: atIndex},
			end: cursor,
			query,
		};
	}

	async getSuggestions(context: EditorSuggestContext): Promise<Entity[]> {
		if (!this.atlasClient.isConnected) return [];

		// Cancel pending debounce
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		return new Promise<Entity[]>((resolve) => {
			this.debounceTimer = setTimeout(async () => {
				const types = this.getSettings().entityTypes.map(t => t.name);
				const entities = await this.atlasClient.searchEntities(context.query, types);
				resolve(entities);
			}, this.getSettings().debounceMs);
		});
	}

	renderSuggestion(entity: Entity, el: HTMLElement): void {
		const container = el.createDiv({cls: "atlas-suggestion"});

		const typeCls = `atlas-type-${entity.type.toLowerCase()}`;
		container.createSpan({cls: `atlas-entity-type ${typeCls}`, text: entity.type});
		container.createSpan({cls: "atlas-entity-name", text: entity.name});

		if (entity.description) {
			container.createSpan({cls: "atlas-entity-desc", text: entity.description});
		}
	}

	selectSuggestion(entity: Entity, _evt: MouseEvent | KeyboardEvent): void {
		const context = this.context;
		if (!context) return;

		// Insert the formatted mention
		const mention = `[@${entity.name}](atlas:${entity.id}) `;
		context.editor.replaceRange(mention, context.start, context.end);

		// Update frontmatter with entity name
		const file = context.file;
		if (file) {
			this.app.fileManager.processFrontMatter(file, (fm) => {
				if (!Array.isArray(fm.atlas_entities)) {
					fm.atlas_entities = [];
				}
				const display = `${entity.name} (${entity.type})`;
				if (!fm.atlas_entities.includes(display)) {
					fm.atlas_entities.push(display);
				}
			});
		}
	}
}
