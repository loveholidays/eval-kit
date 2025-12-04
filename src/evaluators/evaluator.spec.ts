import { Evaluator } from "./evaluator.js";
import type { LanguageModel } from "ai";

// Mock the ai module
jest.mock("ai", () => ({
	generateObject: jest.fn(),
}));

import { generateObject } from "ai";
const mockGenerateObject = generateObject as jest.MockedFunction<
	typeof generateObject
>;

// Create a mock LanguageModel
const createMockModel = (): LanguageModel => {
	return {
		specificationVersion: "v1",
		provider: "mock",
		modelId: "mock-model",
		defaultObjectGenerationMode: "json",
	} as unknown as LanguageModel;
};

describe("Evaluator", () => {
	beforeEach(() => {
		mockGenerateObject.mockClear();
	});

	describe("constructor", () => {
		it("should create evaluator with valid config", () => {
			const model = createMockModel();

			const evaluator = new Evaluator({
				name: "fluency",
				model,
				evaluationPrompt: "Evaluate the fluency of: {{candidateText}}",
			});

			expect(evaluator.name).toBe("fluency");
		});

		it("should validate template syntax", () => {
			const model = createMockModel();

			expect(
				() =>
					new Evaluator({
						name: "test",
						model,
						evaluationPrompt: "{{#if test}}Unclosed conditional",
					}),
			).toThrow("Invalid evaluation prompt template");
		});
	});

	describe("evaluate", () => {
		it("should evaluate with basic input", async () => {
			const model = createMockModel();

			mockGenerateObject.mockResolvedValue({
				object: { score: 90, feedback: "Excellent fluency" },
				usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
			} as any);

			const evaluator = new Evaluator({
				name: "fluency",
				model,
				evaluationPrompt: "Rate the fluency of: {{candidateText}}",
			});

			const result = await evaluator.evaluate({
				candidateText: "The quick brown fox jumps over the lazy dog.",
			});

			expect(result.evaluatorName).toBe("fluency");
			expect(result.score).toBe(90);
			expect(result.feedback).toBe("Excellent fluency");
			expect(result.processingStats.executionTime).toBeGreaterThanOrEqual(0);
			expect(result.processingStats.tokenUsage).toEqual({
				inputTokens: 15,
				outputTokens: 10,
				totalTokens: 25,
			});
		});

		it("should evaluate with reference text", async () => {
			const model = createMockModel();

			mockGenerateObject.mockResolvedValue({
				object: { score: 88, feedback: "Good accuracy" },
				usage: undefined,
			} as any);

			const evaluator = new Evaluator({
				name: "accuracy",
				model,
				evaluationPrompt: `Compare:
Candidate: {{candidateText}}
{{#if referenceText}}Reference: {{referenceText}}{{/if}}`,
			});

			const result = await evaluator.evaluate({
				candidateText: "Hello world",
				referenceText: "Hello world!",
			});

			expect(result.score).toBe(88);
		});

		it("should handle API failures gracefully", async () => {
			const model = createMockModel();

			mockGenerateObject.mockRejectedValue(new Error("LLM API failed"));

			const evaluator = new Evaluator({
				name: "test",
				model,
				evaluationPrompt: "Evaluate: {{candidateText}}",
			});

			const result = await evaluator.evaluate({
				candidateText: "Test",
			});

			expect(result.error).toBeDefined();
			expect(result.feedback).toContain("Evaluation failed");
			expect(result.processingStats.executionTime).toBeGreaterThanOrEqual(0);
		});

		it("should handle categorical scores", async () => {
			const model = createMockModel();

			mockGenerateObject.mockResolvedValue({
				object: { score: "excellent", feedback: "Top quality" },
				usage: undefined,
			} as any);

			const evaluator = new Evaluator({
				name: "quality",
				model,
				evaluationPrompt: "Rate: {{candidateText}}",
				scoreConfig: {
					type: "categorical",
					categories: ["poor", "fair", "good", "excellent"],
				},
			});

			const result = await evaluator.evaluate({
				candidateText: "Test",
			});

			expect(result.score).toBe("excellent");
		});

		it("should handle numeric score config", async () => {
			const model = createMockModel();

			mockGenerateObject.mockResolvedValue({
				object: { score: 8, feedback: "Good" },
				usage: undefined,
			} as any);

			const evaluator = new Evaluator({
				name: "rating",
				model,
				evaluationPrompt: "Rate: {{candidateText}}",
				scoreConfig: {
					type: "numeric",
					min: 0,
					max: 10,
					float: false,
				},
			});

			const result = await evaluator.evaluate({
				candidateText: "Test",
			});

			expect(result.score).toBe(8);
		});

		it("should track execution time", async () => {
			const model = createMockModel();

			mockGenerateObject.mockResolvedValue({
				object: { score: 85, feedback: "Good" },
				usage: undefined,
			} as any);

			const evaluator = new Evaluator({
				name: "test",
				model,
				evaluationPrompt: "Evaluate: {{candidateText}}",
			});

			const result = await evaluator.evaluate({
				candidateText: "Test",
			});

			expect(result.processingStats.executionTime).toBeGreaterThanOrEqual(0);
			expect(typeof result.processingStats.executionTime).toBe("number");
		});

		it("should pass model settings to generateObject", async () => {
			const model = createMockModel();

			mockGenerateObject.mockResolvedValue({
				object: { score: 85, feedback: "Good" },
				usage: undefined,
			} as any);

			const evaluator = new Evaluator({
				name: "test",
				model,
				evaluationPrompt: "Evaluate: {{candidateText}}",
				modelSettings: {
					temperature: 0.7,
					maxOutputTokens: 500,
					topP: 0.9,
				},
			});

			await evaluator.evaluate({
				candidateText: "Test",
			});

			expect(mockGenerateObject).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.7,
					maxOutputTokens: 500,
					topP: 0.9,
				}),
			);
		});
	});

	describe("create", () => {
		it("should create evaluator with defaults", () => {
			const model = createMockModel();

			const evaluator = Evaluator.create("fluency", model);

			expect(evaluator.name).toBe("fluency");
		});

		it("should create evaluator with custom prompt", () => {
			const model = createMockModel();

			const evaluator = Evaluator.create("accuracy", model, {
				evaluationPrompt: "Custom prompt: {{candidateText}}",
			});

			expect(evaluator.name).toBe("accuracy");
		});

		it("should create evaluator requiring reference", () => {
			const model = createMockModel();

			const evaluator = Evaluator.create("comparison", model, {
				requireReference: true,
			});

			expect(evaluator.name).toBe("comparison");
		});

		it("should create evaluator with score config", () => {
			const model = createMockModel();

			const evaluator = Evaluator.create("rating", model, {
				scoreConfig: {
					type: "categorical",
					categories: ["poor", "fair", "good", "excellent"],
				},
			});

			expect(evaluator.name).toBe("rating");
		});

		it("should create evaluator with timeout", () => {
			const model = createMockModel();

			const evaluator = Evaluator.create("test", model, {
				timeout: 10000,
			});

			expect(evaluator.timeout).toBe(10000);
		});

		it("should create evaluator with model settings", () => {
			const model = createMockModel();

			const evaluator = Evaluator.create("test", model, {
				modelSettings: {
					temperature: 0.5,
					maxOutputTokens: 1000,
				},
			});

			expect(evaluator.name).toBe("test");
		});
	});
});
