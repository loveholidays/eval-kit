# eval-kit

A TypeScript SDK for evaluating content quality using traditional metrics and AI-powered evaluation.

## Features

- **Traditional Metrics**: BLEU, TER, BERTScore, Coherence, Perplexity
- **AI-Powered Evaluation**: LLM-based evaluator with prompt templating (via Vercel AI SDK)
- **Batch Processing**: Concurrent execution, progress tracking, retry logic, CSV/JSON export

## Installation

```bash
npm install @loveholidays/eval-kit
# or
pnpm add @loveholidays/eval-kit
```

For AI evaluation, you'll also need an AI SDK provider:

```bash
npm install @ai-sdk/openai
# or @ai-sdk/anthropic, @ai-sdk/google, etc.
```

## Quick Start

### Traditional Metrics

```typescript
import { calculateBleu, calculateCoherence } from '@loveholidays/eval-kit';

// BLEU score for translation quality
const bleuResult = calculateBleu(
  'The cat sits on the mat',
  ['The cat is on the mat']
);
console.log(bleuResult.score); // 75.98

// Coherence for text flow
const coherenceResult = calculateCoherence(
  'The cat sat on the mat. It was comfortable.'
);
console.log(coherenceResult.score); // 65.43
```

### AI-Powered Evaluation

```typescript
import { openai } from '@ai-sdk/openai';
import { Evaluator } from '@loveholidays/eval-kit';

const evaluator = Evaluator.create('fluency', openai('gpt-4'));

const result = await evaluator.evaluate({
  candidateText: 'The quick brown fox jumps over the lazy dog.'
});

console.log(result.score);    // 95
console.log(result.feedback); // "Excellent fluency..."
```

### Batch Evaluation

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { BatchEvaluator, Evaluator } from '@loveholidays/eval-kit';

const evaluator = new Evaluator({
  name: 'quality',
  model: anthropic('claude-3-5-haiku-20241022'),
  evaluationPrompt: 'Rate the quality of this text from 1-10.',
  scoreConfig: { type: 'numeric', min: 1, max: 10 },
});

const batchEvaluator = new BatchEvaluator({
  evaluators: [evaluator],
  concurrency: 5,
  onResult: (result) => console.log(`Row ${result.rowId}: ${result.results[0].score}`),
});

const result = await batchEvaluator.evaluate({ filePath: './data.csv' });

await batchEvaluator.export({
  format: 'csv',
  destination: './results.csv',
});
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Metrics](./docs/METRICS.md) | BLEU, TER, BERTScore, Coherence, Perplexity |
| [Evaluator](./docs/EVALUATOR.md) | AI-powered evaluation and scoring |
| [Batch Evaluation](./docs/BATCH_EVALUATION_GUIDE.md) | Concurrent processing, progress tracking |
| [Export](./docs/EXPORT_GUIDE.md) | CSV and JSON export options |

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

This package uses [Changesets](https://github.com/changesets/changesets) for version management and is published to the npm registry.

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
   - Publish to [npm registry](https://www.npmjs.com/package/@loveholidays/eval-kit)
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

MIT
