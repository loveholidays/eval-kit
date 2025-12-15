export interface ConcurrencyConfig {
	readonly maxConcurrency: number;
	readonly rateLimit?: {
		readonly maxRequestsPerMinute?: number;
		readonly maxRequestsPerHour?: number;
	};
}

export class ConcurrencyManager {
	private readonly maxConcurrency: number;
	private readonly rateLimit?: ConcurrencyConfig["rateLimit"];
	private activeCount = 0;
	private queue: Array<() => void> = [];
	private requestTimestamps: number[] = [];
	private readonly MAX_TIMESTAMP_AGE = 3600000; // 1 hour - cleanup threshold

	constructor(config: ConcurrencyConfig) {
		this.maxConcurrency = config.maxConcurrency;
		this.rateLimit = config.rateLimit;
	}

	/**
	 * Execute a task with concurrency control and rate limiting
	 */
	async run<T>(task: () => Promise<T>): Promise<T> {
		// Wait for available slot
		await this.waitForSlot();

		// Check rate limit
		await this.checkRateLimit();

		this.activeCount++;
		this.requestTimestamps.push(Date.now());

		// Periodically cleanup old timestamps to prevent memory leak
		this.cleanupOldTimestamps();

		try {
			return await task();
		} finally {
			this.activeCount--;
			this.processQueue();
		}
	}

	/**
	 * Wait for an available concurrency slot
	 */
	private async waitForSlot(): Promise<void> {
		if (this.activeCount < this.maxConcurrency) {
			return;
		}

		return new Promise<void>((resolve) => {
			this.queue.push(resolve);
		});
	}

	/**
	 * Check and enforce rate limits
	 */
	private async checkRateLimit(): Promise<void> {
		if (!this.rateLimit) return;

		const now = Date.now();

		// Check per-minute limit
		if (this.rateLimit.maxRequestsPerMinute) {
			const recentRequests = this.requestTimestamps.filter(
				(ts) => now - ts < 60000,
			);

			if (recentRequests.length >= this.rateLimit.maxRequestsPerMinute) {
				const oldestRequest = Math.min(...recentRequests);
				const waitTime = 60000 - (now - oldestRequest) + 100; // Add 100ms buffer
				await this.sleep(waitTime);
			}
		}

		// Check per-hour limit
		if (this.rateLimit.maxRequestsPerHour) {
			const recentRequests = this.requestTimestamps.filter(
				(ts) => now - ts < 3600000,
			);

			if (recentRequests.length >= this.rateLimit.maxRequestsPerHour) {
				const oldestRequest = Math.min(...recentRequests);
				const waitTime = 3600000 - (now - oldestRequest) + 100; // Add 100ms buffer
				await this.sleep(waitTime);
			}
		}

		// Clean up old timestamps (keep only last hour)
		this.requestTimestamps = this.requestTimestamps.filter(
			(ts) => now - ts < 3600000,
		);
	}

	/**
	 * Process the next item in the queue
	 * Checks capacity again after dequeuing to avoid race conditions
	 */
	private processQueue(): void {
		// Check if we have capacity before dequeuing
		if (this.activeCount < this.maxConcurrency) {
			const next = this.queue.shift();
			// Check capacity again after dequeuing to handle race conditions
			if (next) {
				if (this.activeCount < this.maxConcurrency) {
					next();
				} else {
					// No capacity available, put it back at the front
					this.queue.unshift(next);
				}
			}
		}
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Cleanup old timestamps to prevent memory leak
	 * Removes timestamps older than MAX_TIMESTAMP_AGE
	 */
	private cleanupOldTimestamps(): void {
		// Only cleanup if rate limiting is enabled and we have timestamps
		if (!this.rateLimit || this.requestTimestamps.length === 0) {
			return;
		}

		const now = Date.now();
		const cutoff = now - this.MAX_TIMESTAMP_AGE;

		// Keep only timestamps within the last hour
		this.requestTimestamps = this.requestTimestamps.filter(
			(ts) => ts >= cutoff,
		);
	}

	/**
	 * Get current active count
	 */
	getActiveCount(): number {
		return this.activeCount;
	}

	/**
	 * Get queue length
	 */
	getQueueLength(): number {
		return this.queue.length;
	}
}
