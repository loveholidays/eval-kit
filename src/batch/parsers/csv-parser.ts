import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import type { BatchInputFileConfig, BatchInputRow } from "../types.js";

export class CsvParser {
	async parse(config: BatchInputFileConfig): Promise<BatchInputRow[]> {
		const { filePath, csvOptions = {}, fieldMapping } = config;

		// Read file
		const encoding = csvOptions.encoding ?? "utf-8";
		const content = await readFile(filePath, { encoding });

		// Parse CSV
		const records = parse(content, {
			delimiter: csvOptions.delimiter ?? ",",
			quote: csvOptions.quote ?? '"',
			escape: csvOptions.escape ?? '"',
			columns: csvOptions.headers ?? true,
			skip_empty_lines: csvOptions.skipEmptyLines ?? true,
			trim: true,
			cast: false, // Keep all values as strings for now
		}) as unknown as Record<string, string>[];

		// Map records to BatchInputRow
		return records.map((record, index) => {
			// Build the required field
			const candidateText = this.getField(
				record,
				fieldMapping?.candidateText ?? "candidateText",
			);

			// Build optional fields
			let id: string;
			if (fieldMapping?.id) {
				id = this.getField(record, fieldMapping.id);
			} else if (record.id) {
				id = record.id;
			} else {
				id = `row-${index}`;
			}

			let referenceText: string | undefined;
			if (fieldMapping?.referenceText) {
				const value = this.getOptionalField(record, fieldMapping.referenceText);
				if (value) referenceText = value;
			} else if (record.referenceText) {
				referenceText = record.referenceText;
			}

			let sourceText: string | undefined;
			if (fieldMapping?.sourceText) {
				const value = this.getOptionalField(record, fieldMapping.sourceText);
				if (value) sourceText = value;
			} else if (record.sourceText) {
				sourceText = record.sourceText;
			}

			let contentType: string | undefined;
			if (fieldMapping?.contentType) {
				const value = this.getOptionalField(record, fieldMapping.contentType);
				if (value) contentType = value;
			} else if (record.contentType) {
				contentType = record.contentType;
			}

			let language: string | undefined;
			if (fieldMapping?.language) {
				const value = this.getOptionalField(record, fieldMapping.language);
				if (value) language = value;
			} else if (record.language) {
				language = record.language;
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

	private getField(record: Record<string, string>, fieldName: string): string {
		const value = record[fieldName];
		if (value === undefined || value === null || value === "") {
			throw new Error(`Required field '${fieldName}' not found in CSV record`);
		}
		return value;
	}

	private getOptionalField(
		record: Record<string, string>,
		fieldName: string,
	): string | undefined {
		const value = record[fieldName];
		if (value === undefined || value === null || value === "") {
			return undefined;
		}
		return value;
	}
}
