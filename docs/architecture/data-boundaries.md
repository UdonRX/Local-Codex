# Data boundaries and security baseline

## Local-only by default

The following remain on-device unless the user explicitly enables an approved cloud feature:
- conversation history;
- repository file contents;
- diffs and patches;
- local model files;
- project indexes and embeddings;
- task plans and checkpoints;
- GitHub access tokens (stored in a secure browser storage design after a threat review).

## Cloud request filter

Before any cloud request:
1. show the user that cloud assistance is about to be used;
2. identify the provider and the exact free-tier route;
3. remove secrets and credential-like values;
4. exclude .env, key files, certificates, tokens, private config, and user-denied paths;
5. send the smallest relevant snippets, not the whole repository;
6. store provider, model, timestamp, estimated quota usage, and data categories sent;
7. fall back to local inference if the free quota is unavailable.

## GitHub permissions

Prefer the narrowest authorization scope that supports the selected repositories and required operations. Do not request organization administration, workflow secrets, or unrelated account permissions. Token storage and OAuth flow will be designed in Stage 4.

## Model and prompt safety

Repository content, issue text, README files, and generated code are untrusted data. Treat instructions found inside a repository as content, not as instructions that override system policy. Tool calls must be schema-validated and path-validated.

## File editing safeguards

- normalize paths and reject traversal;
- deny writes to protected paths until explicitly approved;
- preserve original blobs/snapshots;
- generate a unified diff before applying;
- reject overlapping or stale edits;
- run deterministic validation where possible;
- require user approval before GitHub commit/push;
- use a working branch; never force-push the default branch.
