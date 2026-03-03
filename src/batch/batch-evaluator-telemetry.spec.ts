import { beforeEach, describe, expect, it } from "@jest/globals";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
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

const createMockEvaluator = (name: string): IEvaluator => ({
	name,
	evaluate: async (_input: EvaluationInput): Promise<EvaluatorResult> => ({
		evaluatorName: name,
		model: "mock-model",
		score: 85,
		feedback: "Good",
		processingStats: {
			executionTime: 10,
			tokenUsage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
		},
	}),
});

async function runBatch(
	evaluators: IEvaluator[],
	data: { candidateText: string; id?: string }[],
	config?: {
		concurrency?: number;
		retryConfig?: {
			maxRetries: number;
			retryDelay: number;
			exponentialBackoff?: boolean;
		};
	},
) {
	const batch = new BatchEvaluator({
		evaluators,
		concurrency: config?.concurrency ?? 1,
		retryConfig: config?.retryConfig,
	});
	await batch.evaluate({ data });
	return exporter.getFinishedSpans();
}

function getSpan(spans: ReadableSpan[], name: string): ReadableSpan {
	const span = spans.find((s) => s.name === name);
	expect(span).toBeDefined();
	return span as ReadableSpan;
}

describe("BatchEvaluator telemetry", () => {
	beforeEach(() => {
		exporter.reset();
		_resetTracer();
	});

	it("should create span hierarchy: batch → process_row → run_evaluators", async () => {
		const spans = await runBatch(
			[createMockEvaluator("fluency")],
			[{ candidateText: "Hello world" }],
		);

		expect(spans.map((s) => s.name).sort()).toEqual([
			"eval-kit.batch.evaluate",
			"eval-kit.batch.process_row",
			"eval-kit.batch.run_evaluators",
		]);

		const batchSpan = getSpan(spans, "eval-kit.batch.evaluate");
		const rowSpan = getSpan(spans, "eval-kit.batch.process_row");
		const evalSpan = getSpan(spans, "eval-kit.batch.run_evaluators");

		expect(rowSpan.parentSpanId).toBe(batchSpan.spanContext().spanId);
		expect(evalSpan.parentSpanId).toBe(rowSpan.spanContext().spanId);
	});

	it("should set correct attributes on batch span", async () => {
		const spans = await runBatch(
			[createMockEvaluator("fluency")],
			[{ candidateText: "Row 1" }, { candidateText: "Row 2" }],
			{ concurrency: 3 },
		);

		const span = getSpan(spans, "eval-kit.batch.evaluate");
		expect(span.attributes["eval_kit.batch.concurrency"]).toBe(3);
		expect(span.attributes["eval_kit.batch.total_rows"]).toBe(2);
		expect(span.attributes["eval_kit.batch.successful_rows"]).toBe(2);
		expect(span.attributes["eval_kit.batch.failed_rows"]).toBe(0);
		expect(span.status.code).toBe(SpanStatusCode.OK);
	});

	it("should set correct attributes on process_row span", async () => {
		const spans = await runBatch(
			[createMockEvaluator("accuracy")],
			[{ candidateText: "Test row", id: "custom-id" }],
		);

		const span = getSpan(spans, "eval-kit.batch.process_row");
		expect(span.attributes["eval_kit.row.id"]).toBe("custom-id");
		expect(span.attributes["eval_kit.row.index"]).toBe(0);
		expect(span.attributes["eval_kit.row.retry_count"]).toBe(0);
		expect(span.attributes["eval_kit.row.duration_ms"]).toBeGreaterThanOrEqual(
			0,
		);
		expect(span.status.code).toBe(SpanStatusCode.OK);
	});

	it("should record retry events on process_row span", async () => {
		let callCount = 0;
		const flaky: IEvaluator = {
			name: "flaky",
			evaluate: async () => {
				callCount++;
				if (callCount <= 2) throw new Error("ECONNRESET");
				return {
					evaluatorName: "flaky",
					score: 80,
					feedback: "OK",
					processingStats: { executionTime: 5 },
				};
			},
		};

		const spans = await runBatch([flaky], [{ candidateText: "Test" }], {
			retryConfig: { maxRetries: 3, retryDelay: 1, exponentialBackoff: false },
		});

		const span = getSpan(spans, "eval-kit.batch.process_row");
		const retryEvents = span.events.filter((e) => e.name === "retry");

		expect(retryEvents).toHaveLength(2);
		expect(retryEvents[0].attributes?.["eval_kit.retry.attempt"]).toBe(1);
		expect(retryEvents[0].attributes?.["eval_kit.retry.error"]).toBe(
			"ECONNRESET",
		);
		expect(retryEvents[1].attributes?.["eval_kit.retry.attempt"]).toBe(2);
		expect(span.attributes["eval_kit.row.retry_count"]).toBe(2);
		expect(span.status.code).toBe(SpanStatusCode.OK);
	});

	it("should set error status on process_row span when all retries exhausted", async () => {
		const failing: IEvaluator = {
			name: "failing",
			evaluate: async () => {
				throw new Error("ECONNRESET");
			},
		};

		const spans = await runBatch([failing], [{ candidateText: "Test" }], {
			retryConfig: { maxRetries: 1, retryDelay: 1 },
		});

		const span = getSpan(spans, "eval-kit.batch.process_row");
		expect(span.status.code).toBe(SpanStatusCode.ERROR);
		expect(span.attributes["eval_kit.result.error"]).toBe("ECONNRESET");
		expect(span.attributes["eval_kit.row.retry_count"]).toBe(1);
	});

	it("should skip parse_input span for in-memory data", async () => {
		const spans = await runBatch(
			[createMockEvaluator("test")],
			[
				{ candidateText: "Row 1" },
				{ candidateText: "Row 2" },
				{ candidateText: "Row 3" },
			],
		);

		const parseSpan = spans.find(
			(s) => s.name === "eval-kit.batch.parse_input",
		);
		expect(parseSpan).toBeUndefined();
	});
});
