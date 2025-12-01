# Batch Evaluation Guide

This guide explains how to run evaluations on multiple inputs at once using the batch evaluation system.

## Table of Contents

- [Quick Start](#quick-start)
- [Key Concepts](#key-concepts)
  - [Evaluation Prompt vs Generation Prompt](#evaluation-prompt-vs-generation-prompt)
- [Input Formats](#input-formats)
- [Basic Usage](#basic-usage)
- [Export Options](#export-options)
- [Advanced Features](#advanced-features)
- [Configuration Reference](#configuration-reference)
- [Examples](#examples)

---

## Quick Start

The batch evaluation system allows you to process hundreds or thousands of evaluations efficiently with:
- **Controlled concurrency** - Limit parallel evaluations
- **Rate limiting** - Respect API quotas
- **Progress tracking** - Monitor progress in real-time
- **Multiple export formats** - CSV, JSON, or webhooks
- **Streaming export** - Save results immediately as they complete

### 5-Minute Example

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { BatchEvaluator, Evaluator } from "eval-kit";

// 1. Create your evaluator
const qualityEvaluator = new Evaluator({
  name: "quality-check",
  model: anthropic("claude-3-5-haiku-20241022"),
  evaluationPrompt: "Rate the quality of this text from 1-10.",
  scoreConfig: { type: "numeric", min: 1, max: 10 },
});

// 2. Create batch evaluator
const batchEvaluator = new BatchEvaluator({
  evaluators: [qualityEvaluator],
  concurrency: 5,
});

// 3. Run evaluations from CSV/JSON
const result = await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
  format: "csv",
});

// 4. Export results
await batchEvaluator.export({
  format: "csv",
  destination: "./results.csv",
});

console.log(`Processed ${result.totalRows} rows`);
console.log(`Success rate: ${(result.successfulRows / result.totalRows * 100).toFixed(1)}%`);
```

---

## Key Concepts

### Evaluation Prompt vs Generation Prompt

It's important to understand the difference between two types of prompts:

**Evaluation Prompt** (in Evaluator config)
- Defines **how to evaluate** the content
- Tells the AI what criteria to use
- Same for all rows in the batch
- Example: "Rate the translation quality from 1-10"

**Generation Prompt** (in input data)
- Describes **what prompt generated** the content
- Optional metadata for context
- Can be different for each row
- Example: "Translate 'Hello' to French"

```typescript
// Evaluation prompt - defines the evaluation criteria (same for all)
const evaluator = new Evaluator({
  name: "translation-quality",
  model: anthropic("claude-3-5-haiku-20241022"),
  evaluationPrompt: `Evaluate the translation quality.
Consider accuracy, fluency, and naturalness.
Rate from 1-10.`,
  scoreConfig: { type: "numeric", min: 1, max: 10 },
});

// Input data - contains the content and optional generation prompt
const inputs = [
  {
    candidateText: "Bonjour",
    referenceText: "Hello",
    prompt: "Translate 'Hello' to French",  // Optional: what generated this
  },
  {
    candidateText: "Guten Tag",
    referenceText: "Good day",
    prompt: "Translate 'Good day' to German",  // Optional: what generated this
  },
];
```

**In most cases**, you only need the `candidateText` in your input data. The `prompt` field is optional metadata that can provide context about how the content was generated.

---

## Input Formats

### Understanding Input Fields

Your input data contains the **content to be evaluated**, not the evaluation criteria:

- **`candidateText`** (required) - The text output you want to evaluate
- **`referenceText`** (optional) - Ground truth or expected output for comparison
- **`prompt`** (optional) - The original prompt that was used to generate the candidateText (for context/metadata only)
- **`id`** (optional) - Unique identifier for tracking

**Important:** The `prompt` field in your input data is **not** the evaluation prompt. It's metadata about what prompt was used to generate the content. The evaluation criteria come from the `evaluationPrompt` in your Evaluator config.

### CSV Files

**Minimal example (just the content to evaluate):**
```csv
candidateText
"The cat sits on the mat"
"Bonjour le monde"
"The weather is nice today"
```

**With reference text for comparison:**
```csv
candidateText,referenceText
"The cat sits on the mat","The cat is sitting on the mat"
"Bonjour le monde","Hello world"
```

**With full metadata (including generation prompt):**
```csv
id,candidateText,referenceText,prompt
1,"Bonjour le monde","Hello world","Translate 'Hello world' to French"
2,"Guten Tag","Good day","Translate 'Good day' to German"
```

### JSON Files

**Minimal example:**
```json
[
  {
    "candidateText": "The cat sits on the mat"
  },
  {
    "candidateText": "Bonjour le monde"
  }
]
```

**With reference text:**
```json
[
  {
    "candidateText": "The cat sits on the mat",
    "referenceText": "The cat is sitting on the mat"
  },
  {
    "candidateText": "Bonjour le monde",
    "referenceText": "Hello world"
  }
]
```

**With full metadata:**
```json
[
  {
    "id": "1",
    "candidateText": "Bonjour le monde",
    "referenceText": "Hello world",
    "prompt": "Translate 'Hello world' to French"
  },
  {
    "id": "2",
    "candidateText": "Guten Tag",
    "referenceText": "Good day",
    "prompt": "Translate 'Good day' to German"
  }
]
```

### Nested JSON

If your data is nested, use `arrayPath`:

```json
{
  "metadata": { "version": "1.0" },
  "data": {
    "evaluations": [
      { "candidateText": "Hello", "prompt": "Translate" }
    ]
  }
}
```

```typescript
await batchEvaluator.evaluate({
  filePath: "./data.json",
  format: "json",
  jsonOptions: {
    arrayPath: "data.evaluations"
  }
});
```

### Custom Field Mapping

Map your column names to standard fields:

```typescript
await batchEvaluator.evaluate({
  filePath: "./custom.csv",
  format: "csv",
  fieldMapping: {
    candidateText: "output_text",  // Map "output_text" column to candidateText
    referenceText: "expected",      // Map "expected" column to referenceText
    prompt: "instruction",          // Map "instruction" column to prompt
  }
});
```

---

## Basic Usage

### 1. Create Your Evaluator

Define **how** to evaluate the content. This evaluation prompt is the same for all rows:

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { Evaluator } from "eval-kit";

const evaluator = new Evaluator({
  name: "translation-quality",
  model: anthropic("claude-3-5-haiku-20241022"),
  // This evaluation prompt defines the criteria (same for all rows)
  evaluationPrompt: `Evaluate the translation quality.

Candidate: {{candidateText}}
{{#if referenceText}}Reference: {{referenceText}}{{/if}}
{{#if prompt}}Context: {{prompt}}{{/if}}

Consider accuracy, fluency, and naturalness. Rate from 1-10.`,
  scoreConfig: {
    type: "numeric",
    min: 1,
    max: 10,
    float: true,
  },
});
```

**Note:** You can use `{{prompt}}` in your evaluation prompt to include the generation prompt as context, but it's optional.

### 2. Create Batch Evaluator

```typescript
import { BatchEvaluator } from "eval-kit";

const batchEvaluator = new BatchEvaluator({
  evaluators: [evaluator],
  concurrency: 5,  // Run 5 evaluations at a time
});
```

### 3. Run Batch Evaluation

```typescript
const result = await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
  format: "csv",
});

console.log(`Total: ${result.totalRows}`);
console.log(`Successful: ${result.successfulRows}`);
console.log(`Failed: ${result.failedRows}`);
console.log(`Average Score: ${result.summary.averageScores[evaluator.name]}`);
```

### 4. Access Results

```typescript
// Individual results
for (const row of result.results) {
  console.log(`Row ${row.rowId}:`);
  console.log(`  Score: ${row.results[0].score}`);
  console.log(`  Feedback: ${row.results[0].feedback}`);
}

// Summary statistics
console.log(`Average processing time: ${result.summary.averageProcessingTime}ms`);
console.log(`Total tokens used: ${result.summary.totalTokensUsed}`);
console.log(`Error rate: ${(result.summary.errorRate * 100).toFixed(1)}%`);
```

---

## Export Options

### Export to CSV

```typescript
await batchEvaluator.export({
  format: "csv",
  destination: "./results.csv",
  csvOptions: {
    flattenResults: true,     // Flatten evaluator results into columns
    includeHeaders: true,      // Include header row
    delimiter: ",",            // CSV delimiter
  },
});
```

**Output CSV columns:**
```csv
rowId,rowIndex,candidateText,evaluatorName,score,feedback,success,executionTime
1,0,"Hello world","translation-quality",8.5,"Good translation",true,1234
```

### Export to JSON

```typescript
await batchEvaluator.export({
  format: "json",
  destination: "./results.json",
  jsonOptions: {
    pretty: true,              // Pretty-print JSON
    includeMetadata: true,     // Include summary metadata
  },
});
```

**Output JSON structure:**
```json
{
  "metadata": {
    "exportedAt": "2025-01-01T12:00:00Z",
    "totalResults": 100,
    "successfulResults": 95,
    "failedResults": 5
  },
  "results": [
    {
      "rowId": "1",
      "rowIndex": 0,
      "input": { "candidateText": "..." },
      "results": [
        {
          "evaluatorName": "translation-quality",
          "score": 8.5,
          "feedback": "Good translation",
          "success": true
        }
      ]
    }
  ]
}
```

### Export to Webhook

```typescript
await batchEvaluator.export({
  format: "webhook",
  destination: "https://api.example.com/results",
  webhookOptions: {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_TOKEN",
      "Content-Type": "application/json",
    },
    batchSize: 10,            // Send 10 results per request
    retryOnFailure: true,     // Retry failed requests
    timeout: 30000,           // 30 second timeout
  },
});
```

### Filter Results

Export only specific results:

```typescript
await batchEvaluator.export({
  format: "csv",
  destination: "./failed-results.csv",
  // Only export failed evaluations
  filterCondition: (result) => result.error !== undefined,
});
```

Export only specific fields:

```typescript
await batchEvaluator.export({
  format: "json",
  destination: "./scores-only.json",
  // Only include these fields
  includeFields: ["rowId", "rowIndex", "results"],
});
```

---

## Advanced Features

### Progress Tracking

Monitor progress in real-time:

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  onProgress: (event) => {
    console.log(`Progress: ${event.processedRows}/${event.totalRows}`);
    console.log(`  Success: ${event.successfulRows}, Failed: ${event.failedRows}`);
    console.log(`  ${event.percentComplete.toFixed(1)}% complete`);

    if (event.estimatedTimeRemaining) {
      const minutes = Math.ceil(event.estimatedTimeRemaining / 60000);
      console.log(`  ETA: ~${minutes} minutes`);
    }

    if (event.estimatedCostUSD) {
      console.log(`  Est. cost: $${event.estimatedCostUSD.toFixed(4)}`);
    }
  },
  progressInterval: 2000,  // Emit progress every 2 seconds
});
```

### Streaming Export

Export results immediately as they complete (don't wait for all evaluations to finish):

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  // Stream results to CSV as each evaluation completes
  streamExport: {
    format: "csv",
    destination: "./streaming-results.csv",
    csvOptions: {
      flattenResults: true,
      includeHeaders: true,
    },
  },
});

await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
});

// Results are already exported!
console.log("Results streamed to ./streaming-results.csv");
```

**Benefits of streaming export:**
- Results saved incrementally (fault-tolerant)
- Monitor progress by watching the output file
- Lower memory usage for large batches
- Real-time integration with other systems

### Rate Limiting

Respect API quotas:

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  rateLimit: {
    maxRequestsPerMinute: 50,   // Max 50 requests per minute
    maxRequestsPerHour: 1000,   // Max 1000 requests per hour
  },
});
```

The system will automatically pause when limits are reached.

### Retry Configuration

Handle transient errors automatically:

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  retryConfig: {
    maxRetries: 3,              // Retry up to 3 times
    retryDelay: 1000,           // Wait 1 second between retries
    exponentialBackoff: true,   // Use exponential backoff (1s, 2s, 4s)
    retryOnErrors: [            // Only retry these specific errors
      "rate limit",
      "timeout",
      "ECONNRESET",
    ],
  },
});
```

### Resume from Interruption

Save state to resume interrupted batches:

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  // Save state every 30 seconds
  saveStateInterval: 30000,
  onStateSave: async (state) => {
    // Save to file, database, or cloud storage
    await saveToFile("./batch-state.json", state);
  },
});

try {
  const result = await batchEvaluator.evaluate({
    filePath: "./inputs.csv",
  });
} catch (error) {
  console.error("Batch interrupted:", error);
  console.log("State saved to ./batch-state.json");
}

// Later, resume from saved state
const savedState = await loadFromFile("./batch-state.json");
const resumedEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  resumeFromState: savedState,
});

const result = await resumedEvaluator.evaluate({
  filePath: "./inputs.csv",
});
```

### Multiple Evaluators

Run multiple evaluators on each input:

```typescript
const qualityEvaluator = new Evaluator({ name: "quality", /* ... */ });
const tonalityEvaluator = new Evaluator({ name: "tonality", /* ... */ });
const accuracyEvaluator = new Evaluator({ name: "accuracy", /* ... */ });

const batchEvaluator = new BatchEvaluator({
  evaluators: [qualityEvaluator, tonalityEvaluator, accuracyEvaluator],
  concurrency: 3,
  evaluatorExecutionMode: "parallel",  // Run evaluators in parallel (default)
  // or "sequential" to run one after another
});

const result = await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
});

// Results include all evaluators
console.log(result.summary.averageScores);
// { quality: 8.2, tonality: 7.5, accuracy: 9.1 }
```

### Custom Result Processing

Process each result with custom logic:

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  onResult: async (result) => {
    // Custom processing for each result
    const score = result.results[0]?.score;

    // Log to database
    await db.insert({ rowId: result.rowId, score });

    // Send alert for low scores
    if (typeof score === "number" && score < 5) {
      await sendAlert(`Low score detected: ${result.rowId}`);
    }

    // Update dashboard
    await updateDashboard(result);
  },
});
```

### Timeout Configuration

Set evaluation timeout:

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  timeout: 60000,  // Fail if evaluation takes longer than 60 seconds
  stopOnError: false,  // Continue even if some evaluations fail
});
```

---

## Configuration Reference

### BatchEvaluatorConfig

```typescript
interface BatchEvaluatorConfig {
  // Required
  evaluators: Evaluator[];

