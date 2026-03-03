/**
 * Tests for the noop fallback path — the default experience when
 * @opentelemetry/api is not installed.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

// Mock the dynamic import to simulate @opentelemetry/api not being installed.
// This MUST be before importing telemetry.
jest.unstable_mockModule("@opentelemetry/api", () => {
	throw new Error("Cannot find module '@opentelemetry/api'");
});

const { _resetTracer, withSpan, getTracer, getCachedTracer } = await import(
	"./telemetry.js"
);

describe("telemetry noop fallback", () => {
	beforeEach(() => {
		_resetTracer();
	});

	describe("withSpan", () => {
		it("should execute callback and return result when OTel is absent", async () => {
			const result = await withSpan(
				"test.operation",
				{ attributes: { "test.key": "value" } },
				async () => 42,
			);

			expect(result).toBe(42);
		});

		it("should still propagate errors from callback", async () => {
			await expect(
				withSpan("test.failing", {}, async () => {
					throw new Error("callback error");
				}),
			).rejects.toThrow("callback error");
		});

		it("should provide a noop span that accepts all operations without error", async () => {
			await withSpan("test.noop", {}, async (span) => {
				// All of these should be silent no-ops
				span.setAttribute("key", "value");
				span.setAttribute("num", 123);
				span.setAttribute("bool", true);
				span.setStatus({ code: 1 });
				span.setStatus({ code: 2, message: "error" });
				span.addEvent("event", { "detail": "test" });
				span.recordException(new Error("test"));
				span.recordException("string error");
				span.end();
			});
		});

		it("should handle nested withSpan calls with noop tracer", async () => {
			const result = await withSpan(
				"parent",
				{},
				async () => {
					return withSpan(
						"child",
						{},
						async () => "nested-result",
					);
				},
			);

			expect(result).toBe("nested-result");
		});
	});

	describe("getTracer", () => {
		it("should return a tracer that produces noop spans", async () => {
			const tracer = await getTracer();
			expect(tracer).toBeDefined();

			// The noop tracer's startActiveSpan should execute the callback
			const result = tracer.startActiveSpan(
				"test",
				{},
				(span) => {
					span.setAttribute("key", "value");
					span.end();
					return "result";
				},
			);
			expect(result).toBe("result");
		});
	});

	describe("getCachedTracer", () => {
		it("should return noop tracer before any async resolution", () => {
			_resetTracer();
			const tracer = getCachedTracer();
			expect(tracer).toBeDefined();

			const result = tracer.startActiveSpan(
				"test",
				{},
				(span) => {
					span.setAttribute("key", "value");
					span.end();
					return "sync-result";
				},
			);
			expect(result).toBe("sync-result");
		});

		it("should still return noop tracer after failed resolution", async () => {
			// Trigger resolution (which will fail due to our mock)
			await getTracer();

			const tracer = getCachedTracer();
			const result = tracer.startActiveSpan(
				"test",
				{},
				() => "post-resolution",
			);
			expect(result).toBe("post-resolution");
		});
	});
});
