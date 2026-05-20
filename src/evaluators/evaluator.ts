import { generateText, Output } from "ai";
import { z } from "zod";
import {
	type EvalKitSpan,
	getTracer,
	isTelemetryEnabled,
	SpanStatusCode,
} from "../telemetry.js";
import type {
	EvaluationInput,
	EvaluatorConfig,
	EvaluatorResult,
	TokenUsage,
} from "../types/evaluator.js";
import { TemplateRenderer } from "../utils/template-engine.js";

function getNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: undefined;
}

function hasNumberValue(value: Record<string, unknown>): boolean {
	return Object.values(value).some((entry) => typeof entry === "number");
}

export class Evaluator {
	readonly name: string;
	readonly timeout?: number;

	private readonly model: EvaluatorConfig["model"];
	private readonly evaluationPrompt: string;
	private readonly scoreConfig: NonNullable<EvaluatorConfig["scoreConfig"]>;
	private readonly modelSettings?: EvaluatorConfig["modelSettings"];
	private readonly templateRenderer: TemplateRenderer;

	constructor(config: EvaluatorConfig) {
		this.name = config.name;
		this.timeout = config.timeout;

		this.model = config.model;
		this.evaluationPrompt = config.evaluationPrompt;
		this.scoreConfig = config.scoreConfig ?? {
			type: "numeric",
			min: 0,
			max: 100,
			float: false,
		};
		this.modelSettings = config.modelSettings;

		this.templateRenderer = new TemplateRenderer();

		const templateErrors = this.templateRenderer.validate(
			this.evaluationPrompt,
		);
		if (templateErrors.length > 0) {
			throw new Error(
				`Invalid evaluation prompt template: ${templateErrors.join("; ")}`,
			);
		}
	}

	async evaluate(input: EvaluationInput): Promise<EvaluatorResult> {
		const tracer = await getTracer();
		const modelId = (this.model as { modelId?: string }).modelId;

		return tracer.startActiveSpan(
			"eval-kit.evaluator.evaluate",
			{
				attributes: {
					"eval_kit.evaluator.name": this.name,
					"eval_kit.model.id": modelId ?? "unknown",
					"eval_kit.score_config.type": this.scoreConfig.type,
					"eval_kit.input.candidate_text_length": input.candidateText.length,
				},
			},
			(span: EvalKitSpan) => this.runEvaluation(input, modelId, span),
		);
	}

	private async runEvaluation(
		input: EvaluationInput,
		modelId: string | undefined,
		span: EvalKitSpan,
	): Promise<EvaluatorResult> {
		const startTime = Date.now();
		let spanError: string | undefined;
		let evaluatorResult: EvaluatorResult;

		try {
			evaluatorResult = await this.executeEvaluation(input, modelId, span);
		} catch (error) {
			evaluatorResult = this.buildErrorResult(error, modelId, startTime);
			spanError = evaluatorResult.error;
			span.recordException(
				error instanceof Error ? error : (spanError ?? String(error)),
			);
		} finally {
			span.setAttribute(
				"eval_kit.result.execution_time_ms",
				Date.now() - startTime,
			);
			if (spanError) {
				span.setAttribute("eval_kit.result.error", spanError);
				span.setStatus({ code: SpanStatusCode.ERROR, message: spanError });
			} else {
				span.setStatus({ code: SpanStatusCode.OK });
			}
			span.end();
		}

		return evaluatorResult;
	}

	private buildErrorResult(
		error: unknown,
		modelId: string | undefined,
		startTime: number,
	): EvaluatorResult {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorDetails =
			error instanceof Error && "cause" in error
				? String(error.cause)
				: undefined;
		const fullError = errorDetails
			? `${errorMessage} (${errorDetails})`
			: errorMessage;

		return {
			evaluatorName: this.name,
			model: modelId,
			score: 0,
			feedback: `Evaluation failed: ${errorMessage}`,
			processingStats: { executionTime: Date.now() - startTime },
			error: fullError,
		};
	}

	private async executeEvaluation(
		input: EvaluationInput,
		modelId: string | undefined,
		span: EvalKitSpan,
	): Promise<EvaluatorResult> {
		const startTime = Date.now();
		const prompt = this.buildPrompt(input);
		const schema = this.createSchema();

		const result = await generateText({
			model: this.model,
			output: Output.object({ schema }),
			prompt,
			temperature: this.modelSettings?.temperature,
			maxOutputTokens: this.modelSettings?.maxOutputTokens,
			topP: this.modelSettings?.topP,
			topK: this.modelSettings?.topK,
			presencePenalty: this.modelSettings?.presencePenalty,
			frequencyPenalty: this.modelSettings?.frequencyPenalty,
			seed: this.modelSettings?.seed,
			experimental_telemetry: { isEnabled: isTelemetryEnabled() },
		});

		const executionTime = Date.now() - startTime;
		const tokenUsage = this.extractTokenUsage(result.usage);

		this.setTokenAttributes(span, tokenUsage);
		span.setAttribute("eval_kit.result.score", result.output.score);

		return {
			evaluatorName: this.name,
			model: modelId,
			score: result.output.score,
			feedback: result.output.feedback,
			processingStats: { executionTime, tokenUsage },
		};
	}