  // Concurrency control (optional)
  concurrency?: number;  // Default: 5
  evaluatorExecutionMode?: "parallel" | "sequential";  // Default: "parallel"
  rateLimit?: {
    maxRequestsPerMinute?: number;
    maxRequestsPerHour?: number;
  };

  // Error handling (optional)
  retryConfig?: {
    maxRetries?: number;        // Default: 3
    retryDelay?: number;         // Default: 1000ms
    exponentialBackoff?: boolean; // Default: true
    retryOnErrors?: string[];    // Specific error messages to retry
  };
  stopOnError?: boolean;  // Default: false
  timeout?: number;       // Per-evaluation timeout in ms

  // Progress tracking (optional)
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
  progressInterval?: number;  // Default: 1000ms

  // Result streaming (optional)
  onResult?: (result: BatchEvaluationResult) => void | Promise<void>;
  streamExport?: BatchExportConfig;

  // State management (optional)
  resumeFromState?: BatchState;
  saveStateInterval?: number;  // Auto-save interval in ms
  onStateSave?: (state: BatchState) => void | Promise<void>;
}
```

### BatchInputConfig

```typescript
interface BatchInputConfig {
  filePath: string;
  format?: "csv" | "json" | "auto";  // Default: "auto" (detect from extension)

  // CSV options
  csvOptions?: {
    delimiter?: string;      // Default: ","
    quote?: string;          // Default: '"'
    escape?: string;         // Default: '"'
    headers?: boolean;       // Default: true
    skipEmptyLines?: boolean; // Default: true
    encoding?: BufferEncoding; // Default: "utf-8"
  };

