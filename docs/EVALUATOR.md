# Evaluator

## Overview

The Evaluator enables LLM-powered content evaluation with flexible prompt templating, automatic response parsing, and comprehensive processing statistics tracking.

## Architecture

### Core Components

1. **Evaluator** - Main evaluator class that orchestrates evaluation
2. **TemplateRenderer** - Handlebars-style template engine for prompts
3. **Vercel AI SDK** - Handles LLM API calls with structured output via generateObject
4. **Zod Schemas** - Dynamic schema generation based on score configuration

### Data Flow

```
User Input → Template Rendering → Vercel AI SDK generateObject → Structured Result with Stats
```

## Template Engine

### Supported Features

**Variable Substitution:**
```
{{variableName}}
```

**Conditional Blocks:**
```
{{#if variableName}}
  Content shown if variableName is truthy
{{/if}}
```

### Available Template Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `{{candidateText}}` | Content being evaluated | Yes |
| `{{prompt}}` | Original generation prompt | No |
| `{{referenceText}}` | Reference text for comparison | No |
| `{{sourceText}}` | Source/context data | No |
| `{{name}}` | Evaluator name | No |
| `{{contentType}}` | Content type metadata | No |
| `{{language}}` | Language metadata | No |

### Template Validation

The engine validates templates at construction time and checks for:
- Mismatched conditional blocks (unclosed `{{#if}}` or unopened `{{/if}}`)
- Nested conditionals (not supported)
- Unknown template constructs

### Variable Extraction

The engine can extract:
- **All variables** - Every variable used in the template
- **Required variables** - Only variables outside conditional blocks

This enables automatic detection of required inputs based on the template.

## Structured Output with Vercel AI SDK

The evaluator uses Vercel AI SDK's `generateObject` function to ensure structured, validated responses from the LLM.

### How It Works

1. **Zod Schema Generation**: The evaluator dynamically creates a Zod schema based on the score configuration
2. **Type-Safe Output**: The AI SDK validates the response against the schema
3. **Guaranteed Structure**: Responses always have the exact shape you expect

### Response Format

All responses have this structure:
```typescript
{
  score: number | string,  // Based on scoreConfig
  feedback: string         // Detailed evaluation feedback
}
```

### Schema Examples

**Default (numeric 0-100, integer):**
```typescript
z.object({
  score: z.number().int().min(0).max(100),
  feedback: z.string()
})
```

**Custom numeric range:**
```typescript
z.object({
  score: z.number().min(1).max(5),  // Can be float or int based on config
  feedback: z.string()
})
```

**Categorical:**
```typescript
z.object({
  score: z.enum(["poor", "fair", "good", "excellent"]),
  feedback: z.string()
})
```

## Score Configuration

### Default Score Configuration

If no `scoreConfig` is provided, the evaluator uses:
```typescript
{
  type: "numeric",
  min: 0,
  max: 100,
  float: false  // Integer only (default)
}
```

### Numeric Scores

```typescript
{
  type: "numeric",
  min: 0,
  max: 100,
  float: false  // Integer only (default)
}
```

The evaluator automatically generates instructions like:
"Provide a score from 0 to 100 (integer) where 0 is worst and 100 is best."

To allow decimal values:
```typescript
{
  type: "numeric",
  min: 0,
  max: 100,
  float: true  // Allow decimals like 85.5
}
```

### Categorical Scores

```typescript
{
  type: "categorical",
  categories: ["poor", "fair", "good", "excellent"]
}
```

The evaluator automatically generates instructions like:
"Provide a score using one of these categories (from worst to best): poor, fair, good, excellent"

## Processing Statistics

### Token Usage

Tracks LLM API token consumption (as reported by Vercel AI SDK):
```typescript
{
  inputTokens: 45,       // Input tokens (optional)
  outputTokens: 30,      // Output tokens (optional)
  totalTokens: 75        // Total tokens as reported by provider (optional)
}
```

Note: Token usage availability depends on the model provider. Some providers may not report token usage.

### Execution Time

Measured in milliseconds from evaluation start to completion.

## Language Model Configuration

The evaluator accepts any `LanguageModel` from the Vercel AI SDK, which provides a unified interface for various LLM providers.

### Supported Providers

Any provider compatible with Vercel AI SDK, including:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google (Gemini)
- Mistral
- And many more...

### Model Settings

Optional settings passed to `generateObject`:

```typescript
{
  temperature?: number;          // Sampling temperature
  maxOutputTokens?: number;      // Maximum tokens to generate
  topP?: number;                 // Nucleus sampling
  topK?: number;                 // Top-K sampling
  presencePenalty?: number;      // Presence penalty
  frequencyPenalty?: number;     // Frequency penalty
  seed?: number;                 // Random seed for deterministic results
}
```

### Automatic Score Instructions

