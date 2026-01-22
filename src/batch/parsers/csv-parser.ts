import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import type { BatchInputFileConfig, BatchInputRow } from "../types.js";

export class CsvParser {
	async parse(config: BatchInputFileConfig): Promise<BatchInputRow[]> {
		const records = await this.parseRecordsFromFile(config);
		return records.map((record, index) =>
			this.mapRecordToRow(record, index, config.fieldMapping),
		);
	}

	/**
	 * Read and parse CSV file into records
	 */
	private async parseRecordsFromFile(
		config: BatchInputFileConfig,
	): Promise<Record<string, string>[]> {
		const { filePath, csvOptions = {} } = config;

		const encoding = csvOptions.encoding ?? "utf-8";
		const content = await readFile(filePath, { encoding });

		return parse(content, {
			delimiter: csvOptions.delimiter ?? ",",
			quote: csvOptions.quote ?? '"',
			escape: csvOptions.escape ?? '"',
			columns: csvOptions.headers ?? true,
			skip_empty_lines: csvOptions.skipEmptyLines ?? true,
			trim: true,
			cast: false,
		}) as unknown as Record<string, string>[];
	}

	/**
	 * Map a CSV record to a BatchInputRow
	 */
	private mapRecordToRow(
		record: Record<string, string>,
		index: number,
		fieldMapping?: BatchInputFileConfig["fieldMapping"],
	): BatchInputRow {
		const candidateText = this.getField(
			record,
			fieldMapping?.candidateText ?? "candidateText",
		);

		const id = this.extractId(record, index, fieldMapping);
		const referenceText = this.extractOptionalField(
			record,
			"referenceText",
			fieldMapping?.referenceText,
		);
		const sourceText = this.extractOptionalField(
			record,
			"sourceText",
			fieldMapping?.sourceText,
		);
		const contentType = this.extractOptionalField(
			record,
			"contentType",
			fieldMapping?.contentType,
		);
		const language = this.extractOptionalField(
			record,
			"language",
			fieldMapping?.language,
		);

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
		record: Record<string, string>,
		index: number,
		fieldMapping?: BatchInputFileConfig["fieldMapping"],
	): string {
		if (fieldMapping?.id) {
			return this.getField(record, fieldMapping.id);
		}
		return record.id || `row-${index}`;
	}

	/**
	 * Extract optional field with mapping fallback
	 */
	private extractOptionalField(
		record: Record<string, string>,
		defaultFieldName: string,
		mappedFieldName?: string,
	): string | undefined {
		if (mappedFieldName) {
			return this.getOptionalField(record, mappedFieldName);
		}
		return this.getOptionalField(record, defaultFieldName);
	}

	/**
	 * Add any additional fields from the record to the row
	 */
	private addAdditionalFields(
		row: BatchInputRow,
		record: Record<string, string>,
	): void {
		for (const [key, value] of Object.entries(record)) {
			if (!(key in row)) {
				row[key] = value;
			}
		}
	}

	private getField(record: Record<string, string>, fieldName: string): string {
		const value = record[fieldName];
		if (!value) {
			throw new Error(`Required field '${fieldName}' not found in CSV record`);
		}
		return value;
	}

	private getOptionalField(
		record: Record<string, string>,
		fieldName: string,
	): string | undefined {
		const value = record[fieldName];
		return value || undefined;
	}
}
