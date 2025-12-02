import type { LanguageModel } from "ai";
import { Evaluator } from "../evaluators/evaluator.js";
import type { EvaluatorConfig } from "../types/evaluator.js";

/**
 * Translation Quality Evaluation Template
 *
 * Evaluates translation quality across multiple dimensions:
 * - Accuracy: Semantic correctness and completeness
 * - Fluency: Natural expression in target language
 * - Grammar: Grammatical correctness
 * - Terminology: Appropriate domain-specific terms
 * - Style: Maintaining tone and register
 *
 * @example
 * ```typescript
 * import { anthropic } from "@ai-sdk/anthropic";
 * import { createTranslationEvaluator } from "eval-kit/templates";
 *
 * const evaluator = createTranslationEvaluator({
 *   model: anthropic("claude-3-5-haiku-20241022"),
 *   targetLanguage: "French",
 * });
 *
 * const result = await evaluator.evaluate({
 *   candidateText: "Bonjour le monde",
 *   referenceText: "Hello world",
 *   sourceText: "Hello world",
 * });
 * ```
 */

export interface TranslationEvaluatorOptions {
	/**
	 * The language model to use for evaluation
	 */
	model: LanguageModel;

	/**
	 * Target language (e.g., "French", "Spanish", "German")
	 */
	targetLanguage: string;

	/**
	 * Source language (optional, e.g., "English", "Spanish")
	 * If not provided, will be detected automatically
	 */
	sourceLanguage?: string;

	/**
	 * Evaluation criteria weights (optional)
	 * Each value should be between 0 and 1
	 * Default: all criteria weighted equally
	 */
	weights?: {
		accuracy?: number; // Default: 0.35
		fluency?: number; // Default: 0.25
		grammar?: number; // Default: 0.15
		terminology?: number; // Default: 0.15
		style?: number; // Default: 0.10
	};

	/**
	 * Score range configuration (optional)
	 * Default: 0-100
	 */
	scoreConfig?: {
		min?: number;
		max?: number;
	};

	/**
	 * Model-specific settings (optional)
	 */
	modelSettings?: EvaluatorConfig["modelSettings"];
}

/**
 * Creates a translation quality evaluator
 *
 * @param options - Configuration options
 * @returns A configured Evaluator instance
 */
export function createTranslationEvaluator(
	options: TranslationEvaluatorOptions,
): Evaluator {
	const {
		model,
		targetLanguage,
		sourceLanguage,
		weights = {},
		scoreConfig = {},
		modelSettings,
	} = options;

	// Normalize weights
	const w = {
		accuracy: weights.accuracy ?? 0.35,
		fluency: weights.fluency ?? 0.25,
		grammar: weights.grammar ?? 0.15,
		terminology: weights.terminology ?? 0.15,
		style: weights.style ?? 0.1,
	};

	// Validate weights sum to approximately 1.0
	const totalWeight = Object.values(w).reduce((sum, val) => sum + val, 0);
	if (Math.abs(totalWeight - 1) > 0.01) {
		console.warn(
			`[eval-kit] Translation evaluator weights sum to ${totalWeight.toFixed(2)}, expected 1.0. ` +
				"Scores may not reflect intended criteria importance.",
		);
	}

	const minScore = scoreConfig.min ?? 0;
	const maxScore = scoreConfig.max ?? 100;

	const evaluationPrompt = `You are an expert translation quality evaluator${sourceLanguage ? ` specializing in ${sourceLanguage} to ${targetLanguage} translation` : ` for ${targetLanguage}`}.

# Task
Evaluate the quality of the translation below.

# Input
${sourceLanguage ? `Source Language: ${sourceLanguage}` : ""}
Target Language: ${targetLanguage}

{{#if sourceText}}Source Text: {{sourceText}}{{/if}}
Translation: {{candidateText}}
{{#if referenceText}}Reference Translation: {{referenceText}}{{/if}}
{{#if prompt}}Context: {{prompt}}{{/if}}

# Evaluation Criteria

Assess the translation on these dimensions:

1. **Accuracy (${(w.accuracy * 100).toFixed(0)}%)**: Does the translation convey the same meaning as the source? Are there any omissions, additions, or mistranslations?

2. **Fluency (${(w.fluency * 100).toFixed(0)}%)**: Does the translation read naturally in ${targetLanguage}? Is it idiomatic and easy to understand?

3. **Grammar (${(w.grammar * 100).toFixed(0)}%)**: Is the translation grammatically correct? Are there any errors in syntax, morphology, or punctuation?

4. **Terminology (${(w.terminology * 100).toFixed(0)}%)**: Are domain-specific terms and concepts translated appropriately? Is terminology consistent?

5. **Style (${(w.style * 100).toFixed(0)}%)**: Does the translation maintain the appropriate tone, register, and style of the source?

# Instructions

Provide:
1. A detailed evaluation covering each criterion
2. Specific examples of strengths and weaknesses
3. Suggestions for improvement if applicable
4. An overall score from ${minScore} to ${maxScore}

${
	options.weights
		? "\nNote: The score should reflect the weighted importance of each criterion as indicated above."
		: ""
}`;

	return new Evaluator({
		name: `translation-quality-${targetLanguage.toLowerCase().replace(/\s+/g, "-")}`,
		model,
		evaluationPrompt,
		scoreConfig: {
			type: "numeric",
			min: minScore,
			max: maxScore,
			float: true,
		},
		modelSettings: {
			temperature: 0.3, // Lower temperature for more consistent evaluation
			...modelSettings,
		},
	});
}

