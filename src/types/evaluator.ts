import type { LanguageModel } from "ai";

export interface TokenUsage {
	readonly inputTokens?: number;
	readonly outputTokens?: number;
	readonly totalTokens?: number;
}

export interface ProcessingStats {
	readonly executionTime: number;
	readonly tokenUsage?: TokenUsage;
}

export interface EvaluatorResult {
	readonly evaluatorName: string;
	readonly score: number | string;
	readonly feedback: string;
	readonly processingStats: ProcessingStats;
	readonly success: boolean;
	readonly error?: string;
}

export interface NumericScoreConfig {
	type: "numeric";
	min: number;
	max: number;
	float?: boolean;
}

export interface CategoricalScoreConfig {
	type: "categorical";
	categories: readonly string[];
}

export type ScoreConfig = NumericScoreConfig | CategoricalScoreConfig;

export enum TemplateVariable {
	CANDIDATE_TEXT = "candidateText",
	PROMPT = "prompt",
	REFERENCE_TEXT = "referenceText",
	SOURCE_TEXT = "sourceText",
	CONTENT_TYPE = "contentType",
	LANGUAGE = "language",
	NAME = "name",
}

export interface EvaluatorConfig {
	name: string;
	model: LanguageModel;
	evaluationPrompt: string;
	scoreConfig?: ScoreConfig;
	timeout?: number;
	modelSettings?: {
		temperature?: number;
		maxOutputTokens?: number;
		topP?: number;
		topK?: number;
		presencePenalty?: number;
		frequencyPenalty?: number;
		seed?: number;
		[key: string]: unknown;
	};
}

export interface EvaluationInput {
	readonly candidateText: string;
	readonly prompt?: string;
	readonly referenceText?: string;
	readonly sourceText?: string;
	readonly contentType?: string;
	readonly language?: string;
}

/**
 * Common interface for all evaluators
 * Both Evaluator class and composite evaluators implement this
 */
export interface IEvaluator {
	readonly name: string;
	readonly timeout?: number;
	evaluate(input: EvaluationInput): Promise<EvaluatorResult>;
}
