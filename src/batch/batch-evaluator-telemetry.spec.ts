import { beforeEach, describe, expect, it } from "@jest/globals";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { _resetTracer, SpanStatusCode } from "../telemetry.js";
import type {
	EvaluationInput,
	EvaluatorResult,
	IEvaluator,
} from "../types/evaluator.js";
import { BatchEvaluator } from "./batch-evaluator.js";

// Set up OTel SDK for span capture
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

// Helper to create a mock evaluator
const createMockEvaluator = (
	name: string,
	score: number = 85,
	shouldFail: boolean = false,
): IEvaluator => ({
	name,
	evaluate: async (_input: EvaluationInput): Promise<EvaluatorResult> => {
		if (shouldFail) {
			throw new Error("Evaluator failed: ECONNRESET");
		}
		return {
			evaluatorName: name,
			model: "mock-model",
			score,
			feedback: "Good",
			processingStats: {
				executionTime: 10,
				tokenUsage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
			},
		};
	},
});

describe("BatchEvaluator telemetry", () => {
	beforeEach(() => {
		exporter.reset();
		_resetTracer();
	});

	it("should create span hierarchy: batch → parse_input, process_row → run_evaluators", async () => {
		const batch = new BatchEvaluator({
			evaluators: [createMockEvaluator("fluency")],
			concurrency: 1,
		});

		await batch.evaluate({
			data: [{ candidateText: "Hello world" }],
		});

		const spans = exporter.getFinishedSpans();
		const spanNames = spans.map((s) => s.name).sort();

		// No parse_input span for in-memory data (no I/O to trace)
		expect(spanNames).toEqual([
			"eval-kit.batch.evaluate",
			"eval-kit.batch.process_row",
			"eval-kit.batch.run_evaluators",
		]);

		// Verify parent-child relationships
		const batchSpan = spans.find((s) => s.name === "eval-kit.batch.evaluate");
		const rowSpan = spans.find((s) => s.name === "eval-kit.batch.process_row");
		const evalSpan = spans.find(
			(s) => s.name === "eval-kit.batch.run_evaluators",
		);

		expect(rowSpan?.parentSpanId).toBe(batchSpan?.spanContext().spanId);
		expect(evalSpan?.parentSpanId).toBe(rowSpan?.spanContext().spanId);
	});

	it("should set correct attributes on batch span", async () => {
		const batch = new BatchEvaluator({
			evaluators: [createMockEvaluator("fluency")],
			concurrency: 3,
		});

		await batch.evaluate({
			data: [{ candidateText: "Row 1" }, { candidateText: "Row 2" }],
		});

		const batchSpan = exporter
			.getFinishedSpans()
			.find((s) => s.name === "eval-kit.batch.evaluate");

		expect(batchSpan?.attributes["eval_kit.batch.concurrency"]).toBe(3);
		expect(batchSpan?.attributes["eval_kit.batch.total_rows"]).toBe(2);
		expect(batchSpan?.attributes["eval_kit.batch.successful_rows"]).toBe(2);
		expect(batchSpan?.attributes["eval_kit.batch.failed_rows"]).toBe(0);
		expect(batchSpan?.status.code).toBe(SpanStatusCode.OK);
	});

	it("should set correct attributes on process_row span", async () => {
		const batch = new BatchEvaluator({
			evaluators: [createMockEvaluator("accuracy")],
			concurrency: 1,
		});

		await batch.evaluate({
			data: [{ candidateText: "Test row", id: "custom-id" }],
		});

		const rowSpan = exporter
			.getFinishedSpans()
			.find((s) => s.name === "eval-kit.batch.process_row");

		expect(rowSpan?.attributes["eval_kit.row.id"]).toBe("custom-id");
		expect(rowSpan?.attributes["eval_kit.row.index"]).toBe(0);
		expect(rowSpan?.attributes["eval_kit.row.retry_count"]).toBe(0);
		expect(
			rowSpan?.attributes["eval_kit.row.duration_ms"],
		).toBeGreaterThanOrEqual(0);
		expect(rowSpan?.status.code).toBe(SpanStatusCode.OK);
	});

	it("should record retry events on process_row span", async () => {
		let callCount = 0;
		const flaky: IEvaluator = {
			name: "flaky",
			evaluate: async () => {
				callCount++;
				if (callCount <= 2) {
					throw new Error("ECONNRESET");
				}
				return {
					evaluatorName: "flaky",
					score: 80,
					feedback: "OK",
					processingStats: { executionTime: 5 },
				};
			},
		};

		const batch = new BatchEvaluator({
			evaluators: [flaky],
			concurrency: 1,
			retryConfig: {
				maxRetries: 3,
				retryDelay: 1, // 1ms for fast tests
				exponentialBackoff: false,
			},
		});

		await batch.evaluate({
			data: [{ candidateText: "Test" }],
		});

		const rowSpan = exporter
			.getFinishedSpans()
			.find((s) => s.name === "eval-kit.batch.process_row");

		// Should have 2 retry events
		const retryEvents = rowSpan?.events.filter((e) => e.name === "retry");
		expect(retryEvents).toHaveLength(2);
		expect(retryEvents?.[0].attributes?.["eval_kit.retry.attempt"]).toBe(1);
		expect(retryEvents?.[0].attributes?.["eval_kit.retry.error"]).toBe(
			"ECONNRESET",
		);
		expect(retryEvents?.[1].attributes?.["eval_kit.retry.attempt"]).toBe(2);

		// Final span should be OK (recovered)
		expect(rowSpan?.attributes["eval_kit.row.retry_count"]).toBe(2);
		expect(rowSpan?.status.code).toBe(SpanStatusCode.OK);
	});

	it("should set error status on process_row span when all retries exhausted", async () => {
		const failing: IEvaluator = {
			name: "failing",
			evaluate: async () => {
				throw new Error("ECONNRESET");
			},
		};

		const batch = new BatchEvaluator({
			evaluators: [failing],
			concurrency: 1,
			retryConfig: {
				maxRetries: 1,
				retryDelay: 1,
			},
		});

		await batch.evaluate({
			data: [{ candidateText: "Test" }],
		});

		const rowSpan = exporter
			.getFinishedSpans()
			.find((s) => s.name === "eval-kit.batch.process_row");

		expect(rowSpan?.status.code).toBe(SpanStatusCode.ERROR);
		expect(rowSpan?.attributes["eval_kit.result.error"]).toBe("ECONNRESET");
		expect(rowSpan?.attributes["eval_kit.row.retry_count"]).toBe(1);
	});

	it("should skip parse_input span for in-memory data", async () => {
		const batch = new BatchEvaluator({
			evaluators: [createMockEvaluator("test")],
			concurrency: 1,
		});

		await batch.evaluate({
			data: [
				{ candidateText: "Row 1" },
				{ candidateText: "Row 2" },
				{ candidateText: "Row 3" },
			],
		});

		const parseSpan = exporter
			.getFinishedSpans()
			.find((s) => s.name === "eval-kit.batch.parse_input");

		expect(parseSpan).toBeUndefined();
	});
});
