import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {Entity} from "./types";

export class AtlasClient {
	private client: Client | null = null;
	private connectingPromise: Promise<void> | null = null;
	private getServerUrl: () => string;

	constructor(getServerUrl: () => string) {
		this.getServerUrl = getServerUrl;
	}

	async connect(): Promise<void> {
		this.connectingPromise = this._connect();
		return this.connectingPromise;
	}

	private async _connect(): Promise<void> {
		try {
			const url = this.getServerUrl();
			console.log("Atlas: connecting to", url);

			this.client = new Client(
				{name: "atlas-obsidian-plugin", version: "1.0.0"},
				{capabilities: {}},
			);

			const transport = new StreamableHTTPClientTransport(
				new URL(url),
				{
					// Intercept GET requests: return 405 so the SDK skips the
					// optional SSE listener instead of failing on servers that
					// return 400 for unsupported methods.
					fetch: async (url, init) => {
						if (init?.method === "GET") {
							return new Response(null, {status: 405});
						}
						return fetch(url, init);
					},
				},
			);

			await this.client.connect(transport);
			console.log("Atlas: connected successfully");
		} catch (err) {
			console.warn("Atlas: failed to connect to MCP server", err);
			this.client = null;
		} finally {
			this.connectingPromise = null;
		}
	}

	async disconnect(): Promise<void> {
		if (this.client) {
			try {
				await this.client.close();
			} catch (err) {
				console.warn("Atlas: error closing MCP client", err);
			}
			this.client = null;
		}
	}

	async searchEntities(query: string, types?: string[]): Promise<Entity[]> {
		if (this.connectingPromise) {
			await this.connectingPromise;
		}
		if (!this.client) return [];

		try {
			const label = types && types.length === 1 ? types[0] : undefined;
			const result = await this.client.callTool({
				name: "search_entities",
				arguments: {query, label, limit: 10},
			});

			if (result.isError) {
				console.warn("Atlas: search_entities error", result.content);
				return [];
			}

			const contentItems = result.content as Array<{type: string; text: string}>;
			if (!contentItems?.length) return [];

			const allowedTypes = types ? new Set<string>(types) : null;
			const entities: Entity[] = [];

			for (const item of contentItems) {
				if (item.type !== "text" || !item.text) continue;
				try {
					const parsed = JSON.parse(item.text) as {
						entity: {id: string; name: string; description?: string; labels: string[]};
						score: number;
					};
					const matchedType = parsed.entity.labels.find(l => !allowedTypes || allowedTypes.has(l));
					if (matchedType) {
						entities.push({
							id: parsed.entity.id,
							name: parsed.entity.name,
							type: matchedType,
							description: parsed.entity.description,
						});
					}
				} catch {
					continue;
				}
			}

			return entities;
		} catch (err) {
			console.warn("Atlas: search failed", err);
			return [];
		}
	}

	get isConnected(): boolean {
		return this.client !== null;
	}
}
