/**
 * eval-kit: TypeScript SDK for content evaluation
 *
 * A lightweight SDK for evaluating content quality.
 */

// BERT score and perplexity use @xenova/transformers which requires sharp.
// Re-export types only; functions must be imported directly from submodules.
export type {
	BertScoreOptions,
	BertScoreResult,
} from "./metrics/bert-score.js";
// Metrics
export {
	type BleuOptions,
	type BleuResult,
	calculateBleu,
} from "./metrics/bleu.js";
export {
	type CoherenceOptions,
	type CoherenceResult,
	calculateCoherence,
} from "./metrics/coherence.js";
export type {
	PerplexityOptions,
	PerplexityResult,
} from "./metrics/perplexity.js";
export {
	calculateTer,
	type TerOptions,
	type TerResult,
} from "./metrics/ter.js";

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

// Batch Evaluation
export { BatchEvaluator } from "./batch/batch-evaluator.js";
export type {
	BatchEvaluationResult,
	BatchEvaluatorConfig,
	BatchExportConfig,
	BatchInputConfig,
	BatchInputRow,
	BatchResult,
	ProgressEvent,
	ProgressEventType,
} from "./batch/types.js";
// Evaluator
export { Evaluator } from "./evaluators/evaluator.js";
export type {
	CategoricalScoreConfig,
	EvaluationInput,
	EvaluatorConfig,
	EvaluatorResult,
	IEvaluator,
	NumericScoreConfig,
	ProcessingStats,
	ScoreConfig,
	TemplateVariable,
	TokenUsage,
} from "./types/evaluator.js";
export {
	calculateNgramPrecision,
	countNgrams,
	generateNgrams,
} from "./utils/ngram.js";
export { cosineSimilarity } from "./utils/similarity.js";
// Evaluator Utilities
export { TemplateRenderer } from "./utils/template-engine.js";
export { calculateIDF, calculateTFIDF } from "./utils/tfidf.js";
// Utilities
export { tokenizeSentences, tokenizeWords } from "./utils/tokenization.js";
