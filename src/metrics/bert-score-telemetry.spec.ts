import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { _resetTracer, SpanStatusCode } from "../telemetry.js";

// Set up OTel SDK
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

// Mock @xenova/transformers to avoid ESM/model download issues
const mockPipeline = jest.fn();
const mockCosSim = jest.fn();
jest.unstable_mockModule("@xenova/transformers", () => ({
	pipeline: mockPipeline,
	cos_sim: mockCosSim,
}));

const { calculateBertScore, clearBertCache } = await import("./bert-score.js");

describe("bert-score telemetry", () => {
	beforeEach(() => {
		exporter.reset();
		_resetTracer();
		clearBertCache();
		mockPipeline.mockClear();
		mockCosSim.mockClear();
	});

	it("should create a span with correct name and attributes", async () => {
		const mockExtractor = jest.fn().mockResolvedValue({
			data: new Float32Array([0.1, 0.2, 0.3]),
		});
		mockPipeline.mockResolvedValue(mockExtractor);
		mockCosSim.mockReturnValue(0.85);

		const result = await calculateBertScore("hello world", "hello there", {
			model: "test-model",
			scoreType: "f1",
		});

		expect(result.score).toBeGreaterThanOrEqual(0);

		const spans = exporter.getFinishedSpans();
		const span = spans.find((s) => s.name === "eval-kit.metric.bert_score");
		expect(span).toBeDefined();
		expect(span?.attributes["eval_kit.metric.name"]).toBe("bert_score");
		expect(span?.attributes["eval_kit.metric.model"]).toBe("test-model");
		expect(span?.attributes["eval_kit.metric.score_type"]).toBe("f1");
		expect(span?.attributes["eval_kit.result.score"]).toBeDefined();
		expect(span?.status.code).toBe(SpanStatusCode.OK);
	});

	it("should add model_loaded event on cache miss", async () => {
		const mockExtractor = jest.fn().mockResolvedValue({
			data: new Float32Array([0.1, 0.2, 0.3]),
		});
		mockPipeline.mockResolvedValue(mockExtractor);
		mockCosSim.mockReturnValue(0.9);

		await calculateBertScore("a", "b", { model: "fresh-model" });

		const span = exporter
			.getFinishedSpans()
			.find((s) => s.name === "eval-kit.metric.bert_score");

		const loadEvent = span?.events.find((e) => e.name === "model_loaded");
		expect(loadEvent).toBeDefined();
		expect(loadEvent?.attributes?.["eval_kit.metric.model"]).toBe(
			"fresh-model",
		);
	});

	it("should record error when pipeline fails", async () => {
		mockPipeline.mockRejectedValue(new Error("Model download failed"));

		await expect(calculateBertScore("a", "b")).rejects.toThrow(
			"Model download failed",
		);

		const span = exporter
			.getFinishedSpans()
			.find((s) => s.name === "eval-kit.metric.bert_score");

		expect(span?.status.code).toBe(SpanStatusCode.ERROR);
		expect(span?.events.some((e) => e.name === "exception")).toBe(true);
	});
});