  // JSON options
  jsonOptions?: {
    arrayPath?: string;      // JSONPath to array (e.g., "data.items")
    encoding?: BufferEncoding; // Default: "utf-8"
  };

  // Field mapping
  fieldMapping?: {
    candidateText: string;  // Required
    prompt?: string;
    referenceText?: string;
    sourceText?: string;
    contentType?: string;
    language?: string;
    id?: string;
  };
}
```

### BatchExportConfig

```typescript
interface BatchExportConfig {
  format: "csv" | "json" | "webhook";
  destination: string;  // File path or webhook URL

  // CSV options
  csvOptions?: {
    delimiter?: string;
    includeHeaders?: boolean;
    flattenResults?: boolean;
  };

  // JSON options
  jsonOptions?: {
    pretty?: boolean;
    includeMetadata?: boolean;
  };

  // Webhook options
  webhookOptions?: {
    method?: "POST" | "PUT";
    headers?: Record<string, string>;
    batchSize?: number;
    retryOnFailure?: boolean;
    timeout?: number;
  };

  // Filtering
  includeFields?: string[];
  excludeFields?: string[];
  filterCondition?: (result: BatchEvaluationResult) => boolean;
}
```

---

## Examples

### Example 1: Evaluating LLM Outputs (Common Case)

Most commonly, you'll be evaluating multiple outputs that were all generated with the same prompt. In this case, the generation prompt is not needed in your input data:

**Input file: `llm-outputs.csv`**
```csv
id,candidateText
1,"The quick brown fox jumps over the lazy dog."
2,"To be or not to be, that is the question."
3,"In a galaxy far, far away..."
```

**Evaluation code:**
```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { BatchEvaluator, Evaluator } from "eval-kit";

