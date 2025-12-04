import { stringify } from "csv-stringify/sync";
import { writeFile } from "node:fs/promises";
import type { BatchEvaluationResult, BatchExportConfig } from "../types.js";

export class CsvExporter {
	async export(
		results: BatchEvaluationResult[],
		config: BatchExportConfig,
	): Promise<void> {
		const { destination, csvOptions = {}, includeFields, excludeFields, filterCondition } = config;

		// Filter results if condition provided
		const filteredResults = filterCondition
			? results.filter(filterCondition)
			: results;

		// Flatten results for CSV
		const flattenedRecords = filteredResults.map((result) =>
			this.flattenResult(result, csvOptions.flattenResults ?? true),
		);

		// Apply field filtering
		const finalRecords = this.applyFieldFilters(
			flattenedRecords,
			includeFields,
			excludeFields,
		);

		// Generate CSV
		const csv = stringify(finalRecords, {
			header: csvOptions.includeHeaders ?? true,
			delimiter: csvOptions.delimiter ?? ",",
			quoted: true,
			quoted_empty: true,
			quoted_string: true,
		});

		// Write to file
		await writeFile(destination, csv, { encoding: "utf-8" });
	}

	/**
	 * Flatten a BatchEvaluationResult into a flat object suitable for CSV
	 */
	private flattenResult(
		result: BatchEvaluationResult,
		shouldFlatten: boolean,
	): Record<string, unknown> {
		const flat: Record<string, unknown> = {
			rowId: result.rowId,
			rowIndex: result.rowIndex,
			timestamp: result.timestamp,
			durationMs: result.durationMs,
			retryCount: result.retryCount,
			error: result.error ?? "",
		};

		// Add input fields
		flat.candidateText = result.input.candidateText;
		if (result.input.prompt) flat.prompt = result.input.prompt;
		if (result.input.referenceText) flat.referenceText = result.input.referenceText;
		if (result.input.sourceText) flat.sourceText = result.input.sourceText;
		if (result.input.contentType) flat.contentType = result.input.contentType;
		if (result.input.language) flat.language = result.input.language;

		// Add additional input fields
		for (const [key, value] of Object.entries(result.input)) {
			if (
				key !== "candidateText" &&
				key !== "prompt" &&
				key !== "referenceText" &&
				key !== "sourceText" &&
				key !== "contentType" &&
				key !== "language" &&
				key !== "id"
			) {
				flat[`input_${key}`] = this.serializeValue(value);
			}
		}

		// Add evaluator results
		if (shouldFlatten) {
			for (let i = 0; i < result.results.length; i++) {
				const evalResult = result.results[i];
				const prefix = result.results.length === 1 ? "" : `eval${i + 1}_`;

				flat[`${prefix}evaluatorName`] = evalResult.evaluatorName;
				flat[`${prefix}score`] = evalResult.score;
				flat[`${prefix}feedback`] = evalResult.feedback;

				if (evalResult.processingStats) {
					flat[`${prefix}executionTime`] = evalResult.processingStats.executionTime;
					if (evalResult.processingStats.tokenUsage) {
						flat[`${prefix}tokenUsage`] = JSON.stringify(evalResult.processingStats.tokenUsage);
					}
				}
				if (evalResult.error) {
					flat[`${prefix}error`] = evalResult.error;
				}
			}
		} else {
			// Keep results as JSON string
			flat.results = JSON.stringify(result.results);
		}

		return flat;
	}

	/**
	 * Apply field filtering
	 */
	private applyFieldFilters(
		records: Record<string, unknown>[],
		includeFields?: string[],
		excludeFields?: string[],
	): Record<string, unknown>[] {
		if (!includeFields && !excludeFields) {
			return records;
		}

		return records.map((record) => {
			const filtered: Record<string, unknown> = {};

			for (const [key, value] of Object.entries(record)) {
				// Include logic
				if (includeFields && !includeFields.includes(key)) {
					continue;
				}

				// Exclude logic
				if (excludeFields && excludeFields.includes(key)) {
					continue;
				}

				filtered[key] = value;
			}

			return filtered;
		});
	}

	/**
	 * Serialize a value for CSV
	 */
	private serializeValue(value: unknown): string {
		if (value === null || value === undefined) {
			return "";
		}
		if (typeof value === "string") {
			return value;
		}
		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}
		// For objects and arrays, serialize as JSON
		return JSON.stringify(value);
	}
}
