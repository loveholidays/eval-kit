# Export Guide

Quick reference for exporting batch evaluation results.

## Table of Contents

- [Export Formats](#export-formats)
- [CSV Export](#csv-export)
- [JSON Export](#json-export)
- [Real-time Result Handling](#real-time-result-handling)
- [Filtering & Customization](#filtering--customization)

---

## Export Formats

The batch evaluation system supports two export formats:

| Format | Use Case | Features |
|--------|----------|----------|
| **CSV** | Spreadsheet analysis, data science | Flattened structure, easy to import |
| **JSON** | API integration, data pipelines | Preserves structure, metadata support |

---

## CSV Export

### Basic CSV Export

```typescript
await batchEvaluator.export({
  format: "csv",
  destination: "./results.csv",
});
```

**Output:**
```csv
rowId,rowIndex,candidateText,evaluatorName,score,success,feedback
1,0,"Hello world","quality",8.5,true,"Good quality text"
2,1,"Test","quality",6.0,true,"Acceptable quality"
```

### CSV with Custom Options

```typescript
await batchEvaluator.export({
  format: "csv",
  destination: "./results.csv",
  csvOptions: {
    flattenResults: true,      // Flatten evaluator results into columns
    includeHeaders: true,       // Include header row
    delimiter: ",",             // Use comma delimiter (or ";" for semicolon)
  },
});
```

### CSV with Multiple Evaluators

When using multiple evaluators with `flattenResults: true`:

```typescript
const result = await batchEvaluator.export({
  format: "csv",
  destination: "./multi-eval-results.csv",
  csvOptions: {
    flattenResults: true,
  },
});
```

**Output:**
```csv
rowId,eval1_evaluatorName,eval1_score,eval1_feedback,eval2_evaluatorName,eval2_score,eval2_feedback
1,"quality",8.5,"Good","tone",7.0,"Neutral tone"
```

### CSV Without Flattening

Keep results as JSON string in a single column:

```typescript
await batchEvaluator.export({
  format: "csv",
  destination: "./results.csv",
  csvOptions: {
    flattenResults: false,  // Keep results as JSON string
  },
});
```

**Output:**
```csv
rowId,rowIndex,candidateText,results
1,0,"Hello",[{"evaluatorName":"quality","score":8.5}]
```

---

## JSON Export

### Basic JSON Export

```typescript
await batchEvaluator.export({
  format: "json",
  destination: "./results.json",
});
```

**Output:**
```json
[
  {
    "rowId": "1",
    "rowIndex": 0,
    "input": {
      "candidateText": "Hello world"
    },
    "results": [
      {
        "evaluatorName": "quality",
        "score": 8.5,
        "feedback": "Good quality text",
        "success": true
      }
    ],
    "timestamp": "2025-01-01T12:00:00Z",
    "durationMs": 1234
  }
]
```

### JSON with Pretty Printing

```typescript
await batchEvaluator.export({
  format: "json",
  destination: "./results.json",
  jsonOptions: {
    pretty: true,  // Format with indentation
  },
});
```

### JSON with Metadata

```typescript
await batchEvaluator.export({
  format: "json",
  destination: "./results.json",
  jsonOptions: {
    pretty: true,
    includeMetadata: true,  // Add summary metadata
  },
});
```

**Output:**
```json
{
  "metadata": {
    "exportedAt": "2025-01-01T12:00:00Z",
    "totalResults": 100,
    "successfulResults": 95,
    "failedResults": 5
  },
  "results": [
    { "rowId": "1", "..." },
    { "rowId": "2", "..." }
  ]
}
```

---

## Real-time Result Handling

Use the `onResult` callback to handle results as they complete. This is more flexible than file-based export and works well for integrations.

### Basic onResult Usage

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  onResult: (result) => {
    console.log(`Row ${result.rowId}: score ${result.results[0]?.score}`);
  },
});

await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
});
```

### Writing Results Incrementally

For fault tolerance, write each result to a file as it completes:

```typescript
import { appendFileSync } from "fs";

const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  onResult: (result) => {
    // Write each result as a JSON line
    appendFileSync("./results.jsonl", JSON.stringify(result) + "\n");
  },
});

await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
});
```

### Sending Results to a Webhook

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  onResult: async (result) => {
    await fetch("https://api.example.com/results", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.API_TOKEN}`,
      },
      body: JSON.stringify(result),
    });
  },
});

