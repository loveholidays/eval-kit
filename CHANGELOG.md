# @loveholidays/eval-kit

## 1.2.0

### Minor Changes

- 92eb466: Expose detailed AI SDK token usage on evaluator results.

## 1.1.5

### Patch Changes

- 05350dc: Migrate evaluator structured output generation to AI SDK v6.

## 1.1.4

### Patch Changes

- f06e185: Retry publish with Node 22 for native npm OIDC trusted publishing support

## 1.1.3

### Patch Changes

- 8b890fe: Retry publish after fixing OIDC auth token conflict in CI workflow

## 1.1.2

### Patch Changes

- 67caf2a: Retry publish with corrected npm scope registry configuration

## 1.1.1

### Patch Changes

- e09274a: Fix onResult callback not being called for failed rows in BatchEvaluator. Previously, errors were silently dropped and consumers relying on onResult for logging or persistence never received failure notifications.

## 1.1.0

### Minor Changes

- 5ec9890: Add optional OpenTelemetry tracing support for evaluations, batch processing, and async metrics.

  - Emit spans for `Evaluator.evaluate`, `BatchEvaluator.evaluate`, row processing, retries, and BERT/perplexity metrics
  - `@opentelemetry/api` is an optional peer dependency — zero overhead when not installed
  - Telemetry is disabled by default; call `enableTelemetry(true)` to opt in
  - `isTelemetryEnabled()` getter for reading the current state
  - Exported `withSpan` helper for custom evaluator instrumentation

## 1.0.2

### Patch Changes

- f4f1cf4: Fix lodash prototype pollution vulnerability (CVE-2025-13465) by forcing lodash >=4.17.23 via pnpm overrides. This addresses a security issue where _.unset and _.omit functions could be exploited to delete methods from global prototypes.

## 1.0.1

### Patch Changes

- 1626670: Fix security vulnerability in transitive dependency

  Updated `diff` package from 8.0.2 to 8.0.3 to address Dependabot alert #4 (GHSA-73rr-hh4g-fpgx). This fixes a low-severity Denial of Service vulnerability in the parsePatch and applyPatch methods that could cause infinite loops when processing patches with specific line break characters.

  This is a dev dependency used by build tooling and does not affect the runtime behavior of the package.

## 1.0.0

### Major Changes

- ea02e58: Initial public release of eval-kit

  This is the first public release of eval-kit, a TypeScript SDK for content evaluation.

  **Features:**

  - Traditional metrics (BLEU, TER, BERTScore, Coherence, Perplexity)
  - AI-powered evaluation with LLM-based evaluators (via Vercel AI SDK)
  - Batch processing with concurrent execution and progress tracking
  - CSV and JSON export capabilities
  - Full TypeScript support with comprehensive type definitions
  - Support for multiple LLM providers (OpenAI, Anthropic, Google, Mistral, Groq, Cohere)
