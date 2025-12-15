import type { ProgressEvent, ProgressEventType } from "./types.js";

export interface ProgressTrackerConfig {
	readonly totalRows: number;
	readonly emitInterval?: number; // milliseconds
	readonly onProgress?: (event: ProgressEvent) => void | Promise<void>;
}

export class ProgressTracker {
	private readonly totalRows: number;
	private readonly emitInterval: number;
	private readonly onProgress?: (event: ProgressEvent) => void | Promise<void>;

	private processedRows = 0;
	private successfulRows = 0;
	private failedRows = 0;
	private startTime: number = 0;
	private processingTimes: number[] = [];
	private lastEmitTime = 0;
	private totalTokens = 0;

	constructor(config: ProgressTrackerConfig) {
		this.totalRows = config.totalRows;
		this.emitInterval = config.emitInterval ?? 1000;
		this.onProgress = config.onProgress;
	}

	/**
	 * Start tracking progress
	 */
	start(): void {
		this.startTime = Date.now();
		this.emit("started");
	}

	/**
	 * Record a successful evaluation
	 */
	recordSuccess(durationMs: number, tokensUsed?: number): void {
		this.processedRows++;
		this.successfulRows++;
		this.processingTimes.push(durationMs);
		if (tokensUsed) {
			this.totalTokens += tokensUsed;
		}
		this.maybeEmit("progress");
	}

	/**
	 * Record a failed evaluation
	 */
	recordFailure(durationMs: number): void {
		this.processedRows++;
		this.failedRows++;
		this.processingTimes.push(durationMs);
		this.maybeEmit("progress");
	}

	/**
	 * Record a retry attempt
	 */
	recordRetry(error: string, retryCount: number): void {
		this.emit("retry", { currentError: error, retryCount });
	}

	/**
	 * Mark completion
	 */
	complete(): void {
		this.emit("completed");
	}

	/**
	 * Pause tracking
	 */
	pause(): void {
		this.emit("paused");
	}

	/**
	 * Resume tracking
	 */
	resume(): void {
		this.emit("resumed");
	}

	/**
	 * Skip rows (for resuming from a specific index)
	 * This marks rows as processed without actually processing them
	 */
	skipRows(count: number): void {
		this.processedRows += count;
		this.successfulRows += count; // Assume skipped rows were successful in previous run
	}

	/**
	 * Emit if interval has passed
	 */
	private maybeEmit(
		type: ProgressEventType,
		extra?: Partial<ProgressEvent>,
	): void {
		const now = Date.now();
		if (now - this.lastEmitTime >= this.emitInterval) {
			this.emit(type, extra);
			this.lastEmitTime = now;
		}
	}

	/**
	 * Emit progress event
	 */
	private emit(type: ProgressEventType, extra?: Partial<ProgressEvent>): void {
		if (!this.onProgress) return;

		const avgProcessingTime =
			this.processingTimes.length > 0
				? this.processingTimes.reduce((a, b) => a + b, 0) /
					this.processingTimes.length
				: 0;

		const remainingRows = this.totalRows - this.processedRows;
		const estimatedTimeRemaining =
			remainingRows > 0 && avgProcessingTime > 0
				? remainingRows * avgProcessingTime
				: undefined;

		// Estimate cost (simplified - assumes ~1000 tokens per evaluation at $0.50 per 1M tokens)
		const estimatedTokensRemaining = remainingRows * 1000;
		const estimatedCostUSD = (this.totalTokens / 1_000_000) * 0.5;

		const event: ProgressEvent = {
			type,
			timestamp: new Date().toISOString(),
			totalRows: this.totalRows,
			processedRows: this.processedRows,
			successfulRows: this.successfulRows,
			failedRows: this.failedRows,
			percentComplete: (this.processedRows / this.totalRows) * 100,
			averageProcessingTime:
				avgProcessingTime > 0 ? avgProcessingTime : undefined,
			estimatedTimeRemaining,
			estimatedCostUSD,
			estimatedTokensRemaining,
			...extra,
		};

		// Handle async onProgress
		const result = this.onProgress(event);
		if (result instanceof Promise) {
			result.catch((error) => {
				console.error("Error in progress callback:", error);
			});
		}
	}

	/**
	 * Get current progress without emitting
	 */
	getCurrentProgress(): ProgressEvent {
		const avgProcessingTime =
			this.processingTimes.length > 0
				? this.processingTimes.reduce((a, b) => a + b, 0) /
					this.processingTimes.length
				: 0;

		const remainingRows = this.totalRows - this.processedRows;
		const estimatedTimeRemaining =
			remainingRows > 0 && avgProcessingTime > 0
				? remainingRows * avgProcessingTime
				: undefined;

		const estimatedTokensRemaining = remainingRows * 1000;
		const estimatedCostUSD = (this.totalTokens / 1_000_000) * 0.5;

		return {
			type: "progress",
			timestamp: new Date().toISOString(),
			totalRows: this.totalRows,
			processedRows: this.processedRows,
			successfulRows: this.successfulRows,
			failedRows: this.failedRows,
			percentComplete: (this.processedRows / this.totalRows) * 100,
			averageProcessingTime:
				avgProcessingTime > 0 ? avgProcessingTime : undefined,
			estimatedTimeRemaining,
			estimatedCostUSD,
			estimatedTokensRemaining,
		};
	}
}
