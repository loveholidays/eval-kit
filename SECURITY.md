# Security Considerations

## Webhook Export Security

### SSRF (Server-Side Request Forgery) Risk

When using webhook export functionality, the batch evaluator will make HTTP requests to the configured destination URL. This creates a potential SSRF vulnerability if the webhook URL is not properly validated.

**Risk Level**: Medium

**Attack Scenario**:
If an attacker can control the webhook destination URL (e.g., through user input or configuration), they could potentially:
- Access internal services (e.g., `http://localhost:8080/admin`)
- Scan internal networks
- Access cloud metadata endpoints (e.g., `http://169.254.169.254/latest/meta-data/`)

### Mitigation Strategies

#### 1. Validate Webhook URLs

Always validate webhook URLs before passing them to the batch evaluator:

```typescript
function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow https
    if (parsed.protocol !== 'https:') {
      return false;
    }

    // Block private IP ranges
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.match(/^172\.(1[6-9]|2[0-9]|3[01])\./)
    ) {
      return false;
    }

    // Block cloud metadata endpoints
    if (hostname === '169.254.169.254') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Usage
if (!isValidWebhookUrl(userProvidedUrl)) {
  throw new Error('Invalid webhook URL');
}
```

#### 2. Use an Allowlist

Restrict webhooks to a predefined list of trusted domains:

```typescript
const ALLOWED_WEBHOOK_DOMAINS = [
  'api.example.com',
  'webhooks.mycompany.com',
];

function isAllowedWebhookDomain(url: string): boolean {
  const parsed = new URL(url);
  return ALLOWED_WEBHOOK_DOMAINS.includes(parsed.hostname);
}
```

#### 3. Use Environment Variables

Store webhook URLs in environment variables, not user input:

```typescript
const WEBHOOK_URL = process.env.EVALUATION_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  throw new Error('EVALUATION_WEBHOOK_URL not configured');
}

const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  streamExport: {
    format: "webhook",
    destination: WEBHOOK_URL, // From env, not user input
  },
});
```

#### 4. Network-Level Controls

- Use network policies to restrict outbound connections from your application
- Deploy behind a proxy that filters requests to internal networks
- Use AWS VPC endpoints or similar cloud features to restrict metadata access

### Best Practices

1. **Never accept webhook URLs directly from untrusted user input**
2. **Always use HTTPS for webhooks** (reject HTTP)
3. **Implement URL validation** before creating batch evaluators
4. **Use allowlists** instead of blocklists when possible
5. **Log webhook requests** for security monitoring
6. **Set appropriate timeouts** to prevent long-running requests

## File Path Security

### Path Traversal Risk

The batch evaluator accepts file paths for input (CSV/JSON) and export. Improper validation could lead to path traversal attacks.

**Risk Level**: Medium

### Mitigation

```typescript
import { resolve, normalize } from 'path';

function validateFilePath(filePath: string, baseDir: string): string {
  const normalizedPath = normalize(filePath);
  const resolvedPath = resolve(baseDir, normalizedPath);

  // Ensure the resolved path is within baseDir
  if (!resolvedPath.startsWith(baseDir)) {
    throw new Error('Invalid file path: outside base directory');
  }

  return resolvedPath;
}

// Usage
const SAFE_BASE_DIR = '/app/data';
const safeInputPath = validateFilePath(userInputPath, SAFE_BASE_DIR);
```

## API Key Security

Never hardcode API keys in your configuration:

```typescript
// ❌ Bad
const evaluator = new Evaluator({
  model: anthropic("claude-3-5-sonnet-20241022", {
    apiKey: "sk-ant-..." // Hardcoded!
  }),
});

// ✓ Good
const evaluator = new Evaluator({
  model: anthropic("claude-3-5-sonnet-20241022", {
    apiKey: process.env.ANTHROPIC_API_KEY // From environment
  }),
});
```

## Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
const batchEvaluator = new BatchEvaluator({
  evaluators: [myEvaluator],
  concurrency: 5, // Limit concurrent requests
  rateLimit: {
    maxRequestsPerMinute: 50,
    maxRequestsPerHour: 1000,
  },
});
```

## Reporting Security Issues

If you discover a security vulnerability in eval-kit, please report it to:

**Email**: security@anthropic.com

Please do not report security vulnerabilities through public GitHub issues.

## Security Checklist

Before deploying batch evaluation in production:

- [ ] Validate all webhook URLs
- [ ] Use environment variables for sensitive configuration
- [ ] Implement file path validation
- [ ] Set appropriate rate limits
- [ ] Use HTTPS for all webhooks
- [ ] Implement proper error handling (don't leak sensitive info)
- [ ] Enable logging for security monitoring
- [ ] Review and test retry logic
- [ ] Implement network-level controls
- [ ] Use principle of least privilege for API keys

## Additional Resources

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
