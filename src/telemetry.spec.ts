import { beforeEach, describe, expect, it } from "@jest/globals";
import {
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { _resetTracer, SpanStatusCode, withSpan } from "./telemetry.js";

// Set up a real OTel SDK so spans are captured
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

describe("telemetry", () => {
	beforeEach(() => {
		exporter.reset();
		_resetTracer();
	});

	describe("withSpan", () => {
		it("should create a span with correct name and attributes", async () => {
			const result = await withSpan(
				"test.operation",
				{
					attributes: {
						"test.key": "value",
						"test.number": 42,
					},
				},
				async () => "hello",
			);

			expect(result).toBe("hello");

			const spans = exporter.getFinishedSpans();
			expect(spans).toHaveLength(1);
			expect(spans[0].name).toBe("test.operation");
			expect(spans[0].attributes["test.key"]).toBe("value");
			expect(spans[0].attributes["test.number"]).toBe(42);
			expect(spans[0].status.code).toBe(SpanStatusCode.OK);
		});

		it("should record exception and set error status on failure", async () => {
			const testError = new Error("test failure");

			await expect(
				withSpan("test.failing", {}, async () => {
					throw testError;
				}),
			).rejects.toThrow("test failure");

			const spans = exporter.getFinishedSpans();
			expect(spans).toHaveLength(1);
			expect(spans[0].status.code).toBe(SpanStatusCode.ERROR);
			expect(spans[0].status.message).toBe("test failure");
			expect(spans[0].events).toHaveLength(1);
			expect(spans[0].events[0].name).toBe("exception");
		});

		it("should allow adding attributes during execution", async () => {
			await withSpan("test.dynamic", {}, async (span) => {
				span.setAttribute("dynamic.key", "added-later");
			});

			const spans = exporter.getFinishedSpans();
			expect(spans).toHaveLength(1);
			expect(spans[0].attributes["dynamic.key"]).toBe("added-later");
		});

		it("should allow adding events during execution", async () => {
			await withSpan("test.events", {}, async (span) => {
				span.addEvent("custom_event", {
					"event.detail": "something happened",
				});
			});

			const spans = exporter.getFinishedSpans();
			expect(spans).toHaveLength(1);
			expect(spans[0].events).toHaveLength(1);
			expect(spans[0].events[0].name).toBe("custom_event");
		});

		it("should nest spans correctly via async context", async () => {
			await withSpan("parent", {}, async () => {
				await withSpan("child", {}, async () => {
					// child span
				});
			});

			const spans = exporter.getFinishedSpans();
			expect(spans).toHaveLength(2);

			const child = spans.find((s) => s.name === "child");
			const parent = spans.find((s) => s.name === "parent");
			expect(child).toBeDefined();
			expect(parent).toBeDefined();
			// Child's parent span ID should match parent's span ID
			expect(child?.parentSpanId).toBe(parent?.spanContext().spanId);
		});
	});
});
