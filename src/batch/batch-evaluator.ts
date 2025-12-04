import { randomUUID } from "node:crypto";
import type { EvaluatorResult, IEvaluator } from "../types/evaluator.js";
import { ConcurrencyManager } from "./concurrency-manager.js";
import { CsvExporter } from "./exporters/csv-exporter.js";
import { JsonExporter } from "./exporters/json-exporter.js";
import { WebhookExporter } from "./exporters/webhook-exporter.js";
import { CsvParser } from "./parsers/csv-parser.js";
import { JsonParser } from "./parsers/json-parser.js";
import { ProgressTracker } from "./progress-tracker.js";
import { StateManager } from "./state-manager.js";
import { StreamingExporter } from "./streaming-exporter.js";
import type {
	BatchEvaluationResult,
	BatchEvaluatorConfig,
	BatchExportConfig,
	BatchInputConfig,
	BatchInputFileConfig,
	BatchInputRow,
	BatchResult,
	BatchState,
} from "./types.js";

export class BatchEvaluator {
	private readonly config: BatchEvaluatorConfig;
	private readonly evaluators: IEvaluator[];
	private readonly concurrencyManager: ConcurrencyManager;
	private stateManager?: StateManager;
	private progressTracker?: ProgressTracker;
	private streamingExporter?: StreamingExporter;
	private batchId: string;
	private startTime: string;
	private results: BatchEvaluationResult[] = [];
	private processedRowIndices: Set<number> = new Set();

	constructor(config: BatchEvaluatorConfig) {
		this.config = config;
		this.evaluators = [...config.evaluators];
		this.batchId = randomUUID();
		this.startTime = new Date().toISOString();

		// Initialize concurrency manager
		this.concurrencyManager = new ConcurrencyManager({
			maxConcurrency: config.concurrency ?? 5,
			rateLimit: config.rateLimit,
		});

		// Initialize state manager if needed
		if (config.resumeFromState || config.saveStateInterval || config.onStateSave) {
			this.stateManager = new StateManager({
				autoSaveInterval: config.saveStateInterval,
				onStateSave: config.onStateSave,
			});
		}
	}

	/**
	 * Run batch evaluation on input data
	 */
	async evaluate(inputConfig: BatchInputConfig): Promise<BatchResult> {
		// Parse input
		const allRows = await this.parseInput(inputConfig);

		// Handle startIndex for resuming from a specific position
		const startIndex = inputConfig.startIndex ?? 0;
		const rows = startIndex > 0 ? allRows.slice(startIndex) : allRows;

		// Mark rows before startIndex as already processed (for accurate progress tracking)
		for (let i = 0; i < startIndex; i++) {
			this.processedRowIndices.add(i);
		}

		// Resume from previous state if provided
		if (this.config.resumeFromState) {
			this.resumeFromState(this.config.resumeFromState);
		}

		// Initialize streaming exporter if configured
		if (this.config.streamExport) {
			this.streamingExporter = new StreamingExporter(this.config.streamExport);
			await this.streamingExporter.initialize();
		}

		// Initialize progress tracker (use total rows for accurate percentage)
		this.progressTracker = new ProgressTracker({
			totalRows: allRows.length,
			emitInterval: this.config.progressInterval,
			onProgress: this.config.onProgress,
		});
		this.progressTracker.start();

		// Fast-forward progress tracker for skipped rows
		if (startIndex > 0) {
			this.progressTracker.skipRows(startIndex);
		}

		// Initialize state if using state manager
		if (this.stateManager && !this.config.resumeFromState) {
			this.stateManager.initialize({
				batchId: this.batchId,
				startTime: this.startTime,
				lastUpdateTime: new Date().toISOString(),
				inputConfig,
				evaluatorNames: this.evaluators.map((e) => e.name),
				totalRows: allRows.length,
				processedRowIndices: Array.from(this.processedRowIndices),
				results: [],
				progress: this.progressTracker.getCurrentProgress(),
			});
		}

		// Process rows with controlled concurrency
		// We batch into chunks to avoid creating all promises at once
		const maxConcurrency = this.config.concurrency ?? 5;
		const batchSize = maxConcurrency * 2; // Process in batches of 2x concurrency

		for (let i = 0; i < rows.length; i += batchSize) {
			const batch = rows.slice(i, i + batchSize);
			const batchPromises = batch.map((row, batchIndex) =>
				// Adjust index to account for startIndex offset
				this.processRow(row, startIndex + i + batchIndex),
			);
			await Promise.all(batchPromises);
		}

		// Mark completion
		this.progressTracker.complete();

		// Finalize streaming export
		if (this.streamingExporter) {
			await this.streamingExporter.finalize();
		}

		// Final state save
		if (this.stateManager) {
			await this.stateManager.cleanup();
		}

		// Return results
		return this.buildResult();
	}

	/**
	 * Export results to a destination
	 */
	async export(exportConfig: BatchExportConfig): Promise<void> {
		const exporter = this.getExporter(exportConfig.format);
		await exporter.export(this.results, exportConfig);
	}

