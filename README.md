# eval-kit

A TypeScript SDK for evaluating content quality using traditional metrics and AI-powered evaluation.

## Features

- **Traditional Metrics**: BLEU, TER, BERTScore, Coherence, Perplexity
- **AI-Powered Evaluation**: LLM-based evaluator with prompt templating (via Vercel AI SDK)
- **Batch Processing**: Concurrent execution, progress tracking, retry logic, CSV/JSON export

## Installation

```bash
npm install eval-kit
# or
pnpm add eval-kit
```

For AI evaluation, you'll also need an AI SDK provider:

```bash
npm install @ai-sdk/openai
# or @ai-sdk/anthropic, @ai-sdk/google, etc.
```

## Quick Start

### Traditional Metrics

```typescript
import { calculateBleu, calculateCoherence } from 'eval-kit';

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
import { Evaluator } from 'eval-kit';

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
import { BatchEvaluator, Evaluator } from 'eval-kit';

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

## License

ISC
