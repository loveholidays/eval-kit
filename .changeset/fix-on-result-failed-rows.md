---
"@loveholidays/eval-kit": patch
---

Fix onResult callback not being called for failed rows in BatchEvaluator. Previously, errors were silently dropped and consumers relying on onResult for logging or persistence never received failure notifications.
