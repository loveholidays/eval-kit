/**
 * OpenTelemetry instrumentation for eval-kit.
 *
 * Uses dynamic import so @opentelemetry/api is an optional peer dependency.
 * When the package is not installed or no SDK is configured, all tracing
 * operations are no-ops with zero overhead.
 */

declare const __EVAL_KIT_VERSION__: string;

// ---------- Type stubs (mirror the OTel API surface we use) ----------

interface SpanAttributes {
	[key: string]: string | number | boolean | undefined;
}

/**
 * Minimal span interface matching the subset of @opentelemetry/api Span we use.
 */
export interface EvalKitSpan {
	setAttribute(key: string, value: string | number | boolean): void;
	setStatus(status: { code: number; message?: string }): void;
	recordException(error: Error | string): void;
	addEvent(name: string, attributes?: SpanAttributes): void;
	end(): void;
}

interface Tracer {
	startActiveSpan<T>(
		name: string,
		options: { attributes?: SpanAttributes },
		fn: (span: EvalKitSpan) => T,
	): T;
}

// ---------- No-op implementations ----------

const noopSpan: EvalKitSpan = {
	setAttribute() {},
	setStatus() {},
	recordException() {},
	addEvent() {},
	end() {},
};

const noopTracer: Tracer = {
	startActiveSpan<T>(
		_name: string,
		_options: { attributes?: SpanAttributes },
		fn: (span: EvalKitSpan) => T,
	): T {
		return fn(noopSpan);
	},
};

// ---------- Lazy tracer resolution ----------

let resolvedTracer: Tracer | null = null;
let tracerPromise: Promise<Tracer> | null = null;

function resolveTracer(): Promise<Tracer> {
	if (!tracerPromise) {
		tracerPromise = (async () => {
			try {
				const api = await import("@opentelemetry/api");
				const version =
					typeof __EVAL_KIT_VERSION__ !== "undefined"
						? __EVAL_KIT_VERSION__
						: "unknown";
				const tracer = api.trace.getTracer("eval-kit", version);
				// Wrap the OTel tracer with an explicit adapter at the boundary
				const wrapSpan = (
					span: import("@opentelemetry/api").Span,
				): EvalKitSpan => ({
					setAttribute: (key, value) => span.setAttribute(key, value),
					setStatus: (status) => span.setStatus(status),
					recordException: (error) => span.recordException(error),
					addEvent: (name, attributes) => span.addEvent(name, attributes),
					end: () => span.end(),
				});

				resolvedTracer = {
					startActiveSpan<T>(
						name: string,
						options: { attributes?: SpanAttributes },
						fn: (span: EvalKitSpan) => T,
					): T {
						return tracer.startActiveSpan(name, options, (span) =>
							fn(wrapSpan(span)),
						);
					},
				};
				return resolvedTracer;
			} catch {
				// @opentelemetry/api not installed — use no-op
				resolvedTracer = noopTracer;
				return noopTracer;
			}
		})();
	}
	return tracerPromise;
}

// ---------- Status codes (match OTel SpanStatusCode) ----------

export const SpanStatusCode = {
	UNSET: 0,
	OK: 1,
	ERROR: 2,
} as const;

// ---------- Public API ----------

/**
 * Get the eval-kit tracer (async). Triggers resolution on first call.
 */
export async function getTracer(): Promise<Tracer> {
	return resolveTracer();
}

/**
 * Get the cached tracer synchronously. Returns no-op if the tracer
 * hasn't been resolved yet (i.e., no prior withSpan/getTracer call).
 * Use this in hot paths where the tracer is guaranteed to be resolved
 * by a parent span.
 */
export function getCachedTracer(): Tracer {
	return resolvedTracer ?? noopTracer;
}

export interface WithSpanOptions {
	attributes?: SpanAttributes;
}

/**
 * Wrap an async operation with an OpenTelemetry span.
 *
 * - Creates a child span under the current active span (if any)
 * - Sets initial attributes from options
 * - On success: sets status OK, ends span
 * - On error: records exception, sets status ERROR, ends span, re-throws
 * - The callback receives the span so it can add attributes/events during execution
 */
export async function withSpan<T>(
	name: string,
	options: WithSpanOptions,
	fn: (span: EvalKitSpan) => Promise<T>,
): Promise<T> {
	const tracer = await resolveTracer();
	return tracer.startActiveSpan(
		name,
		{ attributes: options.attributes },
		async (span) => {
			try {
				const result = await fn(span);
				span.setStatus({ code: SpanStatusCode.OK });
				return result;
			} catch (error) {
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: error instanceof Error ? error.message : String(error),
				});
				span.recordException(error instanceof Error ? error : String(error));
				throw error;
			} finally {
				span.end();
			}
		},
	);
}

/**
 * Reset the cached tracer. Only used in tests.
 */
export function _resetTracer(): void {
	resolvedTracer = null;
	tracerPromise = null;
}
