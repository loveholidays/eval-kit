# eval-kit

A comprehensive TypeScript SDK for evaluating content quality using both traditional metrics and AI-powered evaluation.

## Features

### 📊 Traditional Metrics
- **BLEU** - Translation quality measurement with n-gram precision
- **TER** (Translation Edit Rate) - Edit distance-based translation evaluation
- **BERTScore** - Semantic similarity using BERT embeddings
- **Coherence** - Text coherence using TF-IDF and cosine similarity
- **Perplexity** - Language model-based fluency measurement

### 🤖 AI-Powered Evaluation
- **LLM Evaluator** - Flexible content evaluation using any LLM via Vercel AI SDK
- **Prompt Templating** - Handlebars-style templates with variables and conditionals
- **Configurable Scoring** - Numeric (0-100 default) or categorical scoring
- **Type-Safe Responses** - Zod schema validation for structured output
- **Processing Stats** - Track execution time and token usage

## Installation

```bash
npm install eval-kit
# or
pnpm add eval-kit
# or
yarn add eval-kit
```

For AI evaluation features, you'll also need an AI SDK provider:

```bash
npm install @ai-sdk/openai
# or @ai-sdk/anthropic, @ai-sdk/google, etc.
```

## Quick Start

### Traditional Metrics

```typescript
import { calculateBleu, calculateBertScore, calculateCoherence } from 'eval-kit';

// BLEU Score for translation quality
const bleuResult = calculateBleu(
  'The cat sits on the mat',
  ['The cat is on the mat', 'There is a cat on the mat']
);
console.log(bleuResult.score); // 0.7598

// BERTScore for semantic similarity
const bertResult = await calculateBertScore(
  'The cat sits on the mat',
  'A feline is resting on the rug'
);
console.log(bertResult.f1); // 0.8234

// Coherence for text quality
const coherenceResult = calculateCoherence(
  'The cat sat on the mat. It was comfortable. The weather was nice.'
);
console.log(coherenceResult.score); // 0.6543
```

### AI-Powered Evaluation

```typescript
import { openai } from '@ai-sdk/openai';
import { Evaluator } from 'eval-kit';

// Create an evaluator
const model = openai('gpt-4');
const evaluator = Evaluator.create('fluency', model);

// Evaluate content
const result = await evaluator.evaluate({
  candidateText: 'The quick brown fox jumps over the lazy dog.'
});

console.log(result);
// {
//   evaluatorName: 'fluency',
//   score: 95,
//   feedback: 'Excellent fluency with natural sentence structure...',
//   processingStats: {
//     executionTime: 1243,
//     tokenUsage: { inputTokens: 45, outputTokens: 30, totalTokens: 75 }
//   },
//   success: true
// }
```

### Custom Evaluation with Templates

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { Evaluator } from 'eval-kit';

const model = anthropic('claude-3-5-sonnet-20241022');

// Create evaluator with custom prompt template
const evaluator = new Evaluator({
  name: 'accuracy',
  model,
  evaluationPrompt: `Compare the candidate text against the reference:

Candidate: {{candidateText}}
{{#if referenceText}}Reference: {{referenceText}}{{/if}}

Evaluate the accuracy of the candidate text.`,
  scoreConfig: {
    type: 'categorical',
    categories: ['poor', 'fair', 'good', 'excellent']
  },
  modelSettings: {
    temperature: 0.3,
    maxOutputTokens: 500
  }
});

// Evaluate with reference text
const result = await evaluator.evaluate({
  candidateText: 'Paris is the capital of France',
  referenceText: 'Paris is the capital city of France'
});

console.log(result.score); // 'excellent'
```

## Documentation

### Comprehensive Guides
- **[Metrics Documentation](./docs/METRICS.md)** - Detailed guide for all traditional metrics (BLEU, TER, BERTScore, Coherence, Perplexity)
- **[Evaluator Documentation](./docs/EVALUATOR.md)** - Complete guide for AI-powered evaluation with examples

### Core Concepts

#### Traditional Metrics
Learn about n-gram precision, edit distance, semantic embeddings, and more:
- [BLEU Score](./docs/METRICS.md#bleu-bilingual-evaluation-understudy)
- [TER (Translation Edit Rate)](./docs/METRICS.md#ter-translation-edit-rate)
- [BERTScore](./docs/METRICS.md#bertscore)
- [Coherence](./docs/METRICS.md#coherence)
- [Perplexity](./docs/METRICS.md#perplexity)

#### AI Evaluation
Understand template rendering, scoring configurations, and LLM integration:
- [Template Engine](./docs/EVALUATOR.md#template-engine)
- [Score Configuration](./docs/EVALUATOR.md#score-configuration)
- [Processing Statistics](./docs/EVALUATOR.md#processing-statistics)
- [Model Configuration](./docs/EVALUATOR.md#language-model-configuration)

## API Reference

### Metrics

```typescript
// BLEU
calculateBleu(candidate: string, references: string[], options?: BleuOptions): BleuResult

