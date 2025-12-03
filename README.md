# eval-kit

A comprehensive TypeScript SDK for evaluating content quality using both traditional metrics and AI-powered evaluation.

## Features

- **Traditional Metrics** - BLEU, TER, BERTScore, Coherence, Perplexity
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

## License

ISC