	private buildPrompt(input: EvaluationInput): string {
		const variables = this.prepareVariables(input);
		const scoreInstructions = this.formatScoreInstructions();
		return `${this.templateRenderer.render(this.evaluationPrompt, variables)}\n\n${scoreInstructions}`;
	}

	private setTokenAttributes(
		span: EvalKitSpan,
		tokenUsage: TokenUsage | undefined,
	): void {
		if (tokenUsage?.inputTokens !== undefined) {
			span.setAttribute(
				"eval_kit.result.token_usage.input",
				tokenUsage.inputTokens,
			);
		}
		if (tokenUsage?.outputTokens !== undefined) {
			span.setAttribute(
				"eval_kit.result.token_usage.output",
				tokenUsage.outputTokens,
			);
		}
		if (tokenUsage?.totalTokens !== undefined) {
			span.setAttribute(
				"eval_kit.result.token_usage.total",
				tokenUsage.totalTokens,
			);
		}
	}

	private prepareVariables(input: EvaluationInput): Record<string, unknown> {
		return {
			candidateText: input.candidateText,
			prompt: input.prompt ?? "",
			referenceText: input.referenceText ?? "",
			sourceText: input.sourceText ?? "",
			name: this.name,
			contentType: input.contentType ?? "",
			language: input.language ?? "",
		};
	}

	private extractTokenUsage(usage: unknown): TokenUsage | undefined {
		if (!usage) return undefined;
		const usageRecord = getRecord(usage);
		if (!usageRecord) return undefined;

		const inputTokenDetails = this.extractInputTokenDetails(
			usageRecord.inputTokenDetails,
		);
		const outputTokenDetails = this.extractOutputTokenDetails(
			usageRecord.outputTokenDetails,
		);

		return {
			inputTokens: getNumber(usageRecord.inputTokens),
			...(inputTokenDetails ? { inputTokenDetails } : {}),
			outputTokens: getNumber(usageRecord.outputTokens),
			...(outputTokenDetails ? { outputTokenDetails } : {}),
			totalTokens: getNumber(usageRecord.totalTokens),
			reasoningTokens: getNumber(usageRecord.reasoningTokens),
			cachedInputTokens: getNumber(usageRecord.cachedInputTokens),
		};
	}

	private extractInputTokenDetails(
		details: unknown,
	): TokenUsage["inputTokenDetails"] | undefined {
		const detailRecord = getRecord(details);
		if (!detailRecord || !hasNumberValue(detailRecord)) return undefined;

		return {
			noCacheTokens: getNumber(detailRecord.noCacheTokens),
			cacheReadTokens: getNumber(detailRecord.cacheReadTokens),
			cacheWriteTokens: getNumber(detailRecord.cacheWriteTokens),
		};
	}

	private extractOutputTokenDetails(
		details: unknown,
	): TokenUsage["outputTokenDetails"] | undefined {
		const detailRecord = getRecord(details);
		if (!detailRecord || !hasNumberValue(detailRecord)) return undefined;

		return {
			textTokens: getNumber(detailRecord.textTokens),
			reasoningTokens: getNumber(detailRecord.reasoningTokens),
		};
	}

	private createSchema(): z.ZodObject<{
		score: z.ZodTypeAny;
		feedback: z.ZodString;
	}> {
		if (this.scoreConfig.type === "numeric") {
			const { min, max, float } = this.scoreConfig;
			let scoreSchema: z.ZodNumber = z.number().min(min).max(max);

			if (float === false) {
				scoreSchema = scoreSchema.int();
			}

			return z.object({
				score: scoreSchema.describe(
					`Score from ${min} to ${max}${float === false ? " (integer)" : ""}`,
				),
				feedback: z.string().describe("Detailed evaluation feedback"),
			});
		}

		return z.object({
			score: z
				.enum(this.scoreConfig.categories as [string, ...string[]])
				.describe(
					`Score using one of: ${this.scoreConfig.categories.join(", ")}`,
				),
			feedback: z.string().describe("Detailed evaluation feedback"),
		});
	}

	private formatScoreInstructions(): string {
		if (this.scoreConfig.type === "numeric") {
			const { min, max, float } = this.scoreConfig;
			const floatNote = float === false ? " (integer)" : "";
			return `Provide a score from ${min} to ${max}${floatNote} where ${min} is worst and ${max} is best.`;
		}

		const categories = this.scoreConfig.categories.join(", ");
		return `Provide a score using one of these categories (from worst to best): ${categories}`;
	}

	static create(
		name: string,
		model: EvaluatorConfig["model"],
		options?: {
			evaluationPrompt?: string;
			scoreConfig?: EvaluatorConfig["scoreConfig"];
			timeout?: number;
			modelSettings?: EvaluatorConfig["modelSettings"];
			requireReference?: boolean;
		},
	): Evaluator {
		const useReference = options?.requireReference ?? false;
		const referenceBlock = useReference
			? "Reference: {{referenceText}}"
			: "{{#if referenceText}}Reference: {{referenceText}}{{/if}}";

		const defaultEvaluationPrompt = `Evaluate the {{name}} of the following text:

Text: {{candidateText}}
${referenceBlock}

Provide a detailed assessment.`;

		return new Evaluator({
			name,
			model,
			evaluationPrompt: options?.evaluationPrompt ?? defaultEvaluationPrompt,
			scoreConfig: options?.scoreConfig,
			timeout: options?.timeout,
			modelSettings: options?.modelSettings,
		});
	}
}