	/**
	 * Parse input - supports both file-based and in-memory data
	 */
	private async parseInput(config: BatchInputConfig): Promise<BatchInputRow[]> {
		// Check if it's in-memory data config
		if ("data" in config) {
			return config.data;
		}

		// File-based config
		const fileConfig = config as BatchInputFileConfig;
		let format = fileConfig.format;

		// Handle "auto" format detection
		if (!format || format === "auto") {
			format = this.detectFormat(fileConfig.filePath);
		}

		const parser = this.getParser(format);
		return parser.parse(fileConfig);
	}

	/**
	 * Detect format from file extension
	 */
	private detectFormat(filePath: string): "csv" | "json" {
		if (filePath.endsWith(".csv")) return "csv";
		if (filePath.endsWith(".json")) return "json";
		throw new Error(
			`Cannot detect format from file extension: ${filePath}. Please specify format explicitly.`,
		);
	}

	/**
	 * Get parser for format
	 */
	private getParser(format: "csv" | "json"): CsvParser | JsonParser {
		switch (format) {
			case "csv":
				return new CsvParser();
			case "json":
				return new JsonParser();
			default:
				throw new Error(`Unsupported format: ${format}`);
		}
	}

	/**
	 * Get exporter for format
	 */
	private getExporter(format: "csv" | "json" | "webhook"): CsvExporter | JsonExporter | WebhookExporter {
		switch (format) {
			case "csv":
				return new CsvExporter();
			case "json":
				return new JsonExporter();
			case "webhook":
				return new WebhookExporter();
			default:
				throw new Error(`Unsupported export format: ${format}`);
		}
	}

