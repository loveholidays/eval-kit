import { appendFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { stringify } from "csv-stringify/sync";
import type { BatchEvaluationResult, BatchExportConfig } from "./types.js";

/**
 * StreamingExporter handles exporting individual results as they complete
 */
export class StreamingExporter {
	private config: BatchExportConfig;
	private isFirstResult = true;
	private csvHeaderWritten = false;

	constructor(config: BatchExportConfig) {
		this.config = config;
	}

	/**
	 * Initialize the export destination (e.g., write headers for CSV)
	 */
	async initialize(): Promise<void> {
		const appendMode = this.config.appendToExisting ?? false;

		if (this.config.format === "csv") {
			if (appendMode && existsSync(this.config.destination)) {
				// Append mode: skip header writing since file already has headers
				this.csvHeaderWritten = true;
			} else {
				// Clear the file if it exists
				if (existsSync(this.config.destination)) {
					await writeFile(this.config.destination, "", { encoding: "utf-8" });
				}
			}
		} else if (this.config.format === "json") {
			if (appendMode && existsSync(this.config.destination)) {
				// JSON append mode not fully supported - warn and overwrite
				console.warn("Warning: appendToExisting is not fully supported for JSON format. Use CSV for resume capability.");
			}
			// Start JSON array
			await writeFile(this.config.destination, "[\n", { encoding: "utf-8" });
		}
	}

	/**
	 * Export a single result
	 */
	async exportResult(result: BatchEvaluationResult): Promise<void> {
		// Apply filtering
		if (this.config.filterCondition && !this.config.filterCondition(result)) {
			return; // Skip this result
		}

		switch (this.config.format) {
			case "csv":
				await this.exportToCsv(result);
				break;
			case "json":
				await this.exportToJson(result);
				break;
			case "webhook":
				await this.exportToWebhook(result);
				break;
		}
	}

	/**
	 * Finalize the export (e.g., close JSON array)
	 */
	async finalize(): Promise<void> {
		if (this.config.format === "json") {
			// Close JSON array
			await appendFile(this.config.destination, "\n]\n", { encoding: "utf-8" });
		}
	}

	/**
	 * Export to CSV
	 */
	private async exportToCsv(result: BatchEvaluationResult): Promise<void> {
		const { csvOptions = {} } = this.config;

		// Flatten result
		const flat = this.flattenResult(result, csvOptions.flattenResults ?? true);

		// Apply field filters
		const filtered = this.applyFieldFilters(flat);

		// Generate CSV
		const csv = stringify([filtered], {
			header: !this.csvHeaderWritten && (csvOptions.includeHeaders ?? true),
			delimiter: csvOptions.delimiter ?? ",",
			quoted: true,
			quoted_empty: true,
			quoted_string: true,
		});

		// Append to file
		await appendFile(this.config.destination, csv, { encoding: "utf-8" });
		this.csvHeaderWritten = true;
	}

	/**
	 * Export to JSON
	 */
	private async exportToJson(result: BatchEvaluationResult): Promise<void> {
		const { jsonOptions = {} } = this.config;

		// Apply field filters
		const filtered = this.applyFieldFilters(result);

		// Add comma separator if not first result
		const prefix = this.isFirstResult ? "  " : ",\n  ";
		this.isFirstResult = false;

		// Serialize
		const json = JSON.stringify(filtered, null, jsonOptions.pretty ? 2 : undefined);
		const indented = jsonOptions.pretty
			? json.split("\n").map((line) => "  " + line).join("\n")
			: json;

		await appendFile(this.config.destination, prefix + indented, { encoding: "utf-8" });
	}

	/**
	 * Export to webhook
	 */
	private async exportToWebhook(result: BatchEvaluationResult): Promise<void> {
		const { webhookOptions = {} } = this.config;

		// Apply field filters
		const filtered = this.applyFieldFilters(result);

		const method = webhookOptions.method ?? "POST";
		const timeout = webhookOptions.timeout ?? 30000;
		const retryOnFailure = webhookOptions.retryOnFailure ?? true;

		const payload = {
			timestamp: new Date().toISOString(),
			result: filtered,
		};

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(this.config.destination, {
				method,
				headers: {
					"Content-Type": "application/json",
					...webhookOptions.headers,
				},
				body: JSON.stringify(payload),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(
					`Webhook request failed: ${response.status} ${response.statusText}`,
				);
			}
		} catch (error) {
			if (retryOnFailure) {
				// Retry once after 1 second
				await this.sleep(1000);
				try {
					const response = await fetch(this.config.destination, {
						method,
						headers: {
							"Content-Type": "application/json",
							...webhookOptions.headers,
						},
						body: JSON.stringify(payload),
					});

					if (!response.ok) {
						throw new Error(
							`Webhook retry failed: ${response.status} ${response.statusText}`,
						);
					}
				} catch (retryError) {
					console.error(
						`Failed to export result to webhook: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
					);
				}
			} else {
				console.error(
					`Failed to export result to webhook: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Flatten a result for CSV export
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
				flat[`${prefix}success`] = evalResult.success;
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
			flat.results = JSON.stringify(result.results);
		}

		return flat;
	}

	/**
	 * Apply field filtering
	 */
	private applyFieldFilters(data: Record<string, unknown> | BatchEvaluationResult): Record<string, unknown> {
		const { includeFields, excludeFields } = this.config;

		if (!includeFields && !excludeFields) {
			return data as Record<string, unknown>;
		}

		const filtered: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(data)) {
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
		return JSON.stringify(value);
	}

	/**
	 * Sleep helper
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
