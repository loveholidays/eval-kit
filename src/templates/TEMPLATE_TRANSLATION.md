# Translation Quality Evaluation Template

Production-ready template for evaluating translation quality using AI-powered evaluation.

## Overview

The translation template provides three specialized evaluators:

1. **Translation Quality Evaluator** - Comprehensive multi-dimensional evaluation
2. **Translation Adequacy Evaluator** - Semantic accuracy only
3. **Translation Fluency Evaluator** - Target language quality only

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

console.log(result.score); // 95.5
console.log(result.feedback); // Detailed evaluation
```

## Translation Quality Evaluator

Comprehensive evaluation across five dimensions.

### Evaluation Criteria

| Criterion | Default Weight | Description |
|-----------|---------------|-------------|
| **Accuracy** | 35% | Semantic correctness and completeness |
| **Fluency** | 25% | Natural expression in target language |
| **Grammar** | 15% | Grammatical correctness |
| **Terminology** | 15% | Domain-specific term appropriateness |
| **Style** | 10% | Tone and register preservation |

### Basic Usage

```typescript
const evaluator = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
  sourceLanguage: "English",
});

const result = await evaluator.evaluate({
  candidateText: "Hola mundo",
  sourceText: "Hello world",
});
```

### Custom Weights

Adjust the importance of each criterion:

```typescript
const evaluator = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
  sourceLanguage: "English",
  weights: {
    accuracy: 0.5,      // 50% - Prioritize accuracy
    fluency: 0.2,       // 20%
    grammar: 0.15,      // 15%
    terminology: 0.1,   // 10%
    style: 0.05,        // 5%
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

Provide a reference translation for comparison:

```typescript
const result = await evaluator.evaluate({
  candidateText: "Bonjour le monde",
  referenceText: "Hello world",
  sourceText: "Hello world",
});
```

### With Generation Context

Include the prompt used to generate the translation:

```typescript
const result = await evaluator.evaluate({
  candidateText: "Bonjour le monde",
  sourceText: "Hello world",
  prompt: "Translate to French in a formal style",
});
```

## Translation Adequacy Evaluator

Evaluates **semantic accuracy only**, ignoring fluency, grammar, and style.

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

Evaluates **target language quality only**, without comparing to source.

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
candidateText,sourceText,referenceText
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

Creates a comprehensive translation quality evaluator.

**Parameters:**

- `model` (LanguageModel, required) - The LLM to use for evaluation
- `targetLanguage` (string, required) - Target language name (e.g., "French")
- `sourceLanguage` (string, optional) - Source language name
- `weights` (object, optional) - Custom criterion weights
  - `accuracy` (number, 0-1) - Default: 0.35
  - `fluency` (number, 0-1) - Default: 0.25
  - `grammar` (number, 0-1) - Default: 0.15
  - `terminology` (number, 0-1) - Default: 0.15
  - `style` (number, 0-1) - Default: 0.10
- `scoreConfig` (object, optional) - Score range configuration
  - `min` (number) - Default: 0
  - `max` (number) - Default: 100
- `modelSettings` (object, optional) - Model-specific settings

**Returns:** `Evaluator`

### `createTranslationAdequacyEvaluator(options)`

Creates a semantic accuracy evaluator.

**Parameters:**

- `model` (LanguageModel, required)
- `targetLanguage` (string, required)
- `sourceLanguage` (string, optional)
- `scoreConfig` (object, optional)
- `modelSettings` (object, optional)

**Returns:** `Evaluator`

### `createTranslationFluencyEvaluator(options)`

Creates a target language fluency evaluator.

**Parameters:**

- `model` (LanguageModel, required)
- `targetLanguage` (string, required)
- `scoreConfig` (object, optional)
- `modelSettings` (object, optional)

**Returns:** `Evaluator`

## Best Practices

### 1. Choose the Right Evaluator

```typescript
// General purpose - use comprehensive evaluator
const general = createTranslationEvaluator({...});

// Comparing MT systems - use adequacy evaluator
const adequacy = createTranslationAdequacyEvaluator({...});

// Post-editing - use fluency evaluator
const fluency = createTranslationFluencyEvaluator({...});
```

### 2. Provide Context When Available

```typescript
// With reference translation (recommended)
const result = await evaluator.evaluate({
  candidateText: translation,
  referenceText: goldStandard,
  sourceText: original,
});

// With generation prompt
const result = await evaluator.evaluate({
  candidateText: translation,
  sourceText: original,
  prompt: "Translate to French in a formal style",
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
// Technical documentation - prioritize accuracy
const technical = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
  weights: {
    accuracy: 0.4,
    terminology: 0.3,
    fluency: 0.15,
    grammar: 0.1,
    style: 0.05,
  },
});

// Marketing content - prioritize fluency and style
const marketing = createTranslationEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  targetLanguage: "Spanish",
  weights: {
    fluency: 0.35,
    style: 0.25,
    accuracy: 0.25,
    grammar: 0.1,
    terminology: 0.05,
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
- Custom weights
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

Costs vary based on:
- Source and target text length
- Whether reference translation is provided
- Model choice (Haiku vs Sonnet)
- Amount of feedback generated

## Troubleshooting

**Low scores for good translations:**
- Ensure `sourceLanguage` is specified correctly
- Provide `referenceText` if available
- Check if weights match your quality criteria

**Inconsistent scores:**
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
