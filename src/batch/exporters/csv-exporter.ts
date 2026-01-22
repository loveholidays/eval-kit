import { writeFile } from "node:fs/promises";
import { stringify } from "csv-stringify/sync";
import type { BatchEvaluationResult, BatchExportConfig } from "../types.js";

const STANDARD_INPUT_FIELDS = new Set([
	"candidateText",
	"prompt",
	"referenceText",
	"sourceText",
	"contentType",
	"language",
	"id",
]);

export class CsvExporter {
	async export(
		results: BatchEvaluationResult[],
		config: BatchExportConfig,
	): Promise<void> {
		const {
			destination,
			csvOptions = {},
			includeFields,
			excludeFields,
			filterCondition,
		} = config;

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

		this.addStandardInputFields(flat, result.input);
		this.addAdditionalInputFields(flat, result.input);
		this.addEvaluatorResults(flat, result.results, shouldFlatten);

		return flat;
	}

	/**
	 * Add standard input fields to the flattened object
	 */
	private addStandardInputFields(
		flat: Record<string, unknown>,
		input: BatchEvaluationResult["input"],
	): void {
		flat.candidateText = input.candidateText;
		if (input.prompt) flat.prompt = input.prompt;
		if (input.referenceText) flat.referenceText = input.referenceText;
		if (input.sourceText) flat.sourceText = input.sourceText;
		if (input.contentType) flat.contentType = input.contentType;
		if (input.language) flat.language = input.language;
	}

	/**
	 * Add additional input fields to the flattened object
	 */
	private addAdditionalInputFields(
		flat: Record<string, unknown>,
		input: BatchEvaluationResult["input"],
	): void {
		for (const [key, value] of Object.entries(input)) {
			if (!STANDARD_INPUT_FIELDS.has(key)) {
				flat[`input_${key}`] = this.serializeValue(value);
			}
		}
	}

	/**
	 * Add evaluator results to the flattened object
	 */
	private addEvaluatorResults(
		flat: Record<string, unknown>,
		results: BatchEvaluationResult["results"],
		shouldFlatten: boolean,
	): void {
		if (!shouldFlatten) {
			flat.results = JSON.stringify(results);
			return;
		}

		for (let i = 0; i < results.length; i++) {
			const evalResult = results[i];
			const prefix = results.length === 1 ? "" : `eval${i + 1}_`;

			flat[`${prefix}evaluatorName`] = evalResult.evaluatorName;
			flat[`${prefix}score`] = evalResult.score;
			flat[`${prefix}feedback`] = evalResult.feedback;

			this.addProcessingStats(flat, evalResult, prefix);

			if (evalResult.error) {
				flat[`${prefix}error`] = evalResult.error;
			}
		}
	}

	/**
	 * Add processing stats to the flattened object
	 */
	private addProcessingStats(
		flat: Record<string, unknown>,
		evalResult: BatchEvaluationResult["results"][number],
		prefix: string,
	): void {
		if (!evalResult.processingStats) {
			return;
		}

		flat[`${prefix}executionTime`] = evalResult.processingStats.executionTime;

		if (evalResult.processingStats.tokenUsage) {
			flat[`${prefix}tokenUsage`] = JSON.stringify(
				evalResult.processingStats.tokenUsage,
			);
		}
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
