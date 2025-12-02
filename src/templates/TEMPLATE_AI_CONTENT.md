# AI-Generated Content Quality Evaluation Template

Production-ready template for evaluating AI-generated content quality across multiple dimensions.

## Overview

The AI content template provides five specialized evaluators:

1. **AI Content Quality Evaluator** - Comprehensive multi-dimensional evaluation
2. **Relevance Evaluator** - Query/prompt alignment only
3. **Factuality Evaluator** - Factual accuracy and hallucination detection
4. **Safety Evaluator** - Harmful content, bias, and inappropriateness detection
5. **Tone Evaluator** - Tone and style appropriateness

## Quick Start

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { createAIContentEvaluator } from "eval-kit";

const evaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
});

const result = await evaluator.evaluate({
  candidateText: "Your AI-generated blog post content...",
  prompt: "Write a blog post about TypeScript benefits",
});

console.log(result.score); // 87.5
console.log(result.feedback); // Detailed evaluation
```

## AI Content Quality Evaluator

Comprehensive evaluation across five key dimensions.

### Evaluation Criteria

| Criterion | Default Weight | Description |
|-----------|---------------|-------------|
| **Relevance** | 30% | Addresses prompt/query appropriately |
| **Accuracy** | 25% | Factually correct, no hallucinations |
| **Coherence** | 20% | Logical flow and organization |
| **Completeness** | 15% | Adequate topic coverage |
| **Quality** | 10% | Writing clarity and style |

### Basic Usage

```typescript
const evaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
});

const result = await evaluator.evaluate({
  candidateText: "AI-generated blog post content here...",
  prompt: "Write about TypeScript",
});
```

### Content Types

Specify the type of content for context-appropriate evaluation:

```typescript
// Blog post
const blogEvaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
});

// Email
const emailEvaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "email",
});

// Social media post
const socialEvaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "social-media",
});

// Documentation
const docsEvaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "documentation",
});

// Code comments
const commentEvaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "code-comment",
});
```

### Custom Weights

Adjust criterion importance based on your use case:

```typescript
// Prioritize accuracy for technical content
const evaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "technical-article",
  weights: {
    accuracy: 0.4,      // 40% - Most important
    relevance: 0.25,    // 25%
    coherence: 0.2,     // 20%
    completeness: 0.1,  // 10%
    quality: 0.05,      // 5%
  },
});

// Prioritize quality and coherence for marketing
const marketingEvaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "marketing-copy",
  weights: {
    quality: 0.35,
    coherence: 0.3,
    relevance: 0.2,
    completeness: 0.1,
    accuracy: 0.05,
  },
});
```

### Additional Checks

Enable specific evaluation aspects:

```typescript
const evaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
  aspects: {
    checkFactuality: true,  // Flag factual errors
    checkTone: true,        // Evaluate tone appropriateness
    checkBias: true,        // Check for bias/stereotypes
    checkSafety: true,      // Flag harmful content
  },
});
```

### With Reference Text

Provide expected output for comparison:

```typescript
const result = await evaluator.evaluate({
  candidateText: "AI-generated content...",
  prompt: "Write about X",
  referenceText: "Expected output or guidelines...",
});
```

## Relevance Evaluator

Evaluates **only whether content addresses the prompt**.

### When to Use

- Quick filtering of off-topic responses
- A/B testing different prompts
- Retrieval-Augmented Generation (RAG) validation
- Query-response matching

### Usage

```typescript
const evaluator = createRelevanceEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "article",
});

const result = await evaluator.evaluate({
  candidateText: "Article content...",
  prompt: "Write about TypeScript benefits",
});

// Score based purely on prompt relevance
console.log(result.score);
```

## Factuality Evaluator

Identifies **factual errors, hallucinations, and misleading information**.

### When to Use

- Technical or scientific content
- News or informational content
- Content requiring high accuracy
- Detecting hallucinations

### Usage

```typescript
const evaluator = createFactualityEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "technical-documentation",
});

const result = await evaluator.evaluate({
  candidateText: "Content with facts to verify...",
  referenceText: "Known correct information...", // Optional
});

// Detailed factuality analysis
console.log(result.feedback);
// Lists specific factual errors found
```

### What It Checks

- ✅ Factual errors (incorrect statements)
- ✅ Hallucinations (made-up information)
- ✅ Misleading claims (technically true but misleading)
- ✅ Outdated information
- ✅ Unverified claims

## Safety Evaluator

Identifies **harmful, biased, or inappropriate content**.

### When to Use

- User-facing content moderation
- Compliance and brand safety
- Content policy enforcement
- Community guidelines checking

### Usage

```typescript
const evaluator = createSafetyEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
});

const result = await evaluator.evaluate({
  candidateText: "Content to check for safety...",
  prompt: "Original request", // Optional context
});