The evaluator automatically appends scoring instructions to your prompt based on the scoreConfig:

**For default numeric (0-100, integer):**
```
Provide a score from 0 to 100 (integer) where 0 is worst and 100 is best.
```

**For custom numeric:**
```
Provide a score from 1 to 5 (integer) where 1 is worst and 5 is best.
```

**For categorical:**
```
Provide a score using one of these categories (from worst to best): poor, fair, good, excellent
```

## Error Handling

### Graceful Failures

When LLM API calls fail:
- `success: false` in result
- `error` field contains error message
- `feedback` contains user-friendly error description
- `score` defaults to 0
- `executionTime` is still tracked

### Template Validation

Invalid templates throw errors at construction time (fail fast):
- Mismatched conditionals
- Nested conditionals
- Unknown template tags

## Usage Patterns

### Basic Usage

```typescript
import { openai } from '@ai-sdk/openai';
import { Evaluator } from 'eval-kit';

// Uses default evaluation prompt
const model = openai('gpt-4');
const evaluator = Evaluator.create("fluency", model);

const result = await evaluator.evaluate({
  candidateText: "The quick brown fox jumps over the lazy dog."
});

console.log(result);
// {
//   evaluatorName: "fluency",
//   score: 90,
//   feedback: "Excellent fluency and natural flow",
//   processingStats: {
//     executionTime: 1243,
//     tokenUsage: { inputTokens: 45, outputTokens: 30, totalTokens: 75 }
//   },
//   success: true
// }
```

### With Reference Text

```typescript
import { anthropic } from '@ai-sdk/anthropic';

const model = anthropic('claude-3-5-sonnet-20241022');
const evaluator = new Evaluator({
  name: "accuracy",
  model,
  evaluationPrompt: `Compare the candidate against the reference:

Candidate: {{candidateText}}
Reference: {{referenceText}}

Rate the accuracy (0-100).`
});

const result = await evaluator.evaluate({
  candidateText: "Hello world",
  referenceText: "Hello world!"
});
```

### Optional Context

```typescript
evaluationPrompt: `Evaluate {{name}}:

Text: {{candidateText}}
{{#if sourceText}}Original: {{sourceText}}{{/if}}
{{#if referenceText}}Reference: {{referenceText}}{{/if}}

Provide score and feedback.`
```

### Categorical Scoring

```typescript
import { openai } from '@ai-sdk/openai';

const model = openai('gpt-4');
const evaluator = Evaluator.create("quality", model, {
  scoreConfig: {
    type: "categorical",
    categories: ["poor", "fair", "good", "excellent"]
  }
});
```

### Custom Score Range

```typescript
const evaluator = Evaluator.create("rating", model, {
  scoreConfig: {
    type: "numeric",
    min: 1,
    max: 5,
    float: false  // Integer only
  }
});
```

### With Model Settings

```typescript
const evaluator = Evaluator.create("fluency", model, {
  modelSettings: {
    temperature: 0.3,        // Lower temperature for more consistent scoring
    maxOutputTokens: 500,    // Limit response length
    seed: 42                 // For reproducible results
  }
});
```

## Implementation Details

### Template Rendering Process

1. Process conditionals first (replace or remove blocks)
2. Process variable substitutions
3. Trim whitespace from result

### Conditional Evaluation

Values are truthy if:
- Not `undefined`, `null`, `""`, or `false`
- Objects have at least one key
- Arrays have at least one element

### Variable Stringification

- Strings → as-is
- Numbers/booleans → String conversion
- Objects/arrays → JSON.stringify
- Other → String conversion

### Zod Schema Generation

The evaluator dynamically creates Zod schemas based on scoreConfig:

**Default (no scoreConfig):**
- `z.number().int().min(0).max(100)` for the score

**Numeric with custom range:**
- `z.number().min(min).max(max)` (with `.int()` if float is false)

**Categorical:**
- `z.enum([...categories])` with exact categories from config

## Testing Strategy

### Unit Tests

- **Template Engine (33 tests)**: Variable substitution, conditionals, validation, extraction
- **Evaluator (14 tests)**: Evaluation flow, error handling, template variables, score configs, model settings

### Test Coverage

- All template features (variables, conditionals, validation)
- All score configurations (numeric, categorical, default)
- Error conditions (API failures, undefined usage)
- Processing stats tracking (execution time, token usage)
- Model settings passthrough to generateObject

## Performance Considerations

### Execution Time Tracking

Uses `Date.now()` at start and end for millisecond precision.

### Template Rendering

Templates are rendered on every evaluation. For high-frequency evaluations, consider:
- Caching rendered templates if variables don't change
- Using simpler templates without conditionals

### Vercel AI SDK generateObject

The Vercel AI SDK handles response parsing efficiently with structured output. The Zod schema validation ensures type-safe responses without manual parsing overhead.
