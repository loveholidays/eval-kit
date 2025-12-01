# Export Guide

Quick reference for exporting batch evaluation results.

## Table of Contents

- [Export Formats](#export-formats)
- [CSV Export](#csv-export)
- [JSON Export](#json-export)
- [Webhook Export](#webhook-export)
- [Streaming vs Batch Export](#streaming-vs-batch-export)
- [Filtering & Customization](#filtering--customization)

---

## Export Formats

The batch evaluation system supports three export formats:

| Format | Use Case | Features |
|--------|----------|----------|
| **CSV** | Spreadsheet analysis, data science | Flattened structure, easy to import |
| **JSON** | API integration, data pipelines | Preserves structure, metadata support |
| **Webhook** | Real-time integration, event-driven systems | HTTP POST/PUT, batching, retry |

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

## Webhook Export

### Basic Webhook Export

```typescript
await batchEvaluator.export({
  format: "webhook",
  destination: "https://api.example.com/evaluations",
  webhookOptions: {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_TOKEN",
      "Content-Type": "application/json",
    },
  },
});
```

**Payload sent to webhook:**
```json
{
  "timestamp": "2025-01-01T12:00:00Z",
  "results": [
    {
      "rowId": "1",
      "results": [...]
    }
  ],
  "count": 1
}
```

### Webhook with Batching

Send results in batches:

```typescript
await batchEvaluator.export({
  format: "webhook",
  destination: "https://api.example.com/evaluations",
  webhookOptions: {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_TOKEN",
    },
    batchSize: 10,  // Send 10 results per request
  },
});
```

This will make multiple requests, each containing 10 results.

### Webhook with Retry

```typescript
await batchEvaluator.export({
  format: "webhook",
  destination: "https://api.example.com/evaluations",
  webhookOptions: {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_TOKEN",
    },
    retryOnFailure: true,  // Retry once if request fails
    timeout: 30000,         // 30 second timeout
  },
});
```

### Webhook Security

⚠️ **Important**: Always validate webhook URLs before use. See [Security Guide](../SECURITY.md) for SSRF prevention.

```typescript
// Good practice: Use environment variable
const WEBHOOK_URL = process.env.RESULTS_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  throw new Error("RESULTS_WEBHOOK_URL not configured");
}

await batchEvaluator.export({
  format: "webhook",
  destination: WEBHOOK_URL,
  webhookOptions: {
    headers: {
      "Authorization": `Bearer ${process.env.WEBHOOK_TOKEN}`,
    },
  },
});
```

---

## Streaming vs Batch Export

### Batch Export (Default)

Export all results after evaluation completes:

```typescript
// 1. Run all evaluations
const result = await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
});

// 2. Export when done
await batchEvaluator.export({
  format: "csv",
  destination: "./results.csv",
});
```

**Use when:**
- Quick batches (< 100 rows)
- Need to process results before export
- Want complete results in memory

### Streaming Export

Export each result immediately after evaluation:

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5,
  // Export results as they complete
  streamExport: {
    format: "csv",
    destination: "./results.csv",
    csvOptions: {
      flattenResults: true,
      includeHeaders: true,
    },
  },
});

// Results are exported during evaluation
await batchEvaluator.evaluate({
  filePath: "./inputs.csv",
});
// File ./results.csv already contains all results!
```

**Use when:**
- Large batches (> 100 rows)
- Need fault tolerance (save progress incrementally)
- Want to monitor results in real-time
- Integrating with streaming systems

### Comparison

| Feature | Batch Export | Streaming Export |
|---------|--------------|------------------|
| When exported | After all complete | As each completes |
| Memory usage | Stores all in memory | Same (results kept) |
| Fault tolerance | Lost on failure | Preserved incrementally |
| Real-time monitoring | No | Yes (watch file) |
| Post-processing | Easy | Harder |

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

### Example 2: Continuous Monitoring

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [sentimentEvaluator],
  concurrency: 10,
  // Stream results to CSV for monitoring
  streamExport: {
    format: "csv",
    destination: "./live-results.csv",
  },
  // Send negative sentiment to webhook for alerts
  onResult: async (result) => {
    const score = result.results[0]?.score;
    if (score === "NEGATIVE") {
      await sendWebhook("https://alerts.example.com/negative", result);
    }
  },
});

await batchEvaluator.evaluate({
  filePath: "./social-media-posts.json",
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

1. **Use streaming export for large batches** (>100 rows) to preserve progress
2. **Filter early** with `filterCondition` to reduce export size
3. **Use webhooks for integration** with external systems
4. **Always secure webhook URLs** - use environment variables, validate URLs
5. **Enable retry for webhooks** in production
6. **Use includeFields** to reduce file size for large exports
7. **Test with small batches** before running large exports
8. **Monitor webhook timeouts** and adjust as needed

## Troubleshooting

**Large CSV files slow to open:**
- Use `includeFields` to export only necessary columns
- Disable `flattenResults` if you don't need flattened structure

**Webhook timing out:**
- Increase `timeout` in webhook options
- Reduce `batchSize` to send smaller payloads
- Check receiving endpoint performance

**JSON too large:**
- Use `filterCondition` to export only relevant results
- Use `includeFields` to reduce payload size
- Consider exporting to multiple files

**Streaming export with missing rows:**
- Check for errors in `onProgress` events
- Verify disk space available
- Ensure proper error handling in evaluation

## See Also

- [Batch Evaluation Guide](./BATCH_EVALUATION_GUIDE.md)
- [Security Guide](../SECURITY.md)
- [Examples](../examples/)
