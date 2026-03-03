# OpenTelemetry Telemetry Guide

eval-kit provides built-in [OpenTelemetry](https://opentelemetry.io/) tracing. When enabled, it emits spans for evaluations, batch processing, retries, and async metrics — giving you visibility into per-row latency, token usage, retry behavior, and where time is spent.

## Setup

### 1. Install dependencies

`@opentelemetry/api` is an optional peer dependency. Install it along with an SDK and exporter:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/sdk-trace-base
```

### 2. Configure the OTel SDK

Set up a tracer provider **before** calling any eval-kit functions:

```typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';

const provider = new NodeTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
provider.register();
```

For production, replace `ConsoleSpanExporter` with your backend exporter (Jaeger, OTLP, Zipkin, etc.).

### 3. Use eval-kit as normal

No code changes needed. eval-kit detects the registered provider and emits spans automatically.

## Zero overhead when disabled

When `@opentelemetry/api` is not installed, eval-kit uses no-op stubs internally. All tracing calls become empty function calls that are optimized away by the JS engine. There is no performance impact.

## Span Hierarchy

### Batch evaluation

```
eval-kit.batch.evaluate
├── eval-kit.batch.parse_input           (file-based input only)
├── eval-kit.batch.process_row           (per row)
│   ├── [retry event]                    (on retry attempts)
│   └── eval-kit.batch.run_evaluators
│       └── eval-kit.evaluator.evaluate  (per evaluator)
└── eval-kit.batch.export                (when export() is called)
```

### Single evaluation

```
eval-kit.evaluator.evaluate
```

### Async metrics (standalone)

```
eval-kit.metric.bert_score
eval-kit.metric.perplexity
```

## Span Attributes

### `eval-kit.evaluator.evaluate`

| Attribute | Type | Description |
|-----------|------|-------------|
| `eval_kit.evaluator.name` | string | Evaluator name |
| `eval_kit.model.id` | string | Model identifier |
| `eval_kit.score_config.type` | string | `"numeric"` or `"categorical"` |
| `eval_kit.input.candidate_text_length` | number | Length of input text |
| `eval_kit.result.score` | number/string | Evaluation score |
| `eval_kit.result.execution_time_ms` | number | Wall clock time |
| `eval_kit.result.token_usage.input` | number | Input tokens consumed |
| `eval_kit.result.token_usage.output` | number | Output tokens generated |
| `eval_kit.result.token_usage.total` | number | Total tokens |
| `eval_kit.result.error` | string | Error message (on failure) |

### `eval-kit.batch.evaluate`

| Attribute | Type | Description |
|-----------|------|-------------|
| `eval_kit.batch.id` | string | Unique batch ID |
| `eval_kit.batch.concurrency` | number | Max concurrent rows |
| `eval_kit.batch.execution_mode` | string | `"parallel"` or `"sequential"` |
| `eval_kit.batch.total_rows` | number | Total rows in input |
| `eval_kit.batch.successful_rows` | number | Rows completed successfully |
| `eval_kit.batch.failed_rows` | number | Rows that failed |

### `eval-kit.batch.process_row`

| Attribute | Type | Description |
|-----------|------|-------------|
| `eval_kit.row.id` | string | Row identifier |
| `eval_kit.row.index` | number | Row index in input |
| `eval_kit.row.duration_ms` | number | Total time including retries |
| `eval_kit.row.retry_count` | number | Number of retry attempts |
| `eval_kit.result.error` | string | Error message (on failure) |

**Retry events** are recorded on this span with name `retry`:

| Event Attribute | Type | Description |
|----------------|------|-------------|
| `eval_kit.retry.attempt` | number | Retry attempt number (1-based) |
| `eval_kit.retry.delay_ms` | number | Delay before retry |
| `eval_kit.retry.error` | string | Error that triggered the retry |

### `eval-kit.batch.run_evaluators`

| Attribute | Type | Description |
|-----------|------|-------------|
| `eval_kit.evaluator_count` | number | Number of evaluators |
| `eval_kit.execution_mode` | string | `"parallel"` or `"sequential"` |

### `eval-kit.batch.parse_input`

Only created for file-based input (not in-memory data).

| Attribute | Type | Description |
|-----------|------|-------------|
| `eval_kit.parse.input_format` | string | `"file"` |
| `eval_kit.parse.row_count` | number | Number of parsed rows |

### `eval-kit.batch.export`

| Attribute | Type | Description |
|-----------|------|-------------|
| `eval_kit.export.format` | string | `"csv"` or `"json"` |
| `eval_kit.export.row_count` | number | Number of exported rows |

### `eval-kit.metric.bert_score` / `eval-kit.metric.perplexity`

| Attribute | Type | Description |
|-----------|------|-------------|
| `eval_kit.metric.name` | string | Metric name |
| `eval_kit.metric.model` | string | Model used |
| `eval_kit.result.score` | number | Computed score |

A `model_loaded` event is recorded when the model is loaded for the first time (cache miss).

## Custom Evaluator Instrumentation

If you implement `IEvaluator` and want your spans to appear in the trace hierarchy, use the exported `withSpan` helper:

```typescript
import { withSpan, type IEvaluator, type EvaluatorResult } from '@loveholidays/eval-kit';

const myEvaluator: IEvaluator = {
  name: 'custom-eval',
  async evaluate(input) {
    return withSpan(
      'my-app.custom-eval',
      { attributes: { 'my_app.evaluator.name': 'custom-eval' } },
      async (span) => {
        // Your evaluation logic here
        const score = await computeScore(input.candidateText);

        span.setAttribute('my_app.result.score', score);
        return {
          evaluatorName: 'custom-eval',
          score,
          feedback: 'Custom evaluation',
          processingStats: { executionTime: 0 },
        };
      },
    );
  },
};
```

Your `my-app.custom-eval` span will automatically appear as a child of `eval-kit.batch.run_evaluators` when used in a batch evaluation, because `withSpan` uses the active async context.

## Example: Full Setup with Jaeger

```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { BatchEvaluator, Evaluator } from '@loveholidays/eval-kit';

// Configure OTel
const provider = new NodeTracerProvider({
  resource: new Resource({ [ATTR_SERVICE_NAME]: 'my-eval-pipeline' }),
});
provider.addSpanProcessor(
  new BatchSpanProcessor(new OTLPTraceExporter({ url: 'http://localhost:4318/v1/traces' }))
);
provider.register();

// Run evaluation — spans are exported to Jaeger automatically
const batch = new BatchEvaluator({ evaluators: [evaluator], concurrency: 10 });
const result = await batch.evaluate({ filePath: './data.csv' });

// Flush spans before exit
await provider.shutdown();
```
