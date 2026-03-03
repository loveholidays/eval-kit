import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { _resetTracer, enableTelemetry, SpanStatusCode } from "../telemetry.js";

// Set up OTel SDK
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

// Mock @xenova/transformers to avoid ESM/model download issues
const mockFromPretrainedTokenizer = jest.fn();
const mockFromPretrainedModel = jest.fn();
jest.unstable_mockModule("@xenova/transformers", () => ({
	AutoTokenizer: { from_pretrained: mockFromPretrainedTokenizer },
	AutoModelForCausalLM: { from_pretrained: mockFromPretrainedModel },
	Tensor: class MockTensor {
		constructor(
			public type: string,
			public data: BigInt64Array,
			public dims: number[],
		) {}
	},
}));

const { calculatePerplexity, clearPerplexityCache } = await import(
	"./perplexity.js"
);

describe("perplexity telemetry", () => {
	beforeEach(() => {
		exporter.reset();
		_resetTracer();
		enableTelemetry(true);
		clearPerplexityCache();
		mockFromPretrainedTokenizer.mockClear();
		mockFromPretrainedModel.mockClear();
	});

	it("should create a span with correct name and attributes", async () => {
		// Mock tokenizer that returns a short sequence (triggers early return)
		const mockTokenizer = jest.fn().mockResolvedValue({
			input_ids: {
				data: new BigInt64Array([BigInt(1)]),
			},
		});
		mockFromPretrainedTokenizer.mockResolvedValue(mockTokenizer);
		mockFromPretrainedModel.mockResolvedValue({});

		const result = await calculatePerplexity("hi", {
			model: "test-model",
		});

		// Short text triggers early return with perplexity 1.0
		expect(result.perplexity).toBe(1.0);
		expect(result.score).toBe(100);

		const spans = exporter.getFinishedSpans();
		const span = spans.find((s) => s.name === "eval-kit.metric.perplexity");
		expect(span).toBeDefined();
		expect(span?.attributes["eval_kit.metric.name"]).toBe("perplexity");
		expect(span?.attributes["eval_kit.metric.model"]).toBe("test-model");
		expect(span?.attributes["eval_kit.result.score"]).toBe(100);
		expect(span?.status.code).toBe(SpanStatusCode.OK);
	});

	it("should add model_loaded event on cache miss", async () => {
		const mockTokenizer = jest.fn().mockResolvedValue({
			input_ids: {
				data: new BigInt64Array([BigInt(1)]),
			},
		});
		mockFromPretrainedTokenizer.mockResolvedValue(mockTokenizer);
		mockFromPretrainedModel.mockResolvedValue({});

		await calculatePerplexity("hi", { model: "fresh-model" });

		const span = exporter
			.getFinishedSpans()
			.find((s) => s.name === "eval-kit.metric.perplexity");

		const loadEvent = span?.events.find((e) => e.name === "model_loaded");
		expect(loadEvent).toBeDefined();
		expect(loadEvent?.attributes?.["eval_kit.metric.model"]).toBe(
			"fresh-model",
		);
	});

	it("should record error when model loading fails", async () => {
		mockFromPretrainedTokenizer.mockRejectedValue(new Error("Network error"));
		mockFromPretrainedModel.mockRejectedValue(new Error("Network error"));

		await expect(calculatePerplexity("test text")).rejects.toThrow(
			"Network error",
		);

		const span = exporter
			.getFinishedSpans()
			.find((s) => s.name === "eval-kit.metric.perplexity");

		expect(span?.status.code).toBe(SpanStatusCode.ERROR);
		expect(span?.events.some((e) => e.name === "exception")).toBe(true);
	});
});
