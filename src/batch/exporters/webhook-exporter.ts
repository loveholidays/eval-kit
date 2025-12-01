import type { BatchEvaluationResult, BatchExportConfig } from "../types.js";

export class WebhookExporter {
	async export(
		results: BatchEvaluationResult[],
		config: BatchExportConfig,
	): Promise<void> {
		const {
			destination,
			webhookOptions = {},
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

		// Send in batches or all at once
		const batchSize = webhookOptions.batchSize ?? finalResults.length;
		const batches = this.createBatches(finalResults, batchSize);

		for (const batch of batches) {
			await this.sendBatch(batch, destination, webhookOptions);
		}
	}

	/**
	 * Send a batch of results to the webhook
	 */
	private async sendBatch(
		batch: Partial<BatchEvaluationResult>[],
		url: string,
		options: NonNullable<BatchExportConfig["webhookOptions"]>,
	): Promise<void> {
		const method = options.method ?? "POST";
		const timeout = options.timeout ?? 30000;
		const retryOnFailure = options.retryOnFailure ?? true;

		const payload = {
			timestamp: new Date().toISOString(),
			results: batch,
			count: batch.length,
		};

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					...options.headers,
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
					const response = await fetch(url, {
						method,
						headers: {
							"Content-Type": "application/json",
							...options.headers,
						},
						body: JSON.stringify(payload),
					});

					if (!response.ok) {
						throw new Error(
							`Webhook retry failed: ${response.status} ${response.statusText}`,
						);
					}
				} catch (retryError) {
					throw new Error(
						`Webhook export failed after retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
					);
				}
			} else {
				throw new Error(
					`Webhook export failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Create batches from results
	 */
	private createBatches<T>(
		items: T[],
		batchSize: number,
	): T[][] {
		const batches: T[][] = [];
		for (let i = 0; i < items.length; i += batchSize) {
			batches.push(items.slice(i, i + batchSize));
		}
		return batches;
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

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
