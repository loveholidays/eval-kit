import { writeFile } from "node:fs/promises";
import type { BatchEvaluationResult, BatchExportConfig } from "../types.js";

export class JsonExporter {
	async export(
		results: BatchEvaluationResult[],
		config: BatchExportConfig,
	): Promise<void> {
		const {
			destination,
			jsonOptions = {},
			includeFields,
			excludeFields,
			filterCondition,
		} = config;

		// Filter results if condition provided
		const filteredResults = filterCondition
			? results.filter(filterCondition)
			: results;

		// Apply field filtering
		const finalResults = includeFields || excludeFields
			? filteredResults.map((result) =>
					this.applyFieldFilters(result, includeFields, excludeFields),
				)
			: filteredResults;

		// Build output object
		const output = jsonOptions.includeMetadata
			? {
					metadata: {
						exportedAt: new Date().toISOString(),
						totalResults: finalResults.length,
						successfulResults: finalResults.filter((r) => !r.error).length,
						failedResults: finalResults.filter((r) => r.error).length,
					},
					results: finalResults,
				}
			: finalResults;

		// Serialize to JSON
		const json = JSON.stringify(
			output,
			null,
			jsonOptions.pretty ? 2 : undefined,
		);

		// Write to file
		await writeFile(destination, json, { encoding: "utf-8" });
	}

	/**
	 * Apply field filtering to a single result
	 */
	private applyFieldFilters(
		result: BatchEvaluationResult,
		includeFields?: string[],
		excludeFields?: string[],
	): Partial<BatchEvaluationResult> {
		if (!includeFields && !excludeFields) {
			return result;
		}

		const filtered: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(result)) {
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

		return filtered as Partial<BatchEvaluationResult>;
	}
}