// Lower scores indicate safety concerns
console.log(result.score);
console.log(result.feedback); // Details safety issues found
```

### What It Checks

**Harmful Content:**
- Violence or self-harm
- Medical/legal/financial misinformation
- Instructions for illegal activities

**Bias & Discrimination:**
- Stereotypes or prejudice
- Discriminatory language
- Unfair group representation

**Inappropriate Content:**
- Offensive language or slurs
- Adult/sexual content
- Graphic descriptions

**Misinformation:**
- Conspiracy theories
- False health claims
- Manipulative content

## Tone Evaluator

Evaluates **tone and style appropriateness**.

### When to Use

- Brand voice consistency
- Audience-appropriate content
- Formal vs. informal contexts
- Style guide compliance

### Usage

```typescript
// General tone evaluation
const evaluator = createToneEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "customer-email",
});

// With expected tone specified
const formalEvaluator = createToneEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "legal-document",
  expectedTone: "formal, professional, precise",
});

const result = await evaluator.evaluate({
  candidateText: "Content to evaluate...",
  prompt: "Context about the writing task",
});
```

## Batch Evaluation

Process multiple pieces of content efficiently.

### Basic Batch

```typescript
import { BatchEvaluator, createAIContentEvaluator } from "eval-kit";
import { anthropic } from "@ai-sdk/anthropic";

const evaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
});

const batchEvaluator = new BatchEvaluator({
  evaluators: [evaluator],
  concurrency: 5,
  defaultInput: {
    prompt: "Write a blog post about AI",  // Applied to all
  },
});

const result = await batchEvaluator.evaluate({
  filePath: "./generated-posts.csv",
});

await batchEvaluator.export({
  format: "csv",
  destination: "./evaluation-results.csv",
});
```

### Input CSV Format

```csv
candidateText,prompt
"Blog post 1 content...","Write about TypeScript"
"Blog post 2 content...","Write about React"
"Blog post 3 content...","Write about Node.js"
```

### Multiple Evaluators

Comprehensive evaluation with multiple aspects:

```typescript
const qualityEvaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
});

const factualityEvaluator = createFactualityEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
});

const safetyEvaluator = createSafetyEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
});

const batchEvaluator = new BatchEvaluator({
  evaluators: [qualityEvaluator, factualityEvaluator, safetyEvaluator],
  concurrency: 3,
});

// Results include all three evaluations per row
```

### Filtering Results

Export only content that meets criteria:

```typescript
await batchEvaluator.export({
  format: "csv",
  destination: "./high-quality-only.csv",
  filterCondition: (result) => {
    const score = result.results[0]?.score;
    return typeof score === "number" && score >= 80;
  },
});
```

## API Reference

### `createAIContentEvaluator(options)`

Creates a comprehensive AI content quality evaluator.

**Parameters:**

- `model` (LanguageModel, required) - The LLM to use
- `contentType` (string, optional) - Type of content (default: "general content")
- `weights` (object, optional) - Custom criterion weights
  - `relevance` (number, 0-1) - Default: 0.30
  - `accuracy` (number, 0-1) - Default: 0.25
  - `coherence` (number, 0-1) - Default: 0.20
  - `completeness` (number, 0-1) - Default: 0.15
  - `quality` (number, 0-1) - Default: 0.10
- `aspects` (object, optional) - Additional checks
  - `checkFactuality` (boolean) - Check for errors
  - `checkTone` (boolean) - Evaluate tone
  - `checkBias` (boolean) - Check for bias
  - `checkSafety` (boolean) - Check safety
- `scoreConfig` (object, optional) - Score range
- `modelSettings` (object, optional) - Model settings

**Returns:** `Evaluator`

### `createRelevanceEvaluator(options)`

Creates a prompt relevance evaluator.

**Parameters:**
- `model` (LanguageModel, required)
- `contentType` (string, optional)
- `scoreConfig` (object, optional)
- `modelSettings` (object, optional)

**Returns:** `Evaluator`

### `createFactualityEvaluator(options)`

Creates a factual accuracy evaluator.

**Parameters:**
- `model` (LanguageModel, required)
- `contentType` (string, optional)
- `scoreConfig` (object, optional)
- `modelSettings` (object, optional)

**Returns:** `Evaluator`

### `createSafetyEvaluator(options)`

Creates a content safety evaluator.

**Parameters:**
- `model` (LanguageModel, required)
- `scoreConfig` (object, optional)
- `modelSettings` (object, optional)

**Returns:** `Evaluator`

### `createToneEvaluator(options)`

Creates a tone and style evaluator.

**Parameters:**
- `model` (LanguageModel, required)
- `contentType` (string, optional)
- `expectedTone` (string, optional) - Description of expected tone
- `scoreConfig` (object, optional)
- `modelSettings` (object, optional)

**Returns:** `Evaluator`

## Best Practices

### 1. Choose the Right Evaluator

```typescript
// General content - use comprehensive evaluator
const general = createAIContentEvaluator({...});

// Quick filtering - use relevance evaluator
const relevance = createRelevanceEvaluator({...});

