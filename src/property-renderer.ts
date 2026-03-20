import {MarkdownPostProcessorContext, Plugin} from "obsidian";

/**
 * Renders atlas_entities frontmatter as styled blocks in reading mode.
 * In reading mode, frontmatter properties are rendered in a .metadata-container.
 */
export function registerPropertyRenderer(plugin: Plugin) {
	// Post-processor for reading mode — style atlas entities in the metadata/properties section
	plugin.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		const frontmatter = ctx.frontmatter;
		if (!frontmatter?.atlas_entities?.length) return;

		// Find the properties container rendered by Obsidian
		const propsContainer = el.querySelector(".metadata-container");
		if (!propsContainer) return;

		// Look for the atlas_entities property row
		const propRows = propsContainer.querySelectorAll(".metadata-property");
		for (const row of Array.from(propRows)) {
			const key = row.querySelector(".metadata-property-key");
			if (key?.textContent?.trim() === "atlas_entities") {
				const valueEl = row.querySelector(".metadata-property-value");
				if (valueEl) {
					renderAtlasEntities(valueEl as HTMLElement, frontmatter.atlas_entities);
				}
			}
		}
	});
}

function renderAtlasEntities(container: HTMLElement, entities: Array<{id: string; name: string; type?: string} | string>) {
	container.empty();
	const list = container.createDiv({cls: "atlas-entities-list"});

	for (const entity of entities) {
		const name = typeof entity === "object" ? entity.name : entity;
		const type = typeof entity === "object" ? (entity.type ?? "Entity") : "Entity";

		const block = list.createDiv({cls: "atlas-entity-block"});
		const typeCls = `atlas-type-${type.toLowerCase()}`;
		block.createSpan({cls: `atlas-entity-type ${typeCls}`, text: type});
		block.createSpan({cls: "atlas-entity-name", text: name});
	}
}