// Define how to evaluate (same criteria for all)
const grammarEvaluator = new Evaluator({
  name: "grammar-check",
  model: anthropic("claude-3-5-haiku-20241022"),
  evaluationPrompt: `Evaluate the grammar and writing quality.

Text: {{candidateText}}

Rate from 1-10 considering:
- Grammar correctness
- Sentence structure
- Clarity

Provide a score and brief feedback.`,
  scoreConfig: { type: "numeric", min: 1, max: 10 },
});

// Run batch evaluation
const batchEvaluator = new BatchEvaluator({
  evaluators: [grammarEvaluator],
  concurrency: 5,
});

const result = await batchEvaluator.evaluate({
  filePath: "./llm-outputs.csv",
  format: "csv",
});

await batchEvaluator.export({
  format: "csv",
  destination: "./grammar-scores.csv",
});

console.log(`Evaluated ${result.totalRows} outputs`);
```

**Result: `grammar-scores.csv`**
```csv
rowId,candidateText,evaluatorName,score,feedback
1,"The quick brown fox...","grammar-check",9,"Excellent grammar and clarity"
2,"To be or not to be...","grammar-check",10,"Perfect sentence structure"
3,"In a galaxy far...","grammar-check",8,"Good structure, slightly informal"
```

### Example 2: Translation Quality Check

```typescript
import { anthropic } from "@ai-sdk/anthropic";
import { BatchEvaluator, Evaluator } from "eval-kit";

