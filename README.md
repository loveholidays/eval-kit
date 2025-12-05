# eval-kit

A comprehensive TypeScript SDK for evaluating content quality using both traditional metrics and AI-powered evaluation.

## Features

- **Lightweight Metrics** - BLEU, TER, Coherence (no external models required)
- **Heavy Metrics** - BERTScore, Perplexity (requires downloading transformer models)
- **AI-Powered Evaluation** - LLM evaluator with prompt templating via Vercel AI SDK
- **Batch Processing** - Concurrent execution, progress tracking, streaming export, fault tolerance

## Installation

```bash
npm install eval-kit
# or
pnpm add eval-kit
```

For AI evaluation features, you'll also need an AI SDK provider:

```bash
npm install @ai-sdk/openai
# or @ai-sdk/anthropic, @ai-sdk/google, etc.
```

## Quick Start

### Traditional Metrics

```typescript
import { calculateBleu, calculateCoherence } from 'eval-kit';

// BLEU Score for translation quality
const bleuResult = calculateBleu(
  'The cat sits on the mat',
  ['The cat is on the mat']
);
console.log(bleuResult.score); // 0.7598

// Coherence for text quality
const coherenceResult = calculateCoherence(
  'The cat sat on the mat. It was comfortable.'
);
console.log(coherenceResult.score); // 0.6543
```

### AI-Powered Evaluation

```typescript
import { openai } from '@ai-sdk/openai';
import { Evaluator } from 'eval-kit';

const evaluator = Evaluator.create('fluency', openai('gpt-4'));

const result = await evaluator.evaluate({
  candidateText: 'The quick brown fox jumps over the lazy dog.'
});

console.log(result.score);    // 95
console.log(result.feedback); // Detailed feedback
```

### Batch Evaluation

```typescript
import { BatchEvaluator, createAIContentEvaluator } from 'eval-kit';

const batchEvaluator = new BatchEvaluator({
  evaluators: [createAIContentEvaluator({ model, contentType: 'article' })],
  concurrency: 5,
  streamExport: { format: 'csv', destination: './results.csv' },
});

await batchEvaluator.evaluate({ filePath: './data.json' });
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Metrics](./docs/METRICS.md) | BLEU, TER, BERTScore, Coherence, Perplexity |
| [Evaluator](./docs/EVALUATOR.md) | AI-powered evaluation, scoring |
| [Batch Evaluation](./docs/BATCH_EVALUATION_GUIDE.md) | Concurrent processing, progress tracking, state management |
| [Export](./docs/EXPORT_GUIDE.md) | CSV, JSON, webhook exports |

## Supported LLM Providers

Via [Vercel AI SDK](https://sdk.vercel.ai/providers/ai-sdk-providers): OpenAI, Anthropic, Google, Mistral, Groq, Cohere, and any OpenAI-compatible endpoint.

## Development

```bash
pnpm install    # Install dependencies
pnpm build      # Build the project
pnpm test       # Run tests
pnpm lint       # Lint code
```

## Publishing

This package uses [Changesets](https://github.com/changesets/changesets) for version management and is published to the loveholidays Google Artifact Registry.

### Creating a Release

1. **Add a changeset** when you make changes that should be released:
   ```bash
   pnpm changeset
   ```
   - Select the version bump type (patch/minor/major)
   - Write a summary of your changes
   - This creates a markdown file in `.changeset/`

2. **Merge to main** — The CI will automatically:
   - Detect changesets
   - Bump the version in `package.json`
   - Update `CHANGELOG.md`
   - Publish to Google Artifact Registry
   - Push git tags

### Manual Publishing

For local testing or manual releases:

```bash
pnpm build              # Build the package
pnpm changeset version  # Apply version bumps
pnpm changeset publish  # Publish to registry
```

### Version Types

| Type | When to use |
|------|-------------|
| `patch` | Bug fixes, small updates |
| `minor` | New features (backwards compatible) |
| `major` | Breaking changes |

## License

ISC
