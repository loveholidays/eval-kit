import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import type { LanguageModel } from "ai";
import { _resetTracer, enableTelemetry, SpanStatusCode } from "../telemetry.js";

// Set up OTel SDK for span capture
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

// Mock the ai module
const mockGenerateText = jest.fn();
jest.unstable_mockModule("ai", () => ({
	generateText: mockGenerateText,
	Output: {
		object: jest.fn((output) => ({ type: "object", ...output })),
	},
}));

const { Evaluator } = await import("./evaluator.js");

const createMockModel = (): LanguageModel =>
	({
		specificationVersion: "v1",
		provider: "mock",
		modelId: "mock-model-v1",
		defaultObjectGenerationMode: "json",
	}) as unknown as LanguageModel;

describe("Evaluator telemetry", () => {
	beforeEach(() => {
		exporter.reset();
		_resetTracer();
		enableTelemetry(true);
		mockGenerateText.mockClear();
	});

	it("should create a span with correct name and initial attributes on success", async () => {
		mockGenerateText.mockResolvedValue({
			output: { score: 85, feedback: "Good quality" },
			usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
		});

		const evaluator = new Evaluator({
			name: "fluency",
			model: createMockModel(),
			evaluationPrompt: "Rate: {{candidateText}}",
		});

		const result = await evaluator.evaluate({
			candidateText: "Hello world",
		});

		expect(result.score).toBe(85);
		expect(result.error).toBeUndefined();

		const spans = exporter.getFinishedSpans();
		expect(spans).toHaveLength(1);

		const span = spans[0];
		expect(span.name).toBe("eval-kit.evaluator.evaluate");
		expect(span.attributes["eval_kit.evaluator.name"]).toBe("fluency");
		expect(span.attributes["eval_kit.model.id"]).toBe("mock-model-v1");
		expect(span.attributes["eval_kit.score_config.type"]).toBe("numeric");
		expect(span.attributes["eval_kit.input.candidate_text_length"]).toBe(11);

		// Completion attributes
		expect(span.attributes["eval_kit.result.score"]).toBe(85);
		expect(span.attributes["eval_kit.result.token_usage.input"]).toBe(100);
		expect(span.attributes["eval_kit.result.token_usage.output"]).toBe(20);
		expect(span.attributes["eval_kit.result.token_usage.total"]).toBe(120);
		expect(
			span.attributes["eval_kit.result.execution_time_ms"],
		).toBeGreaterThanOrEqual(0);

		expect(span.status.code).toBe(SpanStatusCode.OK);
	});

	it("should record error attributes when evaluation fails", async () => {
		mockGenerateText.mockRejectedValue(new Error("API rate limited"));

		const evaluator = new Evaluator({
			name: "accuracy",
			model: createMockModel(),
			evaluationPrompt: "Rate: {{candidateText}}",
		});

		const result = await evaluator.evaluate({
			candidateText: "Test text",
		});

		// Evaluator catches errors and returns a result
		expect(result.error).toBeDefined();
		expect(result.score).toBe(0);

		const spans = exporter.getFinishedSpans();
		expect(spans).toHaveLength(1);

		const span = spans[0];
		expect(span.status.code).toBe(SpanStatusCode.ERROR);
		expect(span.attributes["eval_kit.result.error"]).toBe("API rate limited");
		expect(
			span.attributes["eval_kit.result.execution_time_ms"],
		).toBeGreaterThanOrEqual(0);

		// Exception event recorded
		expect(span.events.length).toBeGreaterThanOrEqual(1);
		const exceptionEvent = span.events.find((e) => e.name === "exception");
		expect(exceptionEvent).toBeDefined();
	});

	it("should not break existing behavior when OTel is present", async () => {
		mockGenerateText.mockResolvedValue({
			output: { score: "excellent", feedback: "Top quality" },
			usage: undefined,
		});

		const evaluator = new Evaluator({
			name: "quality",
			model: createMockModel(),
			evaluationPrompt: "Rate: {{candidateText}}",
			scoreConfig: {
				type: "categorical",
				categories: ["poor", "fair", "good", "excellent"],
			},
		});

		const result = await evaluator.evaluate({
			candidateText: "Test",
		});

		expect(result.evaluatorName).toBe("quality");
		expect(result.score).toBe("excellent");
		expect(result.feedback).toBe("Top quality");
		expect(result.processingStats.executionTime).toBeGreaterThanOrEqual(0);
	});
});