const evaluator = new Evaluator({
  name: "translation-quality",
  model: anthropic("claude-3-5-haiku-20241022"),
  evaluationPrompt: "Rate translation quality 1-10.",
  scoreConfig: { type: "numeric", min: 1, max: 10 },
});

const batchEvaluator = new BatchEvaluator({
  evaluators: [evaluator],
  concurrency: 10,
  onProgress: (e) => console.log(`${e.percentComplete.toFixed(1)}%`),
});

const result = await batchEvaluator.evaluate({
  filePath: "./translations.csv",
});

await batchEvaluator.export({
  format: "csv",
  destination: "./results.csv",
});
```

### Example 2: Content Moderation with Streaming

```typescript
const moderationEvaluator = new Evaluator({
  name: "content-moderation",
  model: anthropic("claude-3-5-haiku-20241022"),
  evaluationPrompt: "Is this content safe? Respond: SAFE or UNSAFE",
  scoreConfig: { type: "categorical", categories: ["SAFE", "UNSAFE"] },
});

const batchEvaluator = new BatchEvaluator({
  evaluators: [moderationEvaluator],
  concurrency: 20,
  // Stream results immediately
  streamExport: {
    format: "csv",
    destination: "./moderation-results.csv",
  },
  // Alert on unsafe content
  onResult: async (result) => {
    if (result.results[0]?.score === "UNSAFE") {
      await sendAlert(`Unsafe content: ${result.rowId}`);
    }
  },
});

