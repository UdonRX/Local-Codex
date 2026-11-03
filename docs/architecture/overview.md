# Architecture direction

Status: initial baseline only. This is not yet the approved detailed design (Stage 3).

## Product principles

- iPhone-first, installable PWA.
- Local model inference is the default.
- Optional cloud assistance is allowed only when the provider is verified free, user-enabled, and safely within its free quota.
- No paid AI API, paid model gateway, paid server, subscription, or automatic paid fallback.
- GitHub is the source-of-truth repository system.
- The agent must show a plan and diff before writing a commit.
- Every long task is checkpointed and resumable.

## Proposed layers

1. **PWA shell:** React, TypeScript, Vite, service worker, safe-area-aware mobile UI.
2. **Local inference:** model catalog, download/import manager, wllama runtime adapter, prompt/context builder.
3. **Agent orchestration:** planner, task graph, tool router, execution loop, verifier, reviewer, recovery.
4. **Repository intelligence:** file tree, ignore rules, code search, symbol index, dependency graph, retrieval.
5. **Workspace:** virtual file system, patch application, snapshots, diff review, undo/redo.
6. **GitHub adapter:** OAuth/authorization, repository read, branch creation, commit tree, compare, push.
7. **Persistence:** IndexedDB for models and project state; explicit export/import; schema migrations.
8. **Free-only cloud adapter:** provider registry, quota guard, request budget, privacy filter, kill switch.

## Agent loop

```text
User request
  -> clarify / normalize requirements
  -> inspect repository metadata and relevant files
  -> create a plan with explicit file-level operations
  -> ask approval for high-impact actions
  -> execute one bounded tool call at a time
  -> validate patch and run available checks
  -> diagnose failures and retry within a fixed budget
  -> independent review against the original request
  -> show final diff and test evidence
  -> user approval
  -> create one atomic Git commit on a working branch
```

The model proposes actions; the deterministic application layer validates and executes them. Never let model text directly become an unchecked filesystem or GitHub operation.

## No backend requirement

The normal operating path must not require a custom server. GitHub API calls go directly from the PWA with user-authorized credentials. Local inference and local project state stay on-device. CI can optionally use GitHub Actions, but core chat/editing must not depend on it.
