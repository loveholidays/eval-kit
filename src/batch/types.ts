import type { Evaluator } from "../evaluators/evaluator.js";
import type {
	EvaluationInput,
	EvaluatorResult,
} from "../types/evaluator.js";

/**
 * Represents a single row of input data
 */
export interface BatchInputRow extends EvaluationInput {
	id?: string;
	[key: string]: unknown; // Allow additional metadata fields
}

/**
 * Represents a single evaluation result with metadata
 */
export interface BatchEvaluationResult {
	readonly rowId: string;
	readonly rowIndex: number;
	readonly input: BatchInputRow;
	readonly results: EvaluatorResult[];
	readonly timestamp: string;
	readonly durationMs: number;
	readonly retryCount: number;
	readonly error?: string;
}

/**
 * Configuration for BatchEvaluator
 */
export interface BatchEvaluatorConfig {
	// Evaluators to run on each input
	readonly evaluators: Evaluator[];

	// Concurrency control
	readonly concurrency?: number; // Default: 5
	readonly evaluatorExecutionMode?: "parallel" | "sequential"; // Default: 'parallel'
	readonly rateLimit?: {
		readonly maxRequestsPerMinute?: number;
		readonly maxRequestsPerHour?: number;
	};

	// Error handling
	readonly retryConfig?: {
		readonly maxRetries?: number; // Default: 3
		readonly retryDelay?: number; // Default: 1000ms
		readonly exponentialBackoff?: boolean; // Default: true
		readonly retryOnErrors?: string[]; // Specific error messages to retry
	};

	// Progress tracking
	readonly onProgress?: (event: ProgressEvent) => void | Promise<void>;
	readonly progressInterval?: number; // Default: 1000ms

	// Result streaming
	readonly onResult?: (result: BatchEvaluationResult) => void | Promise<void>;
	readonly streamExport?: BatchExportConfig; // Export each result as it completes

	// State management
	readonly resumeFromState?: BatchState;
	readonly saveStateInterval?: number; // Auto-save interval in ms
	readonly onStateSave?: (state: BatchState) => void | Promise<void>;

	// Execution mode
	readonly stopOnError?: boolean; // Default: false
	readonly timeout?: number; // Per-evaluation timeout
}

/**
 * Input configuration
 */
export interface BatchInputConfig {
	readonly filePath: string;
	readonly format?: "csv" | "json" | "auto"; // Default: 'auto' (detect from extension)

	// CSV-specific options
	readonly csvOptions?: {
		readonly delimiter?: string; // Default: ','
		readonly quote?: string; // Default: '"'
		readonly escape?: string; // Default: '"'
		readonly headers?: boolean; // Default: true
		readonly skipEmptyLines?: boolean; // Default: true
		readonly encoding?: BufferEncoding; // Default: 'utf-8'
	};

	// JSON-specific options
	readonly jsonOptions?: {
		readonly arrayPath?: string; // JSONPath to array (e.g., 'data.items')
		readonly encoding?: BufferEncoding; // Default: 'utf-8'
	};

	// Field mapping (map file columns to EvaluationInput fields)
	readonly fieldMapping?: {
		readonly candidateText: string; // Required
		readonly prompt?: string;
		readonly referenceText?: string;
		readonly sourceText?: string;
		readonly contentType?: string;
		readonly language?: string;
		readonly id?: string; // Optional row identifier
	};
}

/**
 * Export configuration
 */
export interface BatchExportConfig {
	readonly format: "csv" | "json" | "webhook";
	readonly destination: string; // File path or webhook URL

	// CSV export options
	readonly csvOptions?: {
		readonly delimiter?: string;
		readonly includeHeaders?: boolean;
		readonly flattenResults?: boolean; // Flatten nested objects
	};

	// JSON export options
	readonly jsonOptions?: {
		readonly pretty?: boolean;
		readonly includeMetadata?: boolean;
	};

	// Webhook options
	readonly webhookOptions?: {
		readonly method?: "POST" | "PUT"; // Default: 'POST'
		readonly headers?: Record<string, string>;
		readonly batchSize?: number; // Send results in batches
		readonly retryOnFailure?: boolean;
		readonly timeout?: number;
	};

	// Export filtering
	readonly includeFields?: string[]; // Only include specific fields
	readonly excludeFields?: string[]; // Exclude specific fields
	readonly filterCondition?: (result: BatchEvaluationResult) => boolean;
}

/**
 * Progress event types
 */
export type ProgressEventType =
	| "started"
	| "progress"
	| "completed"
	| "error"
	| "retry"
	| "paused"
	| "resumed";

/**
 * Progress event
 */
export interface ProgressEvent {
	readonly type: ProgressEventType;
	readonly timestamp: string;
	readonly totalRows: number;
	readonly processedRows: number;
	readonly successfulRows: number;
	readonly failedRows: number;
	readonly currentRow?: number;
	readonly percentComplete: number;
	readonly estimatedTimeRemaining?: number; // milliseconds
	readonly averageProcessingTime?: number; // milliseconds per row
	readonly currentError?: string;
	readonly retryCount?: number;
	readonly estimatedCostUSD?: number; // Running total
	readonly estimatedTokensRemaining?: number;
}

/**
 * Batch execution state for resume capability
 */
export interface BatchState {
	readonly batchId: string;
	readonly startTime: string;
	readonly lastUpdateTime: string;
	readonly inputConfig: BatchInputConfig;
	readonly evaluatorNames: string[];
	readonly totalRows: number;
	readonly processedRowIndices: number[];
	readonly results: BatchEvaluationResult[];
	readonly progress: ProgressEvent;
}

/**
 * Batch execution result
 */
export interface BatchResult {
	readonly batchId: string;
	readonly startTime: string;
	readonly endTime: string;
	readonly durationMs: number;
	readonly totalRows: number;
	readonly successfulRows: number;
	readonly failedRows: number;
	readonly results: BatchEvaluationResult[];
	readonly summary: {
		readonly averageScores: Record<string, number | string>; // Per evaluator
		readonly averageProcessingTime: number;
		readonly totalTokensUsed?: number;
		readonly errorRate: number;
	};
}
