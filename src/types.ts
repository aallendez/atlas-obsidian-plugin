export interface EntityTypeConfig {
	name: string;
	color: string;
}

export interface Entity {
	id: string;
	name: string;
	type: string;
	description?: string;
}
