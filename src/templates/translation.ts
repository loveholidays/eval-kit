import type { LanguageModel } from "ai";
import { Evaluator } from "../evaluators/evaluator.js";
import type { EvaluatorConfig, EvaluatorResult, EvaluationInput, IEvaluator } from "../types/evaluator.js";
import { calculateBleu } from "../metrics/bleu.js";
import { calculateTer } from "../metrics/ter.js";

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
	 * Metric weights for combining scores (optional)
	 * Each value should be between 0 and 1, summing to 1.0
	 * Default: BLEU 0.25, TER 0.25, AI 0.50
	 */
	metricWeights?: {
		bleu?: number; // Default: 0.25
		ter?: number; // Default: 0.25
		ai?: number; // Default: 0.50
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
 * Extended result type for translation evaluation with detailed metrics
 */
export interface TranslationEvaluatorResult extends EvaluatorResult {
	metrics?: {
		bleu: {
			score: number;
			precisions: number[];
			brevityPenalty: number;
		};
		ter: {
			score: number;
			rawTer: number;
			editCount: number;
			feedback: string;
		};
		ai: {
			score: number;
			feedback: string;
		};
	};
}

/**
 * Composite translation evaluator that combines multiple metrics
 *
 * This evaluator combines:
 * - BLEU score: Measures n-gram overlap with reference translation
 * - TER score: Measures edit distance (inverted for consistency)
 * - AI evaluation: Semantic quality assessment using LLM
 */
class CompositeTranslationEvaluator implements IEvaluator {
	readonly name: string;
	readonly timeout?: number;

	private readonly aiEvaluator: Evaluator;
	private readonly metricWeights: { bleu: number; ter: number; ai: number };

	constructor(
		options: TranslationEvaluatorOptions,
		aiEvaluator: Evaluator,
	) {
		const { targetLanguage, metricWeights = {} } = options;

		this.name = `translation-quality-${targetLanguage.toLowerCase().replace(/\s+/g, "-")}`;
		this.aiEvaluator = aiEvaluator;

		// Normalize metric weights
		this.metricWeights = {
			bleu: metricWeights.bleu ?? 0.25,
			ter: metricWeights.ter ?? 0.25,
			ai: metricWeights.ai ?? 0.5,
		};

		// Validate weights sum to approximately 1.0
		const totalWeight = Object.values(this.metricWeights).reduce((sum, val) => sum + val, 0);
		if (Math.abs(totalWeight - 1) > 0.01) {
			console.warn(
				`[eval-kit] Translation metric weights sum to ${totalWeight.toFixed(2)}, expected 1.0. ` +
					"Scores may not reflect intended metric importance.",
			);
		}
	}

	async evaluate(input: EvaluationInput): Promise<TranslationEvaluatorResult> {
		const startTime = Date.now();

		// Reference text is required for BLEU and TER
		const referenceText = input.referenceText || input.sourceText || "";

		if (!referenceText) {
			return {
				evaluatorName: this.name,
				score: 0,
				feedback: "Reference text is required for translation evaluation",
				success: false,
				error: "Missing reference text",
				processingStats: { executionTime: Date.now() - startTime },
			};
		}

		// Calculate lexical metrics
		const bleuResult = calculateBleu(input.candidateText, referenceText);
		const terResult = calculateTer(input.candidateText, referenceText);

		// Run AI evaluation
		const aiResult = await this.aiEvaluator.evaluate(input);

		// Calculate weighted composite score
		const aiScore = typeof aiResult.score === "number" ? aiResult.score : 0;
		const compositeScore =
			this.metricWeights.bleu * bleuResult.score +
			this.metricWeights.ter * terResult.score +
			this.metricWeights.ai * (aiResult.success ? aiScore : 0);

		const executionTime = Date.now() - startTime;

		// Build comprehensive feedback
		const feedback = this.buildFeedback(bleuResult, terResult, aiScore, aiResult.feedback);

		return {
			evaluatorName: this.name,
			score: Math.round(compositeScore * 100) / 100,
			feedback,
			success: aiResult.success,
			error: aiResult.error,
			processingStats: {
				executionTime,
				tokenUsage: aiResult.processingStats?.tokenUsage,
			},
			metrics: {
				bleu: {
					score: bleuResult.score,
					precisions: bleuResult.precisions,
					brevityPenalty: bleuResult.brevityPenalty,
				},
				ter: {
					score: terResult.score,
					rawTer: terResult.rawTer,
					editCount: terResult.editCount,
					feedback: terResult.feedback,
				},
				ai: {
					score: aiScore,
					feedback: aiResult.feedback,
				},
			},
		};
	}

	private buildFeedback(
		bleuResult: { score: number; brevityPenalty: number },
		terResult: { score: number; feedback: string },
		aiScore: number,
		aiFeedback: string,
	): string {
		const sections = [
			`## Lexical Metrics`,
			`- **BLEU Score**: ${bleuResult.score.toFixed(1)}/100 (brevity penalty: ${bleuResult.brevityPenalty.toFixed(2)})`,
			`- **TER Score**: ${terResult.score.toFixed(1)}/100 - ${terResult.feedback}`,
			``,
			`## AI Evaluation (Score: ${aiScore}/100)`,
			aiFeedback,
		];

		return sections.join("\n");
	}
}

/**
 * Creates a translation quality evaluator that combines multiple metrics
 *
 * This evaluator uses:
 * - BLEU: N-gram precision for lexical similarity
 * - TER: Translation Edit Rate (lower is better, inverted for scoring)
 * - AI: LLM-based semantic evaluation
 *
 * @param options - Configuration options
 * @returns A configured composite evaluator instance
 */
export function createTranslationEvaluator(
	options: TranslationEvaluatorOptions,
): CompositeTranslationEvaluator {
	const {
		model,
		targetLanguage,
		sourceLanguage,
		scoreConfig = {},
		modelSettings,
	} = options;

	const minScore = scoreConfig.min ?? 0;
	const maxScore = scoreConfig.max ?? 100;

	// AI evaluator focuses on semantic quality aspects that lexical metrics miss
	const evaluationPrompt = `You are an expert translation quality evaluator${sourceLanguage ? ` specializing in ${sourceLanguage} to ${targetLanguage} translation` : ` for ${targetLanguage}`}.

# Task
Evaluate the semantic quality of the translation below. Focus on aspects that lexical metrics (BLEU, TER) cannot capture.

# Input
${sourceLanguage ? `Source Language: ${sourceLanguage}` : ""}
Target Language: ${targetLanguage}

{{#if sourceText}}Source Text: {{sourceText}}{{/if}}
Translation: {{candidateText}}
{{#if referenceText}}Reference Translation: {{referenceText}}{{/if}}
{{#if prompt}}Context: {{prompt}}{{/if}}

# Evaluation Criteria

Focus on these semantic dimensions:

1. **Meaning Preservation**: Does the translation accurately convey the intended meaning? Are there semantic distortions, omissions, or additions?

2. **Fluency & Naturalness**: Does the translation read naturally in ${targetLanguage}? Is it idiomatic?

3. **Terminology**: Are domain-specific terms translated appropriately and consistently?

4. **Style & Tone**: Does the translation maintain the appropriate register and style?

# Instructions

Provide:
1. A concise evaluation focusing on semantic quality
2. Specific examples of issues or strengths
3. An overall score from ${minScore} to ${maxScore}`;

	const aiEvaluator = new Evaluator({
		name: `translation-ai-${targetLanguage.toLowerCase().replace(/\s+/g, "-")}`,
		model,
		evaluationPrompt,
		scoreConfig: {
			type: "numeric",
			min: minScore,
			max: maxScore,
			float: true,
		},
		modelSettings: {
			temperature: 0.3,
			...modelSettings,
		},
	});

	return new CompositeTranslationEvaluator(options, aiEvaluator);
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
