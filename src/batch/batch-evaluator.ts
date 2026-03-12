import { randomUUID } from "node:crypto";
import {
	type EvalKitSpan,
	getCachedTracer,
	SpanStatusCode,
	withSpan,
} from "../telemetry.js";
import type { EvaluatorResult, IEvaluator } from "../types/evaluator.js";
import { ConcurrencyManager } from "./concurrency-manager.js";
import { CsvExporter } from "./exporters/csv-exporter.js";
import { JsonExporter } from "./exporters/json-exporter.js";
import { CsvParser } from "./parsers/csv-parser.js";
import { JsonParser } from "./parsers/json-parser.js";
import { ProgressTracker } from "./progress-tracker.js";
import type {
	BatchEvaluationResult,
	BatchEvaluatorConfig,
	BatchExportConfig,
	BatchInputConfig,
	BatchInputFileConfig,
	BatchInputRow,
	BatchResult,
} from "./types.js";

export class BatchEvaluator {
	private readonly config: BatchEvaluatorConfig;
	private readonly evaluators: IEvaluator[];
	private readonly concurrencyManager: ConcurrencyManager;
	private progressTracker?: ProgressTracker;
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
	}

	/**
	 * Run batch evaluation on input data
	 */
	async evaluate(inputConfig: BatchInputConfig): Promise<BatchResult> {
		return withSpan(
			"eval-kit.batch.evaluate",
			{
				attributes: {
					"eval_kit.batch.id": this.batchId,
					"eval_kit.batch.concurrency": this.config.concurrency ?? 5,
					"eval_kit.batch.execution_mode":
						this.config.evaluatorExecutionMode ?? "parallel",
				},
			},
			async (span) => {
				// Parse input
				const allRows = await this.parseInput(inputConfig);

				span.setAttribute("eval_kit.batch.total_rows", allRows.length);

				// Handle startIndex for resuming from a specific position
				const startIndex = inputConfig.startIndex ?? 0;
				const rows = startIndex > 0 ? allRows.slice(startIndex) : allRows;

				// Mark rows before startIndex as already processed (for accurate progress tracking)
				for (let i = 0; i < startIndex; i++) {
					this.processedRowIndices.add(i);
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

				// Return results
				const result = this.buildResult();
				span.setAttribute(
					"eval_kit.batch.successful_rows",
					result.successfulRows,
				);
				span.setAttribute("eval_kit.batch.failed_rows", result.failedRows);
				return result;
			},
		);
	}

	/**
	 * Export results to a destination
	 */
	async export(exportConfig: BatchExportConfig): Promise<void> {
		return withSpan(
			"eval-kit.batch.export",
			{
				attributes: {
					"eval_kit.export.format": exportConfig.format,
					"eval_kit.export.row_count": this.results.length,
				},
			},
			async () => {
				const exporter = this.getExporter(exportConfig.format);
				await exporter.export(this.results, exportConfig);
			},
		);
	}

	/**
	 * Parse input - supports both file-based and in-memory data
	 */
	private async parseInput(config: BatchInputConfig): Promise<BatchInputRow[]> {
		// In-memory data — no I/O, skip span
		if ("data" in config) {
			return config.data;
		}

		// File-based config — actual I/O worth tracing
		return withSpan(
			"eval-kit.batch.parse_input",
			{
				attributes: {
					"eval_kit.parse.input_format": "file",
				},
			},
			async (span) => {
				const fileConfig = config as BatchInputFileConfig;
				let format = fileConfig.format;

				// Handle "auto" format detection
				if (!format || format === "auto") {
					format = this.detectFormat(fileConfig.filePath);
				}

				const parser = this.getParser(format);
				const rows = await parser.parse(fileConfig);

				span.setAttribute("eval_kit.parse.row_count", rows.length);
				return rows;
			},
		);
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
	private getExporter(format: "csv" | "json"): CsvExporter | JsonExporter {
		switch (format) {
			case "csv":
				return new CsvExporter();
			case "json":
				return new JsonExporter();
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
			const tracer = getCachedTracer();

			await tracer.startActiveSpan(
				"eval-kit.batch.process_row",
				{
					attributes: { "eval_kit.row.id": rowId, "eval_kit.row.index": index },
				},
				(span: EvalKitSpan) => this.runRowWithSpan(row, index, span),
			);
		});
	}

	private async runRowWithSpan(
		row: BatchInputRow,
		index: number,
		span: EvalKitSpan,
	): Promise<void> {
		const startTime = Date.now();
		let spanError: string | undefined;
		const inputData = { ...this.config.defaultInput, ...row };
		const rowId = row.id ?? `row-${index}`;

		try {
			await this.executeRowWithRetry({
				inputData,
				row,
				index,
				rowId,
				span,
				startTime,
			});
		} catch (error) {
			spanError = error instanceof Error ? error.message : String(error);
			span.recordException(error instanceof Error ? error : spanError);
		} finally {
			span.setAttribute("eval_kit.row.duration_ms", Date.now() - startTime);
			if (spanError) {
				span.setAttribute("eval_kit.result.error", spanError);
				span.setStatus({ code: SpanStatusCode.ERROR, message: spanError });
			} else {
				span.setStatus({ code: SpanStatusCode.OK });
			}
			span.end();
		}
	}

	private async executeRowWithRetry(ctx: {
		inputData: BatchInputRow;
		row: BatchInputRow;
		index: number;
		rowId: string;
		span: EvalKitSpan;
		startTime: number;
	}): Promise<void> {
		let retryCount = 0;
		const maxRetries = this.config.retryConfig?.maxRetries ?? 3;
		let lastError: unknown;

		while (true) {
			try {
				await this.executeRowEvaluation({ ...ctx, retryCount });
				ctx.span.setAttribute("eval_kit.row.retry_count", retryCount);
				return;
			} catch (error) {
				lastError = error;
				const errorCtx = {
					error,
					span: ctx.span,
					startTime: ctx.startTime,
					retryCount,
					maxRetries,
					rowId: ctx.rowId,
					index: ctx.index,
					row: ctx.row,
				};
				const shouldRetry = await this.handleRowError(errorCtx);
				if (!shouldRetry) {
					ctx.span.setAttribute("eval_kit.row.retry_count", retryCount);
					throw lastError;
				}
				retryCount++;
			}
		}
	}

	private async handleRowError(ctx: {
		error: unknown;
		span: EvalKitSpan;
		startTime: number;
		retryCount: number;
		maxRetries: number;
		rowId: string;
		index: number;
		row: BatchInputRow;
	}): Promise<boolean> {
		const errorMessage =
			ctx.error instanceof Error ? ctx.error.message : String(ctx.error);
		const shouldRetry = this.shouldRetry(
			errorMessage,
			ctx.retryCount,
			ctx.maxRetries,
		);

		if (shouldRetry) {
			const nextAttempt = ctx.retryCount + 1;
			this.progressTracker?.recordRetry(errorMessage, nextAttempt);
			const delay = this.calculateRetryDelay(nextAttempt);

			ctx.span.addEvent("retry", {
				"eval_kit.retry.attempt": nextAttempt,
				"eval_kit.retry.delay_ms": delay,
				"eval_kit.retry.error": errorMessage,
			});

			await this.sleep(delay);
			return true;
		}

		const durationMs = Date.now() - ctx.startTime;
		const result: BatchEvaluationResult = {
			rowId: ctx.rowId,
			rowIndex: ctx.index,
			input: ctx.row,
			results: [],
			timestamp: new Date().toISOString(),
			durationMs,
			retryCount: ctx.retryCount,
			error: errorMessage,
		};

		await this.emitResult(result);
		this.processedRowIndices.add(ctx.index);
		this.progressTracker?.recordFailure(durationMs);

		if (this.config.stopOnError) {
			throw new Error(
				`Stopping batch evaluation due to error: ${errorMessage}`,
			);
		}

		return false;
	}

	private calculateRetryDelay(attempt: number): number {
		const baseDelay = this.config.retryConfig?.retryDelay ?? 1000;
		return this.config.retryConfig?.exponentialBackoff
			? baseDelay * 2 ** (attempt - 1)
			: baseDelay;
	}

	private async emitResult(result: BatchEvaluationResult): Promise<void> {
		const callbackResult = this.config.onResult?.(result);
		if (callbackResult instanceof Promise) {
			await callbackResult;
		}
		this.results.push(result);
	}

	private async executeRowEvaluation(ctx: {
		inputData: BatchInputRow;
		index: number;
		rowId: string;
		startTime: number;
		retryCount: number;
	}): Promise<void> {
		const evaluatorResults = await this.runEvaluators(ctx.inputData);
		const durationMs = Date.now() - ctx.startTime;
		const tokensUsed = evaluatorResults.reduce(
			(sum, r) => sum + (r.processingStats.tokenUsage?.totalTokens ?? 0),
			0,
		);

		const result: BatchEvaluationResult = {
			rowId: ctx.rowId,
			rowIndex: ctx.index,
			input: ctx.inputData,
			results: evaluatorResults,
			timestamp: new Date().toISOString(),
			durationMs,
			retryCount: ctx.retryCount,
		};

		await this.emitResult(result);
		this.processedRowIndices.add(ctx.index);
		this.progressTracker?.recordSuccess(durationMs, tokensUsed);
	}

	/**
	 * Run all evaluators on a single row
	 */
	private async runEvaluators(row: BatchInputRow): Promise<EvaluatorResult[]> {
		return withSpan(
			"eval-kit.batch.run_evaluators",
			{
				attributes: {
					"eval_kit.evaluator_count": this.evaluators.length,
					"eval_kit.execution_mode":
						this.config.evaluatorExecutionMode ?? "parallel",
				},
			},
			async () => {
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
							this.timeoutPromise(
								timeout,
								`Evaluator ${evaluator.name} timed out after ${timeout}ms`,
							),
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
				}
				// Parallel mode (default)
				const results = await Promise.all(
					this.evaluators.map((evaluator) => evaluateWithTimeout(evaluator)),
				);
				return results as EvaluatorResult[];
			},
		);
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
	 * Build final result
	 */
	private buildResult(): BatchResult {
		const endTime = new Date().toISOString();
		const durationMs =
			new Date(endTime).getTime() - new Date(this.startTime).getTime();

		const successfulRows = this.results.filter((r) => !r.error).length;
		const failedRows = this.results.filter((r) => r.error).length;

		// Calculate average processing time
		const processingTimes = this.results.map((r) => r.durationMs);
		const averageProcessingTime =
			processingTimes.length > 0
				? processingTimes.reduce((sum, t) => sum + t, 0) /
					processingTimes.length
				: 0;

		// Calculate total tokens
		const totalTokensUsed = this.results.reduce(
			(sum, r) =>
				sum +
				r.results.reduce(
					(rSum, evalResult) =>
						rSum + (evalResult.processingStats.tokenUsage?.totalTokens ?? 0),
					0,
				),
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
				errorRate:
					this.results.length > 0 ? failedRows / this.results.length : 0,
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
	 * Get current results (useful for streaming results)
	 */
	getCurrentResults(): BatchEvaluationResult[] {
		return [...this.results];
	}
}
