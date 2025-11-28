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

export {
	calculateBertScore,
	clearBertCache,
	type BertScoreOptions,
	type BertScoreResult,
} from "./metrics/bert-score.js";

export {
	calculateCoherence,
	type CoherenceOptions,
	type CoherenceResult,
} from "./metrics/coherence.js";

export {
	calculatePerplexity,
	clearPerplexityCache,
	type PerplexityOptions,
	type PerplexityResult,
} from "./metrics/perplexity.js";

// Utilities
export { tokenizeWords, tokenizeSentences } from "./utils/tokenization.js";
export {
	generateNgrams,
	countNgrams,
	calculateNgramPrecision,
} from "./utils/ngram.js";
export { calculateIDF, calculateTFIDF } from "./utils/tfidf.js";
export { cosineSimilarity } from "./utils/similarity.js";