/**
 * Creates a translation adequacy evaluator (semantic accuracy only)
 *
 * Focuses solely on whether the translation conveys the same meaning
 * as the source, ignoring fluency and style.
 *
 * @param options - Configuration options
 * @returns A configured Evaluator instance
 */
export function createTranslationAdequacyEvaluator(
	options: Omit<TranslationEvaluatorOptions, "weights">,
): Evaluator {
	const {
		model,
		targetLanguage,
		sourceLanguage,
		scoreConfig = {},
		modelSettings,
	} = options;

	const minScore = scoreConfig.min ?? 0;
	const maxScore = scoreConfig.max ?? 100;

	const evaluationPrompt = `You are an expert translation adequacy evaluator${sourceLanguage ? ` for ${sourceLanguage} to ${targetLanguage}` : ` for ${targetLanguage}`}.

# Task
Evaluate ONLY the semantic accuracy of the translation. Ignore fluency, grammar, and style.

# Input
${sourceLanguage ? `Source Language: ${sourceLanguage}` : ""}
Target Language: ${targetLanguage}

{{#if sourceText}}Source Text: {{sourceText}}{{/if}}
Translation: {{candidateText}}
{{#if referenceText}}Reference Translation: {{referenceText}}{{/if}}

# Evaluation Focus

Assess ONLY:
- Does the translation convey the same meaning as the source?
- Are there any omissions or additions that change meaning?
- Are all key concepts accurately represented?

Ignore:
- Fluency and naturalness
- Grammar and syntax
- Style and tone
- Word choice (unless it affects meaning)

Provide a score from ${minScore} to ${maxScore} based purely on semantic accuracy.`;

	return new Evaluator({
		name: `translation-adequacy-${targetLanguage.toLowerCase().replace(/\s+/g, "-")}`,
		model,
		evaluationPrompt,
		scoreConfig: {
			type: "numeric",
			min: minScore,
			max: maxScore,
			float: true,
		},
		modelSettings: {
			temperature: 0.2,
			...modelSettings,
		},
	});
}

/**
 * Creates a translation fluency evaluator (target language quality only)
 *
 * Focuses solely on how natural and fluent the translation reads in the
 * target language, without comparing to the source.
 *
 * @param options - Configuration options
 * @returns A configured Evaluator instance
 */
export function createTranslationFluencyEvaluator(
	options: Omit<TranslationEvaluatorOptions, "weights" | "sourceLanguage">,
): Evaluator {
	const { model, targetLanguage, scoreConfig = {}, modelSettings } = options;

	const minScore = scoreConfig.min ?? 0;
	const maxScore = scoreConfig.max ?? 100;

	const evaluationPrompt = `You are an expert ${targetLanguage} language evaluator.

# Task
Evaluate ONLY how natural and fluent the text reads in ${targetLanguage}. Do NOT compare to any source text.

# Input
Text: {{candidateText}}

# Evaluation Focus

Assess:
- Does the text read naturally in ${targetLanguage}?
- Is it grammatically correct?
- Is the vocabulary appropriate and idiomatic?
- Is it easy to understand?
- Does it flow well?

Provide a score from ${minScore} to ${maxScore} based purely on ${targetLanguage} fluency.`;

	return new Evaluator({
		name: `translation-fluency-${targetLanguage.toLowerCase().replace(/\s+/g, "-")}`,
		model,
		evaluationPrompt,
		scoreConfig: {
			type: "numeric",
			min: minScore,
			max: maxScore,
			float: true,
		},
		modelSettings: {
			temperature: 0.2,
			...modelSettings,
		},
	});
}
