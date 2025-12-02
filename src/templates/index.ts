/**
 * Pre-built evaluation templates for common use cases
 *
 * @module templates
 */

export {
	createTranslationEvaluator,
	createTranslationAdequacyEvaluator,
	createTranslationFluencyEvaluator,
	type TranslationEvaluatorOptions,
	type TranslationEvaluatorResult,
} from "./translation.js";

export {
	createAIContentEvaluator,
	createRelevanceEvaluator,
	createFactualityEvaluator,
	createSafetyEvaluator,
	createToneEvaluator,
	type AIContentEvaluatorOptions,
} from "./ai-content.js";
