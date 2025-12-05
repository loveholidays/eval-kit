---
"@loveholidays/eval-kit": patch
---

Fix CI/CD workflow authentication for Google Artifact Registry publishing

- Use Workload Identity Federation instead of static tokens
- Align with webmono CI patterns for consistent authentication
