import { generateObject } from "ai";
import { z } from "zod";
import type {
	EvaluatorConfig,
	EvaluatorResult,
	EvaluationInput,
} from "../types/evaluator.js";
import { TemplateRenderer } from "../utils/template-engine.js";

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
		const startTime = Date.now();

		try {
			const variables = this.prepareVariables(input);
			const scoreInstructions = this.formatScoreInstructions();
			const prompt = `${this.templateRenderer.render(this.evaluationPrompt, variables)}\n\n${scoreInstructions}`;

			const schema = this.createSchema();

			const result = await generateObject({
				model: this.model,
				schema,
				prompt,
				temperature: this.modelSettings?.temperature,
				maxOutputTokens: this.modelSettings?.maxOutputTokens,
				topP: this.modelSettings?.topP,
				topK: this.modelSettings?.topK,
				presencePenalty: this.modelSettings?.presencePenalty,
				frequencyPenalty: this.modelSettings?.frequencyPenalty,
				seed: this.modelSettings?.seed,
			});

			const executionTime = Date.now() - startTime;
			const tokenUsage = this.extractTokenUsage(result.usage);

			return {
				evaluatorName: this.name,
				score: result.object.score,
				feedback: result.object.feedback,
				processingStats: {
					executionTime,
					tokenUsage,
				},
				success: true,
			};
		} catch (error) {
			const executionTime = Date.now() - startTime;

			return {
				evaluatorName: this.name,
				score: 0,
				feedback: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
				processingStats: {
					executionTime,
				},
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
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

	private extractTokenUsage(
		usage: unknown,
	): { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined {
		if (!usage) return undefined;
		return {
			inputTokens: (usage as Record<string, unknown>).inputTokens as number | undefined,
			outputTokens: (usage as Record<string, unknown>).outputTokens as number | undefined,
			totalTokens: (usage as Record<string, unknown>).totalTokens as number | undefined,
		};
	}

	private createSchema() {
		if (this.scoreConfig.type === "numeric") {
			const { min, max, float } = this.scoreConfig;
			let scoreSchema = z.number().min(min).max(max);

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