await batchEvaluator.evaluate({
  filePath: "./user-content.json",
});
```

### Example 3: Multi-Evaluator Pipeline

```typescript
const relevanceEvaluator = new Evaluator({
  name: "relevance",
  model: anthropic("claude-3-5-haiku-20241022"),
  evaluationPrompt: "Rate relevance 1-5",
  scoreConfig: { type: "numeric", min: 1, max: 5 },
});

const qualityEvaluator = new Evaluator({
  name: "quality",
  model: anthropic("claude-3-5-haiku-20241022"),
  evaluationPrompt: "Rate quality 1-5",
  scoreConfig: { type: "numeric", min: 1, max: 5 },
});

const batchEvaluator = new BatchEvaluator({
  evaluators: [relevanceEvaluator, qualityEvaluator],
  concurrency: 5,
  evaluatorExecutionMode: "parallel",
});

const result = await batchEvaluator.evaluate({
  filePath: "./search-results.json",
  jsonOptions: {
    arrayPath: "results.items",
  },
});

// Export with calculated combined score
await batchEvaluator.export({
  format: "json",
  destination: "./analysis.json",
  jsonOptions: { pretty: true },
});

console.log("Average Relevance:", result.summary.averageScores.relevance);
console.log("Average Quality:", result.summary.averageScores.quality);
```

### Example 4: High-Volume with Rate Limiting

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 50,  // High concurrency
  rateLimit: {
    maxRequestsPerMinute: 500,
    maxRequestsPerHour: 10000,
  },
  retryConfig: {
    maxRetries: 5,
    exponentialBackoff: true,
  },
  onProgress: (e) => {
    console.log(`Processed: ${e.processedRows}/${e.totalRows}`);
    console.log(`ETA: ${Math.ceil(e.estimatedTimeRemaining! / 60000)} min`);
  },
});

const result = await batchEvaluator.evaluate({
  filePath: "./large-dataset.csv",
});

console.log(`Processed ${result.totalRows} items in ${result.durationMs / 1000}s`);
```

---

## Best Practices

1. **Start with low concurrency** (5-10) and increase based on API limits
2. **Use streaming export** for large batches to preserve partial progress
3. **Enable progress tracking** to monitor long-running batches
4. **Set appropriate rate limits** based on your API quotas
5. **Use retry configuration** to handle transient errors
6. **Save state periodically** for very long batches
7. **Monitor costs** using the estimated cost in progress events
8. **Test with small batches** before running large-scale evaluations

## Troubleshooting

### High memory usage
- Use streaming export to avoid storing all results in memory
- Reduce concurrency
- Process in smaller batches

### Rate limit errors
- Reduce concurrency
- Add rate limiting configuration
- Increase retry delay

### Timeout errors
- Increase timeout configuration
- Reduce concurrency
- Check API latency

### Inconsistent results on resume
- Ensure same evaluators and configuration
- Verify input file hasn't changed
- Check state file integrity

## See Also

- [Security Considerations](../SECURITY.md)
- [API Reference](./API_REFERENCE.md)
- [Examples Directory](../examples/)
