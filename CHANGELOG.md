# @loveholidays/eval-kit

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
