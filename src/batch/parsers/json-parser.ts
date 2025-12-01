import { readFile } from "node:fs/promises";
import type { BatchInputConfig, BatchInputRow } from "../types.js";

export class JsonParser {
	async parse(config: BatchInputConfig): Promise<BatchInputRow[]> {
		const { filePath, jsonOptions = {}, fieldMapping } = config;

		// Read file
		const encoding = jsonOptions.encoding ?? "utf-8";
		const content = await readFile(filePath, { encoding });

		// Parse JSON
		let data: unknown;
		try {
			data = JSON.parse(content);
		} catch (error) {
			throw new Error(`Failed to parse JSON file: ${error instanceof Error ? error.message : String(error)}`);
		}

		// Extract array from nested path if specified
		let records: unknown[];
		if (jsonOptions.arrayPath) {
			records = this.extractFromPath(data, jsonOptions.arrayPath);
		} else if (Array.isArray(data)) {
			records = data;
		} else {
			throw new Error("JSON file must be an array or specify arrayPath to locate the array");
		}

		// Validate records are objects
		if (!records.every((r) => typeof r === "object" && r !== null)) {
			throw new Error("All records in the array must be objects");
		}

		// Map records to BatchInputRow
		return (records as Record<string, unknown>[]).map((record, index) => {
			// Build the required field
			const candidateText = this.getField(
				record,
				fieldMapping?.candidateText ?? "candidateText",
			);

			// Build optional fields
			let id: string;
			if (fieldMapping?.id) {
				const value = this.getOptionalField(record, fieldMapping.id);
				id = value ? String(value) : `row-${index}`;
			} else if (record.id) {
				id = String(record.id);
			} else {
				id = `row-${index}`;
			}

			let referenceText: string | undefined;
			if (fieldMapping?.referenceText) {
				const value = this.getOptionalField(record, fieldMapping.referenceText);
				if (value) referenceText = String(value);
			} else if (record.referenceText) {
				referenceText = String(record.referenceText);
			}

			let sourceText: string | undefined;
			if (fieldMapping?.sourceText) {
				const value = this.getOptionalField(record, fieldMapping.sourceText);
				if (value) sourceText = String(value);
			} else if (record.sourceText) {
				sourceText = String(record.sourceText);
			}

			let contentType: string | undefined;
			if (fieldMapping?.contentType) {
				const value = this.getOptionalField(record, fieldMapping.contentType);
				if (value) contentType = String(value);
			} else if (record.contentType) {
				contentType = String(record.contentType);
			}

			let language: string | undefined;
			if (fieldMapping?.language) {
				const value = this.getOptionalField(record, fieldMapping.language);
				if (value) language = String(value);
			} else if (record.language) {
				language = String(record.language);
			}

			// Build the row object
			const row: BatchInputRow = {
				candidateText,
				id,
				...(referenceText && { referenceText }),
				...(sourceText && { sourceText }),
				...(contentType && { contentType }),
				...(language && { language }),
			};

			// Include any additional fields
			for (const [key, value] of Object.entries(record)) {
				if (!(key in row)) {
					row[key] = value;
				}
			}

			return row;
		});
	}

	private extractFromPath(data: unknown, path: string): unknown[] {
		const parts = path.split(".");
		let current: unknown = data;

		for (const part of parts) {
			if (typeof current !== "object" || current === null) {
				throw new Error(`Cannot access property '${part}' on non-object`);
			}
			current = (current as Record<string, unknown>)[part];
			if (current === undefined) {
				throw new Error(`Property '${part}' not found in path '${path}'`);
			}
		}

		if (!Array.isArray(current)) {
			throw new Error(`Path '${path}' does not point to an array`);
		}

		return current;
	}

	private getField(record: Record<string, unknown>, fieldName: string): string {
		const value = record[fieldName];
		if (value === undefined || value === null) {
			throw new Error(`Required field '${fieldName}' not found in JSON record`);
		}
		return String(value);
	}

	private getOptionalField(
		record: Record<string, unknown>,
		fieldName: string,
	): unknown {
		return record[fieldName];
	}
}
