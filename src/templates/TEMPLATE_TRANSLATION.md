# Translation Quality Evaluation Template

Production-ready template for evaluating translation quality using a combination of lexical metrics and AI-powered evaluation.

## Overview

The translation template provides three specialized evaluators:

1. **Translation Quality Evaluator** - Composite evaluation combining BLEU, TER, and AI metrics
2. **Translation Adequacy Evaluator** - Semantic accuracy only (AI-based)
3. **Translation Fluency Evaluator** - Target language quality only (AI-based)

## Quick Start

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { createTranslationEvaluator } from "eval-kit";

const evaluator = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "French",
  sourceLanguage: "English",
});

const result = await evaluator.evaluate({
  candidateText: "Bonjour le monde",
  referenceText: "Hello world",
  sourceText: "Hello world",
});

console.log(result.score); // 85.5 (composite score)
console.log(result.metrics); // Detailed breakdown
console.log(result.feedback); // Comprehensive evaluation
```

## Translation Quality Evaluator

Composite evaluation combining multiple metrics for robust assessment.

### Metrics Used

| Metric | Default Weight | Description |
|--------|---------------|-------------|
| **BLEU** | 25% | N-gram precision - measures lexical overlap with reference |
| **TER** | 25% | Translation Edit Rate (inverted) - measures edit distance |
| **AI** | 50% | LLM-based semantic evaluation - captures meaning, fluency, style |

### Why Multiple Metrics?

Each metric captures different aspects of translation quality:

- **BLEU**: Fast, deterministic, good for lexical similarity. But misses semantic equivalence (synonyms score poorly).
- **TER**: Captures structural differences, but can penalize valid paraphrasing.
- **AI Evaluation**: Understands meaning, fluency, and style that lexical metrics miss.

Combining them provides more robust and reliable scores than any single metric alone.

### Basic Usage

```typescript
const evaluator = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
  sourceLanguage: "English",
});

const result = await evaluator.evaluate({
  candidateText: "Hola mundo",
  referenceText: "Hello world",
});
```

### Result Structure

```typescript
interface TranslationEvaluatorResult {
  evaluatorName: string;
  score: number;           // Weighted composite score (0-100)
  feedback: string;        // Comprehensive markdown feedback
  success: boolean;
  metrics?: {
    bleu: {
      score: number;       // 0-100
      precisions: number[];// N-gram precisions
      brevityPenalty: number;
    };
    ter: {
      score: number;       // 0-100 (inverted TER)
      rawTer: number;      // Original TER value
      editCount: number;
      feedback: string;
    };
    ai: {
      score: number;       // 0-100
      feedback: string;
    };
  };
}
```

### Custom Metric Weights

Adjust the importance of each metric:

```typescript
const evaluator = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
  sourceLanguage: "English",
  metricWeights: {
    bleu: 0.2,    // 20% - Less weight on lexical overlap
    ter: 0.2,     // 20%
    ai: 0.6,      // 60% - More weight on semantic quality
  },
});
```

### Custom Score Range

Change the scoring scale:

```typescript
const evaluator = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "French",
  scoreConfig: {
    min: 1,
    max: 5,  // 1-5 scale instead of 0-100
  },
});
```

### With Reference Translation

Reference text is required for BLEU and TER metrics:

```typescript
const result = await evaluator.evaluate({
  candidateText: "Bonjour le monde",
  referenceText: "Hello world",  // Required for lexical metrics
  sourceText: "Hello world",
});
```

### With Generation Context

Include the prompt used to generate the translation:

```typescript
const result = await evaluator.evaluate({
  candidateText: "Bonjour le monde",
  referenceText: "Hello world",
  prompt: "Translate to French in a formal style",
});
```

## Translation Adequacy Evaluator

Evaluates **semantic accuracy only**, ignoring fluency, grammar, and style. Uses AI evaluation only (no lexical metrics).

### When to Use

- Comparing machine translation systems
- Focusing on meaning preservation
- Post-editing scenarios
- Quality estimation without target language expertise

### Usage

```typescript
const evaluator = createTranslationAdequacyEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "German",
  sourceLanguage: "English",
});

const result = await evaluator.evaluate({
  candidateText: "Ich habe gesehen ein Hund",  // Awkward but accurate
  sourceText: "I saw a dog",
});

// Score focuses purely on semantic accuracy
console.log(result.score); // High score despite poor fluency
```

## Translation Fluency Evaluator

Evaluates **target language quality only**, without comparing to source. Uses AI evaluation only.

### When to Use

- Evaluating post-edited translations
- Assessing target language naturalness
- Monolingual evaluation scenarios
- Quality control by target language experts

### Usage

```typescript
const evaluator = createTranslationFluencyEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Japanese",
});

const result = await evaluator.evaluate({
  candidateText: "今日はいい天気ですね。",
});

// Score based on Japanese fluency only
console.log(result.score); // No comparison to source needed
```

## Batch Evaluation

Process multiple translations efficiently.

### Basic Batch Evaluation

```typescript
import { BatchEvaluator, createTranslationEvaluator } from "eval-kit";
import { anthropic } from "@ai-sdk/anthropic";

const evaluator = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "French",
  sourceLanguage: "English",
});

const batchEvaluator = new BatchEvaluator({
  evaluators: [evaluator],
  concurrency: 5,
  defaultInput: {
    prompt: "Translate to French",  // Applied to all rows
  },
});

const result = await batchEvaluator.evaluate({
  filePath: "./translations.csv",
});

await batchEvaluator.export({
  format: "csv",
  destination: "./results.csv",
});
```

### Input CSV Format

```csv
candidateText,referenceText,sourceText
"Bonjour","Hello","Hello"
"Merci","Thanks","Thank you"
"Au revoir","Bye","Goodbye"
```

### Multiple Evaluators

Evaluate with both adequacy and fluency:

```typescript
const adequacyEvaluator = createTranslationAdequacyEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
  sourceLanguage: "English",
});

