/**
 * eval-kit: TypeScript SDK for content evaluation
 *
 * A lightweight SDK for evaluating content quality.
 */

// Metrics
export {
	calculateBleu,
	type BleuOptions,
	type BleuResult,
} from "./metrics/bleu.js";

export {
	calculateTer,
	type TerOptions,
	type TerResult,
} from "./metrics/ter.js";

// BERT score and perplexity use @xenova/transformers which requires sharp.
// Re-export types only; functions must be imported directly from submodules.
export type {
	BertScoreOptions,
	BertScoreResult,
} from "./metrics/bert-score.js";

export {
	calculateCoherence,
	type CoherenceOptions,
	type CoherenceResult,
} from "./metrics/coherence.js";

export type {
	PerplexityOptions,
	PerplexityResult,
} from "./metrics/perplexity.js";

// Lazy loaders for heavy metrics (avoid loading sharp at import time)
export async function loadBertScore() {
	const mod = await import("./metrics/bert-score.js");
	return {
		calculateBertScore: mod.calculateBertScore,
		clearBertCache: mod.clearBertCache,
	};
}

export async function loadPerplexity() {
	const mod = await import("./metrics/perplexity.js");
	return {
		calculatePerplexity: mod.calculatePerplexity,
		clearPerplexityCache: mod.clearPerplexityCache,
	};
}

// Evaluator
export { Evaluator } from "./evaluators/evaluator.js";
export type {
	EvaluatorConfig,
	EvaluatorResult,
	EvaluationInput,
	ScoreConfig,
	NumericScoreConfig,
	CategoricalScoreConfig,
	TokenUsage,
	ProcessingStats,
	TemplateVariable,
	IEvaluator,
} from "./types/evaluator.js";

// Evaluator Utilities
export { TemplateRenderer } from "./utils/template-engine.js";

// Batch Evaluation
export { BatchEvaluator } from "./batch/batch-evaluator.js";
export type {
	BatchEvaluatorConfig,
	BatchInputConfig,
	BatchExportConfig,
	BatchInputRow,
	BatchEvaluationResult,
	BatchResult,
	ProgressEvent,
	ProgressEventType,
} from "./batch/types.js";

// Utilities
export { tokenizeWords, tokenizeSentences } from "./utils/tokenization.js";
export {
	generateNgrams,
	countNgrams,
	calculateNgramPrecision,
} from "./utils/ngram.js";
export { calculateIDF, calculateTFIDF } from "./utils/tfidf.js";
export { cosineSimilarity } from "./utils/similarity.js";