await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
});
```

### When to Use onResult vs export()

| Approach | Use Case |
|----------|----------|
| `onResult` callback | Real-time processing, webhooks, database writes, alerting |
| `export()` method | End-of-batch file export, CSV for spreadsheets, JSON for archives |

You can use both together: `onResult` for real-time needs, then `export()` for a clean final file.

---

## Filtering & Customization

### Filter by Condition

Export only results matching a condition:

```typescript
// Export only failed evaluations
await batchEvaluator.export({
  format: "csv",
  destination: "./failed-only.csv",
  filterCondition: (result) => result.error !== undefined,
});

// Export only high scores
await batchEvaluator.export({
  format: "json",
  destination: "./high-scores.json",
  filterCondition: (result) => {
    const score = result.results[0]?.score;
    return typeof score === "number" && score >= 8;
  },
});

// Export only specific evaluations
await batchEvaluator.export({
  format: "csv",
  destination: "./quality-only.csv",
  filterCondition: (result) => {
    return result.results.some(r => r.evaluatorName === "quality");
  },
});
```

### Include Specific Fields

Export only certain fields:

```typescript
await batchEvaluator.export({
  format: "json",
  destination: "./scores-only.json",
  includeFields: ["rowId", "rowIndex", "results"],
  jsonOptions: {
    pretty: true,
  },
});
```

**Output:**
```json
[
  {
    "rowId": "1",
    "rowIndex": 0,
    "results": [...]
  }
]
```

### Exclude Specific Fields

Export everything except certain fields:

```typescript
await batchEvaluator.export({
  format: "json",
  destination: "./no-input-data.json",
  excludeFields: ["input"],  // Don't include input data
});
```

### Combine Filtering

```typescript
await batchEvaluator.export({
  format: "csv",
  destination: "./failed-summaries.csv",
  // Only failed evaluations
  filterCondition: (result) => result.error !== undefined,
  // Only these fields
  includeFields: ["rowId", "error", "retryCount", "durationMs"],
});
```

---

## Multiple Exports

You can export the same results to multiple destinations:

```typescript
const result = await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
});

// Export to CSV for analysis
await batchEvaluator.export({
  format: "csv",
  destination: "./analysis.csv",
  csvOptions: { flattenResults: true },
});

// Export to JSON for archiving
await batchEvaluator.export({
  format: "json",
  destination: "./archive.json",
  jsonOptions: { pretty: true, includeMetadata: true },
});

// Send failures to webhook
await batchEvaluator.export({
  format: "webhook",
  destination: "https://alerts.example.com/failures",
  filterCondition: (result) => result.error !== undefined,
});
```

---

## Real-World Examples

### Example 1: Analysis Pipeline

```typescript
const result = await batchEvaluator.evaluate({
  filePath: "./customer-feedback.csv",
});

// Export for data science team (CSV with all details)
await batchEvaluator.export({
  format: "csv",
  destination: "./analysis-full.csv",
  csvOptions: { flattenResults: true },
});

// Export summary for management (JSON with high-level stats)
await batchEvaluator.export({
  format: "json",
  destination: "./summary.json",
  jsonOptions: { includeMetadata: true },
  includeFields: ["rowId", "results"],
});
```

### Example 2: Sentiment Monitoring with Alerts

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [sentimentEvaluator],
  concurrency: 10,
  // Send negative sentiment alerts in real-time
  onResult: async (result) => {
    const score = result.results[0]?.score;
    if (score === "NEGATIVE") {
      await fetch("https://alerts.example.com/negative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
    }
  },
});

const result = await batchEvaluator.evaluate({
  filePath: "./social-media-posts.json",
});

// Export full results after completion
await batchEvaluator.export({
  format: "csv",
  destination: "./sentiment-results.csv",
});
```

### Example 3: A/B Test Results

```typescript
const result = await batchEvaluator.evaluate({
  filePath: "./ab-test-data.csv",
});

// Export variant A results
await batchEvaluator.export({
  format: "csv",
  destination: "./variant-a-results.csv",
  filterCondition: (result) => result.input.variant === "A",
});

// Export variant B results
await batchEvaluator.export({
  format: "csv",
  destination: "./variant-b-results.csv",
  filterCondition: (result) => result.input.variant === "B",
});
```

---

## Best Practices

1. **Use onResult for large batches** to write results incrementally and preserve progress
2. **Filter early** with `filterCondition` to reduce export size
3. **Use includeFields** to reduce file size for large exports
4. **Test with small batches** before running large exports

## Troubleshooting

**Large CSV files slow to open:**
- Use `includeFields` to export only necessary columns
- Disable `flattenResults` if you don't need flattened structure

**JSON too large:**
- Use `filterCondition` to export only relevant results
- Use `includeFields` to reduce payload size
- Consider exporting to multiple files

**Missing rows in incremental output:**
- Check for errors in `onProgress` events
- Verify disk space available
- Make sure `onResult` isn't throwing errors
