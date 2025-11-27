/**
 * eval-kit: TypeScript SDK for content evaluation
 *
 * A lightweight, dependency-minimal SDK for evaluating translation quality
 * and text similarity using industry-standard metrics.
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

// Utilities
export { tokenizeWords, tokenizeSentences } from "./utils/tokenization.js";
export {
	generateNgrams,
	countNgrams,
	calculateNgramPrecision,
} from "./utils/ngram.js";