// Fact-checking - use factuality evaluator
const factuality = createFactualityEvaluator({...});

// Moderation - use safety evaluator
const safety = createSafetyEvaluator({...});

// Brand consistency - use tone evaluator
const tone = createToneEvaluator({...});
```

### 2. Match Weights to Content Type

```typescript
// Technical content - prioritize accuracy
const technical = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "technical-article",
  weights: {
    accuracy: 0.4,
    relevance: 0.25,
    coherence: 0.2,
    completeness: 0.1,
    quality: 0.05,
  },
});

// Creative content - prioritize quality and coherence
const creative = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "creative-writing",
  weights: {
    quality: 0.35,
    coherence: 0.3,
    relevance: 0.2,
    completeness: 0.1,
    accuracy: 0.05,
  },
});
```

### 3. Enable Relevant Checks

```typescript
// Public-facing content
const publicContent = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
  aspects: {
    checkSafety: true,  // Critical for public content
    checkBias: true,    // Ensure fairness
    checkFactuality: true,  // Verify facts
  },
});

// Internal documentation
const internalDocs = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "documentation",
  aspects: {
    checkFactuality: true,  // Accuracy matters
    checkTone: true,        // Consistent style
  },
});
```

### 4. Use Appropriate Models

```typescript
// Fast screening with Haiku
const screening = createRelevanceEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
});

// Detailed evaluation with Sonnet
const detailed = createAIContentEvaluator({
  model: anthropic("claude-3-5-sonnet-20241022"),
  contentType: "blog-post",
  aspects: {
    checkFactuality: true,
    checkBias: true,
  },
});
```

### 5. Combine Multiple Evaluators

```typescript
// Pipeline approach
const content = "AI-generated content...";

// 1. Quick relevance check
const relevanceResult = await relevanceEvaluator.evaluate({
  candidateText: content,
  prompt: "Write about X",
});

if (relevanceResult.score < 70) {
  console.log("Content not relevant, skipping further evaluation");
  return;
}

// 2. Safety check
const safetyResult = await safetyEvaluator.evaluate({
  candidateText: content,
});

if (safetyResult.score < 80) {
  console.log("Safety concerns detected");
  return;
}

// 3. Comprehensive evaluation
const qualityResult = await qualityEvaluator.evaluate({
  candidateText: content,
  prompt: "Write about X",
});
```

## Use Case Examples

### Blog Post Evaluation

```typescript
const evaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "blog-post",
  weights: {
    relevance: 0.3,
    quality: 0.25,
    coherence: 0.2,
    accuracy: 0.15,
    completeness: 0.1,
  },
  aspects: {
    checkFactuality: true,
    checkTone: true,
  },
});
```

### Customer Email Evaluation

```typescript
const evaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "customer-email",
  weights: {
    relevance: 0.35,
    quality: 0.3,
    coherence: 0.2,
    completeness: 0.15,
  },
  aspects: {
    checkTone: true,
  },
});
```

### Social Media Post Evaluation

```typescript
const evaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-haiku-20241022"),
  contentType: "social-media",
  weights: {
    relevance: 0.35,
    quality: 0.3,
    coherence: 0.15,
    completeness: 0.1,
    accuracy: 0.1,
  },
  aspects: {
    checkSafety: true,
    checkBias: true,
  },
});
```

### Technical Documentation

```typescript
const evaluator = createAIContentEvaluator({
  model: anthropic("claude-3-5-sonnet-20241022"),
  contentType: "technical-documentation",
  weights: {
    accuracy: 0.4,
    completeness: 0.25,
    coherence: 0.2,
    relevance: 0.1,
    quality: 0.05,
  },
  aspects: {
    checkFactuality: true,
  },
});
```

## Cost Estimation

Approximate costs per evaluation (using Claude 3.5 Haiku):

- **Single evaluation**: ~$0.0002-0.0005 per evaluation
- **Batch of 1000**: ~$0.20-0.50
- **Batch of 10,000**: ~$2.00-5.00

Costs vary based on:
- Content length
- Number of aspects checked
- Model choice (Haiku vs Sonnet)
- Whether reference text is provided

## Troubleshooting

**Low scores for good content:**
- Verify `contentType` is appropriate
- Check if weights match your priorities
- Ensure prompt provides enough context

**False positives in safety evaluation:**
- Lower temperature for more conservative evaluation
- Provide context in the `prompt` field
- Consider content type appropriateness

**Inconsistent scoring:**
- Use lower model temperature
- Provide reference examples
- Use the same model consistently

**Slow batch processing:**
- Increase concurrency
- Use faster model (Haiku)
- Filter with relevance evaluator first

## See Also

- [Evaluator Documentation](./EVALUATOR.md)
- [Batch Evaluation Guide](./BATCH_EVALUATION_GUIDE.md)
- [Translation Template](./TEMPLATE_TRANSLATION.md)
