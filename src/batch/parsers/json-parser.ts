import { readFile } from "node:fs/promises";
import type { BatchInputFileConfig, BatchInputRow } from "../types.js";

export class JsonParser {
	async parse(config: BatchInputFileConfig): Promise<BatchInputRow[]> {
		const data = await this.parseJsonFromFile(config);
		const records = this.extractRecordsArray(data, config.jsonOptions);
		this.validateRecords(records);

		return (records as Record<string, unknown>[]).map((record, index) =>
			this.mapRecordToRow(record, index, config.fieldMapping),
		);
	}

	/**
	 * Read and parse JSON file
	 */
	private async parseJsonFromFile(
		config: BatchInputFileConfig,
	): Promise<unknown> {
		const { filePath, jsonOptions = {} } = config;
		const encoding = jsonOptions.encoding ?? "utf-8";
		const content = await readFile(filePath, { encoding });

		try {
			return JSON.parse(content);
		} catch (error) {
			throw new Error(
				`Failed to parse JSON file: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Extract array of records from data
	 */
	private extractRecordsArray(
		data: unknown,
		jsonOptions?: BatchInputFileConfig["jsonOptions"],
	): unknown[] {
		if (jsonOptions?.arrayPath) {
			return this.extractFromPath(data, jsonOptions.arrayPath);
		}

		if (Array.isArray(data)) {
			return data;
		}

		throw new Error(
			"JSON file must be an array or specify arrayPath to locate the array",
		);
	}

	/**
	 * Validate that all records are objects
	 */
	private validateRecords(records: unknown[]): void {
		if (!records.every((r) => typeof r === "object" && r !== null)) {
			throw new Error("All records in the array must be objects");
		}
	}

	/**
	 * Map a JSON record to a BatchInputRow
	 */
	private mapRecordToRow(
		record: Record<string, unknown>,
		index: number,
		fieldMapping?: BatchInputFileConfig["fieldMapping"],
	): BatchInputRow {
		const candidateText = this.getField(
			record,
			fieldMapping?.candidateText ?? "candidateText",
		);

		const id = this.extractId(record, index, fieldMapping);
		const referenceText = this.extractOptionalStringField(record, {
			defaultFieldName: "referenceText",
			mappedFieldName: fieldMapping?.referenceText,
		});
		const sourceText = this.extractOptionalStringField(record, {
			defaultFieldName: "sourceText",
			mappedFieldName: fieldMapping?.sourceText,
		});
		const contentType = this.extractOptionalStringField(record, {
			defaultFieldName: "contentType",
			mappedFieldName: fieldMapping?.contentType,
		});
		const language = this.extractOptionalStringField(record, {
			defaultFieldName: "language",
			mappedFieldName: fieldMapping?.language,
		});

		const row: BatchInputRow = {
			candidateText,
			id,
			...(referenceText && { referenceText }),
			...(sourceText && { sourceText }),
			...(contentType && { contentType }),
			...(language && { language }),
		};

		this.addAdditionalFields(row, record);

		return row;
	}

	/**
	 * Extract ID field with fallback logic
	 */
	private extractId(
		record: Record<string, unknown>,
		index: number,
		fieldMapping?: BatchInputFileConfig["fieldMapping"],
	): string {
		if (fieldMapping?.id) {
			const value = this.getOptionalField(record, fieldMapping.id);
			return value ? String(value) : `row-${index}`;
		}
		return record.id ? String(record.id) : `row-${index}`;
	}

	/**
	 * Extract optional string field with mapping fallback
	 */
	private extractOptionalStringField(
		record: Record<string, unknown>,
		options: { defaultFieldName: string; mappedFieldName?: string },
	): string | undefined {
		const fieldName = options.mappedFieldName ?? options.defaultFieldName;
		const value = this.getOptionalField(record, fieldName);
		return value ? String(value) : undefined;
	}

	/**
	 * Add any additional fields from the record to the row
	 */
	private addAdditionalFields(
		row: BatchInputRow,
		record: Record<string, unknown>,
	): void {
		for (const [key, value] of Object.entries(record)) {
			if (!(key in row)) {
				row[key] = value;
			}
		}
	}

	private extractFromPath(data: unknown, path: string): unknown[] {
		const parts = path.split(".");
		let current: unknown = data;

		for (const part of parts) {
			current = this.accessProperty({
				obj: current,
				propertyName: part,
				fullPath: path,
			});
		}

		this.ensureIsArray(current, path);
		return current as unknown[];
	}

	/**
	 * Access a property on an object, with validation
	 */
	private accessProperty(options: {
		obj: unknown;
		propertyName: string;
		fullPath: string;
	}): unknown {
		const { obj, propertyName, fullPath } = options;

		if (typeof obj !== "object" || obj === null) {
			throw new Error(`Cannot access property '${propertyName}' on non-object`);
		}

		const value = (obj as Record<string, unknown>)[propertyName];
		if (value === undefined) {
			throw new Error(
				`Property '${propertyName}' not found in path '${fullPath}'`,
			);
		}

		return value;
	}

	/**
	 * Ensure the value is an array
	 */
	private ensureIsArray(value: unknown, path: string): void {
		if (!Array.isArray(value)) {
			throw new Error(`Path '${path}' does not point to an array`);
		}
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
