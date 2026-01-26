---
"@loveholidays/eval-kit": patch
---

Fix lodash prototype pollution vulnerability (CVE-2025-13465) by forcing lodash >=4.17.23 via pnpm overrides. This addresses a security issue where _.unset and _.omit functions could be exploited to delete methods from global prototypes.