// TER
calculateTer(candidate: string, reference: string, options?: TerOptions): TerResult

// BERTScore
calculateBertScore(candidate: string, reference: string, options?: BertScoreOptions): Promise<BertScoreResult>

// Coherence
calculateCoherence(text: string, options?: CoherenceOptions): CoherenceResult

// Perplexity
calculatePerplexity(text: string, options?: PerplexityOptions): Promise<PerplexityResult>
```

### AI Evaluator

```typescript
// Create evaluator with defaults
Evaluator.create(name: string, model: LanguageModel, options?: CreateOptions): Evaluator

// Create evaluator with full config
new Evaluator(config: EvaluatorConfig): Evaluator

// Evaluate content
evaluator.evaluate(input: EvaluationInput): Promise<EvaluatorResult>
```

### Template Engine

```typescript
// Create renderer
new TemplateRenderer(): TemplateRenderer

// Render template
renderer.render(template: string, variables: Record<string, unknown>): string

// Validate template
renderer.validate(template: string): string[]
```

## Examples

### Batch Evaluation

```typescript
import { openai } from '@ai-sdk/openai';
import { Evaluator } from 'eval-kit';

const model = openai('gpt-4');
const evaluator = Evaluator.create('quality', model);

const texts = [
  'First text to evaluate',
  'Second text to evaluate',
  'Third text to evaluate'
];

const results = await Promise.all(
  texts.map(text => evaluator.evaluate({ candidateText: text }))
);

console.log(`Average score: ${results.reduce((sum, r) => sum + r.score, 0) / results.length}`);
```

### Multi-Criteria Evaluation with Weighted Scoring

```typescript
import { openai } from '@ai-sdk/openai';
import { Evaluator } from 'eval-kit';

const model = openai('gpt-4');

// Create multiple evaluators
const fluency = Evaluator.create('fluency', model);
const accuracy = Evaluator.create('accuracy', model);
const coherence = Evaluator.create('coherence', model);

const text = 'Text to evaluate for multiple criteria';

// Evaluate with all criteria
const [fluencyResult, accuracyResult, coherenceResult] = await Promise.all([
  fluency.evaluate({ candidateText: text }),
  accuracy.evaluate({ candidateText: text }),
  coherence.evaluate({ candidateText: text })
]);

// Define weights for each criterion
const weights = {
  fluency: 1.0,
  accuracy: 1.5,
  coherence: 1.2
};

// Calculate weighted score
const totalWeight = weights.fluency + weights.accuracy + weights.coherence;
const weightedScore = (
  (fluencyResult.score as number) * weights.fluency +
  (accuracyResult.score as number) * weights.accuracy +
  (coherenceResult.score as number) * weights.coherence
) / totalWeight;

console.log(`Weighted score: ${weightedScore.toFixed(2)}`);
```

### Combining Traditional and AI Metrics

```typescript
import { openai } from '@ai-sdk/openai';
import { Evaluator, calculateBleu, calculateCoherence } from 'eval-kit';

const candidateText = 'The cat sits on the mat';
const referenceText = 'The cat is on the mat';

// Traditional metrics
const bleu = calculateBleu(candidateText, [referenceText]);
const coherence = calculateCoherence(candidateText);

// AI evaluation
const model = openai('gpt-4');
const evaluator = Evaluator.create('overall-quality', model);
const aiResult = await evaluator.evaluate({
  candidateText,
  referenceText
});

console.log({
  bleu: bleu.score,
  coherence: coherence.score,
  aiQuality: aiResult.score,
  aiFeedback: aiResult.feedback
});
```

## Supported LLM Providers

Via Vercel AI SDK, eval-kit supports:

- **OpenAI** - GPT-4, GPT-3.5, etc.
- **Anthropic** - Claude 3.5 Sonnet, Claude 3 Opus, etc.
- **Google** - Gemini Pro, Gemini Flash, etc.
- **Mistral** - Mistral Large, Mistral Medium, etc.
- **Groq** - Fast inference for open models
- **Cohere** - Command models
- **Custom** - Any OpenAI-compatible endpoint

See [Vercel AI SDK Providers](https://sdk.vercel.ai/providers/ai-sdk-providers) for the full list.

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Format code
pnpm format
```

### Project Structure

```
eval-kit/
├── src/
│   ├── metrics/          # Traditional metrics implementations
│   ├── evaluators/       # AI evaluator implementation
│   ├── utils/            # Shared utilities
│   └── types/            # TypeScript type definitions
├── docs/                 # Comprehensive documentation
├── dist/                 # Built output (generated)
└── coverage/             # Test coverage reports (generated)
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test src/evaluators/evaluator.spec.ts
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Links

- [Metrics Documentation](./docs/METRICS.md)
- [Evaluator Documentation](./docs/EVALUATOR.md)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [GitHub Repository](https://github.com/loveholidays/eval-kit)
