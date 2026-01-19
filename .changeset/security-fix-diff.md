---
"@loveholidays/eval-kit": patch
---

Fix security vulnerability in transitive dependency

Updated `diff` package from 8.0.2 to 8.0.3 to address Dependabot alert #4 (GHSA-73rr-hh4g-fpgx). This fixes a low-severity Denial of Service vulnerability in the parsePatch and applyPatch methods that could cause infinite loops when processing patches with specific line break characters.

This is a dev dependency used by build tooling and does not affect the runtime behavior of the package.
