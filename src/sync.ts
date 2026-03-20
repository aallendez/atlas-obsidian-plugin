import {App, TAbstractFile, TFile, debounce} from "obsidian";

const MENTION_REGEX = /\[@([^\]]+)\]\(atlas:[^)]+\)/g;

function extractMentionNames(content: string): Set<string> {
	const names = new Set<string>();
	let match;
	while ((match = MENTION_REGEX.exec(content)) !== null) {
		names.add(match[1] ?? "");
	}
	return names;
}

export function createFrontmatterSync(app: App) {
	const syncFile = debounce(async (file: TAbstractFile) => {
		if (!(file instanceof TFile) || file.extension !== "md") return;
		const content = await app.vault.read(file);

		// Split frontmatter from body to only scan body for mentions
		const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/);
		const body = fmMatch ? content.slice(fmMatch[0].length) : content;
		const names = extractMentionNames(body);

		app.fileManager.processFrontMatter(file, (fm) => {
			const existing: string[] = Array.isArray(fm.atlas_entities) ? fm.atlas_entities : [];
			if (existing.length === 0) return;

			// Keep entries whose name still appears in the body
			// Frontmatter format: "Name (Type)" — extract name part to match
			const filtered = existing.filter(entry => {
				const name = typeof entry === "string"
					? entry.replace(/\s*\([^)]*\)\s*$/, "")
					: "";
				return names.has(name);
			});

			if (filtered.length !== existing.length) {
				if (filtered.length === 0) {
					delete fm.atlas_entities;
				} else {
					fm.atlas_entities = filtered;
				}
			}
		});
	}, 1000, true);

	return syncFile;
}
