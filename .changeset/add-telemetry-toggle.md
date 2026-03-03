---
"@loveholidays/eval-kit": minor
---

Add optional OpenTelemetry tracing support for evaluations, batch processing, and async metrics.

- Emit spans for `Evaluator.evaluate`, `BatchEvaluator.evaluate`, row processing, retries, and BERT/perplexity metrics
- `@opentelemetry/api` is an optional peer dependency — zero overhead when not installed
- Telemetry is disabled by default; call `enableTelemetry(true)` to opt in
- `isTelemetryEnabled()` getter for reading the current state
- Exported `withSpan` helper for custom evaluator instrumentation