const fluencyEvaluator = createTranslationFluencyEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
});

const batchEvaluator = new BatchEvaluator({
  evaluators: [adequacyEvaluator, fluencyEvaluator],
  concurrency: 3,
});

const result = await batchEvaluator.evaluate({
  filePath: "./translations.csv",
});

// Results include both adequacy and fluency scores
```

## API Reference

### `createTranslationEvaluator(options)`

Creates a composite translation quality evaluator combining BLEU, TER, and AI metrics.

**Parameters:**

- `model` (LanguageModel, required) - The LLM to use for AI evaluation
- `targetLanguage` (string, required) - Target language name (e.g., "French")
- `sourceLanguage` (string, optional) - Source language name
- `metricWeights` (object, optional) - Custom metric weights
  - `bleu` (number, 0-1) - Default: 0.25
  - `ter` (number, 0-1) - Default: 0.25
  - `ai` (number, 0-1) - Default: 0.50
- `scoreConfig` (object, optional) - Score range configuration
  - `min` (number) - Default: 0
  - `max` (number) - Default: 100
- `modelSettings` (object, optional) - Model-specific settings

**Returns:** `CompositeTranslationEvaluator`

### `createTranslationAdequacyEvaluator(options)`

Creates a semantic accuracy evaluator (AI-based only).

**Parameters:**

- `model` (LanguageModel, required)
- `targetLanguage` (string, required)
- `sourceLanguage` (string, optional)
- `scoreConfig` (object, optional)
- `modelSettings` (object, optional)

**Returns:** `Evaluator`

### `createTranslationFluencyEvaluator(options)`

Creates a target language fluency evaluator (AI-based only).

**Parameters:**

- `model` (LanguageModel, required)
- `targetLanguage` (string, required)
- `scoreConfig` (object, optional)
- `modelSettings` (object, optional)

**Returns:** `Evaluator`

## Best Practices

### 1. Choose the Right Evaluator

```typescript
// General purpose - use composite evaluator (recommended)
const general = createTranslationEvaluator({...});

// Comparing MT systems - use adequacy evaluator
const adequacy = createTranslationAdequacyEvaluator({...});

// Post-editing - use fluency evaluator
const fluency = createTranslationFluencyEvaluator({...});
```

### 2. Always Provide Reference Text

The composite evaluator requires reference text for BLEU and TER metrics:

```typescript
// Recommended - with reference translation
const result = await evaluator.evaluate({
  candidateText: translation,
  referenceText: goldStandard,  // Required for lexical metrics
  sourceText: original,
});
```

### 3. Use Appropriate Models

```typescript
// Fast model for large batches
import { anthropic } from "@ai-sdk/anthropic";
const evaluator = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),  // Fast & affordable
  targetLanguage: "French",
});

// Better model for critical evaluations
const evaluator = createTranslationEvaluator({
  model: anthropic("claude-3-5-sonnet-20241022"),  // More accurate
  targetLanguage: "French",
});
```

### 4. Adjust Weights for Your Use Case

```typescript
// Prioritize lexical similarity (machine translation comparison)
const mtEval = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
  metricWeights: {
    bleu: 0.35,
    ter: 0.35,
    ai: 0.30,
  },
});

// Prioritize semantic quality (creative content)
const creativeEval = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
  metricWeights: {
    bleu: 0.15,
    ter: 0.15,
    ai: 0.70,
  },
});
```

### 5. Batch Processing for Scale

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [evaluator],
  concurrency: 10,              // Adjust based on rate limits
  rateLimit: {
    maxRequestsPerMinute: 50,
  },
  streamExport: {               // Export results as they complete
    format: "csv",
    destination: "./results.csv",
  },
});
```

## Examples

See [examples/translation-template.ts](../examples/translation-template.ts) for complete working examples including:

- Basic translation evaluation
- Custom metric weights
- Adequacy-only evaluation
- Fluency-only evaluation
- Batch evaluation
- Multiple evaluators

## Supported Languages

The template works with any language supported by your chosen LLM. Common languages include:

- European: English, French, Spanish, German, Italian, Portuguese, Dutch, Polish, Russian
- Asian: Chinese (Simplified/Traditional), Japanese, Korean, Thai, Vietnamese
- Middle Eastern: Arabic, Hebrew, Turkish, Farsi
- And many more...

## Cost Estimation

Approximate costs per evaluation (using Claude 3.5 Haiku):

- **Single translation**: ~$0.0001-0.0003 per evaluation
- **Batch of 1000**: ~$0.10-0.30
- **Batch of 10,000**: ~$1.00-3.00

Note: BLEU and TER metrics are computed locally at no additional cost.

Costs vary based on:
- Source and target text length
- Model choice (Haiku vs Sonnet)
- Amount of feedback generated

## Troubleshooting

**Missing reference text error:**
- The composite evaluator requires `referenceText` for BLEU and TER metrics
- Provide either `referenceText` or `sourceText` as reference

**Low BLEU scores for good translations:**
- BLEU penalizes synonyms and paraphrasing
- Consider increasing AI weight in `metricWeights`
- Check if reference translation is appropriate

**Inconsistent AI scores:**
- Lower model `temperature` for more consistency
- Use the same model for all evaluations
- Provide clear context in `prompt` field

**Slow batch processing:**
- Increase `concurrency` setting
- Use faster model (e.g., Claude Haiku)
- Enable `streamExport` for progress visibility

## See Also

- [Evaluator Documentation](./EVALUATOR.md)
- [Batch Evaluation Guide](./BATCH_EVALUATION_GUIDE.md)
- [Examples](../examples/)
