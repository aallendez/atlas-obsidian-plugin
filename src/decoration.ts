import {EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, MatchDecorator} from "@codemirror/view";

const atlasMention = Decoration.mark({class: "atlas-mention"});

const mentionMatcher = new MatchDecorator({
	regexp: /\[@[^\]]+\]\(atlas:[^)]+\)/g,
	decoration: () => atlasMention,
});

export const atlasDecorationPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = mentionMatcher.createDeco(view);
		}

		update(update: ViewUpdate) {
			this.decorations = mentionMatcher.updateDeco(update, this.decorations);
		}
	},
	{decorations: (v) => v.decorations},
);