	/**
	 * Process a single row
	 */
	private async processRow(row: BatchInputRow, index: number): Promise<void> {
		// Skip if already processed (resume scenario)
		if (this.processedRowIndices.has(index)) {
			return;
		}

		await this.concurrencyManager.run(async () => {
			const rowId = row.id ?? `row-${index}`;
			const startTime = Date.now();
			let retryCount = 0;
			const maxRetries = this.config.retryConfig?.maxRetries ?? 3;

			// Merge default input fields with row data
			// Row data takes precedence over defaults
			const inputData: BatchInputRow = {
				...this.config.defaultInput,
				...row,
			};

			// Loop allows: 1 initial attempt + maxRetries retry attempts
			// With maxRetries=3: attempts at retryCount 0,1,2,3 = 4 total attempts
			while (true) {
				try {
					// Run evaluators
					const evaluatorResults = await this.runEvaluators(inputData);

					// Calculate duration
					const durationMs = Date.now() - startTime;

					// Calculate total tokens used
					const tokensUsed = evaluatorResults.reduce(
						(sum, r) => sum + (r.processingStats.tokenUsage?.totalTokens ?? 0),
						0,
					);

					// Create result (use merged inputData so defaults are included)
					const result: BatchEvaluationResult = {
						rowId,
						rowIndex: index,
						input: inputData,
						results: evaluatorResults,
						...(this.config.calculateCombinedScore && {
							score: this.config.calculateCombinedScore(evaluatorResults),
						}),
						timestamp: new Date().toISOString(),
						durationMs,
						retryCount,
					};

					// Export to streaming exporter FIRST
					// This ensures if export fails, we can retry the entire row evaluation
					if (this.streamingExporter) {
						await this.streamingExporter.exportResult(result);
					}

					// Call onResult callback (after export, before storing in memory)
					if (this.config.onResult) {
						const callbackResult = this.config.onResult(result);
						if (callbackResult instanceof Promise) {
							await callbackResult;
						}
					}

					// Now store result in memory (only after successful export & callback)
					this.results.push(result);
					this.processedRowIndices.add(index);

					// Update progress
					this.progressTracker?.recordSuccess(durationMs, tokensUsed);

					// Update state
					if (this.stateManager) {
						this.stateManager.update({
							processedRowIndices: Array.from(this.processedRowIndices),
							results: this.results,
							progress: this.progressTracker?.getCurrentProgress(),
						});
					}

					return; // Success, exit retry loop
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);

					// Check if we should retry
					const shouldRetry = this.shouldRetry(errorMessage, retryCount, maxRetries);

					if (shouldRetry) {
						retryCount++;
						this.progressTracker?.recordRetry(errorMessage, retryCount);

						// Calculate delay with exponential backoff
						const baseDelay = this.config.retryConfig?.retryDelay ?? 1000;
						const delay = this.config.retryConfig?.exponentialBackoff
							? baseDelay * Math.pow(2, retryCount - 1)
							: baseDelay;

						await this.sleep(delay);
					} else {
						// Max retries reached or non-retryable error
						const durationMs = Date.now() - startTime;

						const result: BatchEvaluationResult = {
							rowId,
							rowIndex: index,
							input: row,
							results: [],
							...(this.config.calculateCombinedScore && { score: "N/A" as const }),
							timestamp: new Date().toISOString(),
							durationMs,
							retryCount,
							error: errorMessage,
						};

						this.results.push(result);
						this.processedRowIndices.add(index);
						this.progressTracker?.recordFailure(durationMs);

						// Update state
						if (this.stateManager) {
							this.stateManager.update({
								processedRowIndices: Array.from(this.processedRowIndices),
								results: this.results,
								progress: this.progressTracker?.getCurrentProgress(),
							});
						}

						// Stop on error if configured
						if (this.config.stopOnError) {
							throw new Error(`Stopping batch evaluation due to error: ${errorMessage}`);
						}

						return; // Exit retry loop
					}
				}
			}
		});
	}

	/**
	 * Run all evaluators on a single row
	 */
	private async runEvaluators(row: BatchInputRow): Promise<EvaluatorResult[]> {
		const input = {
			candidateText: row.candidateText,
			prompt: row.prompt,
			referenceText: row.referenceText,
			sourceText: row.sourceText,
			contentType: row.contentType,
			language: row.language,
		};

		// Apply timeout if configured
		const timeout = this.config.timeout;
		const evaluateWithTimeout = async (evaluator: IEvaluator) => {
			if (timeout) {
				return Promise.race([
					evaluator.evaluate(input),
					this.timeoutPromise(timeout, `Evaluator ${evaluator.name} timed out after ${timeout}ms`),
				]);
			}
			return evaluator.evaluate(input);
		};

		// Run evaluators in parallel or sequential mode
		if (this.config.evaluatorExecutionMode === "sequential") {
			const results: EvaluatorResult[] = [];
			for (const evaluator of this.evaluators) {
				const result = await evaluateWithTimeout(evaluator);
				results.push(result as EvaluatorResult);
			}
			return results;
		} else {
			// Parallel mode (default)
			const results = await Promise.all(
				this.evaluators.map((evaluator) => evaluateWithTimeout(evaluator)),
			);
			return results as EvaluatorResult[];
		}
	}

	/**
	 * Check if error should be retried
	 * @param errorMessage The error message
	 * @param currentAttempts Number of attempts made so far (0 = first attempt)
	 * @param maxRetries Maximum number of retry attempts allowed
	 * @returns true if should retry, false otherwise
	 */
	private shouldRetry(
		errorMessage: string,
		currentAttempts: number,
		maxRetries: number,
	): boolean {
		// If we've already made the maximum attempts, don't retry
		// currentAttempts starts at 0, so with maxRetries=3:
		// attempt 0 (first try), then retries at 1,2,3 = 4 total attempts
		if (currentAttempts >= maxRetries) {
			return false;
		}

		// Check if error matches retry patterns
		const retryOnErrors = this.config.retryConfig?.retryOnErrors;
		if (retryOnErrors && retryOnErrors.length > 0) {
			return retryOnErrors.some((pattern) => errorMessage.includes(pattern));
		}

		// Default: retry on common transient errors
		const transientErrors = [
			"ECONNRESET",
			"ETIMEDOUT",
			"ENOTFOUND",
			"rate limit",
			"429",
			"503",
			"timeout",
		];
		return transientErrors.some((pattern) =>
			errorMessage.toLowerCase().includes(pattern.toLowerCase()),
		);
	}

	/**
	 * Resume from previous state
	 */
	private resumeFromState(state: BatchState): void {
		this.batchId = state.batchId;
		this.startTime = state.startTime;
		this.results = [...state.results];
		this.processedRowIndices = new Set(state.processedRowIndices);

		if (this.stateManager) {
			this.stateManager.initialize(state);
		}
	}

	/**
	 * Build final result
	 */
	private buildResult(): BatchResult {
		const endTime = new Date().toISOString();
		const durationMs = new Date(endTime).getTime() - new Date(this.startTime).getTime();

		const successfulRows = this.results.filter((r) => !r.error).length;
		const failedRows = this.results.filter((r) => r.error).length;

		// Calculate average processing time
		const processingTimes = this.results.map((r) => r.durationMs);
		const averageProcessingTime =
			processingTimes.length > 0
				? processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length
				: 0;

		// Calculate total tokens
		const totalTokensUsed = this.results.reduce(
			(sum, r) =>
				sum +
				r.results.reduce((rSum, evalResult) => rSum + (evalResult.processingStats.tokenUsage?.totalTokens ?? 0), 0),
			0,
		);

		return {
			batchId: this.batchId,
			startTime: this.startTime,
			endTime,
			durationMs,
			totalRows: this.results.length,
			successfulRows,
			failedRows,
			results: this.results,
			summary: {
				averageProcessingTime,
				totalTokensUsed: totalTokensUsed > 0 ? totalTokensUsed : undefined,
				errorRate: this.results.length > 0 ? failedRows / this.results.length : 0,
			},
		};
	}

	/**
	 * Create a timeout promise
	 */
	private timeoutPromise<T>(ms: number, message: string): Promise<T> {
		return new Promise((_, reject) => {
			setTimeout(() => reject(new Error(message)), ms);
		});
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get current batch state (useful for debugging or manual state saves)
	 */
	getCurrentState(): BatchState | undefined {
		return this.stateManager?.getState();
	}

	/**
	 * Get current results (useful for streaming results)
	 */
	getCurrentResults(): BatchEvaluationResult[] {
		return [...this.results];
	}
}
