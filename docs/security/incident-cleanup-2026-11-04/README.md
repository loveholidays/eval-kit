# eval-kit incident history cleanup verification — 4 November 2026

All current branch histories were checked against the confirmed loader content and hooks removed by [cleanup PR #36](https://github.com/loveholidays/eval-kit/pull/36). No known malicious content was found, so no history rewrite or existing branch deletion was necessary.

## Scope and evidence

- Only `loveholidays/eval-kit` was inspected at the Git-object level.
- All six tabs of the two supplied incident spreadsheets were read; repository names were deduplicated for evidence reconciliation. Other repositories were outside the execution scope.
- Sources: [incident audit](https://docs.google.com/spreadsheets/d/1eIfHN5ZuxFz2OabHoYr8bpNYphdG-li6-mGJVTYnY08/edit), [history cleanup inventory](https://docs.google.com/spreadsheets/d/1IT1_jktocVPTq3znHy7-W8gRxl8-dSrB0P53zuGAdLs/edit), and cleanup PR #36.
- GitHub reported `main` as the default branch at `8a97b07254e27fc9ff538724cffaec57c269dee0`.
- The inventory contains 12 branches, including 11 non-default branches. Their union contains 142 commits, 290 trees, and 348 unique blobs; `main` reaches 138 commits.

## Method and result

A fresh isolated bare copy was used, with no checkout. Every unique reachable blob was read directly using `git cat-file --batch`; results were cached by blob ID. Every reachable commit tree was associated with its blobs, and each branch's complete ancestry was checked, including merged history. The matching rules included exact payload bytes, Unicode-decoded loader fingerprints, injected Jest-loader signatures, the `node api.js` build hook, and the three confirmed concealment entries from `.gitignore`. Both original loader payloads passed the scanner's positive controls. No matching blobs or affected branches were found.

The incident spreadsheet's default cleanup SHA and earlier branch cleanup SHAs are absent from the current reachable graph. Those historical records were used as evidence rather than as assumptions about present refs.

A complete Git recovery bundle was stored outside development directories, verified, and checksummed. Immediately before preparing this audit record, remote refs were rechecked and the recovery checksum and bundle verification were repeated. A fresh fetch of all branch refs yielded exactly the recorded heads and exactly the same reachable object set. Git object-integrity verification passed. The default tree remains `9e6fe255cbf7acac63a226416e339dcb4a47ad59`.

No repository code, package installation scripts, builds, tests, or IDE startup tasks were executed. The audit-record commit requests CI skipping. No existing branch, tag, release, artifact, secret, or protection was changed. The evidence includes a historical CI-execution finding; runner and credential investigation was outside this request.

## Records

- `cleanup-results.csv`: requested result fields.
- `branch-inventory.csv`: original heads, ancestry counts, and preservation decisions.
- `commit-map.csv`: identity mappings for all 142 original reachable commits.

All existing commit IDs, authors, messages, and signatures remain unchanged. This PR adds only the audit record; it does not need to be merged to complete the history-cleanup verification. Recovery material and full scan evidence are retained locally in the quarantined incident directory.
