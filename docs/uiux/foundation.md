# iPhone UI/UX foundation

Status: visual and interaction principles only. Full UI/UX approval remains Stage 5.

## Design direction

- Native-feeling PWA, portrait-first, dark calm developer workspace.
- Keep primary actions reachable with one thumb.
- Use iOS safe-area insets and dynamic viewport sizing; do not pin navigation to a fixed pixel bottom.
- Prefer compact, readable cards and clear hierarchy over dense desktop dashboards.
- Keep model status, local/cloud route, and repository identity visible.
- Never hide a running task when navigating between views.

## Main navigation proposal

1. **Chat** — conversation, task plan, execution progress.
2. **Project** — repository selector, file tree, search, context.
3. **Changes** — changed files, side-by-side diff, per-file accept/reject.
4. **Runs** — tests, errors, retry history, logs.
5. **Settings** — models, local storage, free-only cloud toggles, privacy controls.

The current Stage 1 prototype uses Overview / Models / Benchmark / Blueprint tabs. This is a research dashboard, not the final product navigation.

## Essential states

- no model selected;
- model downloading/importing;
- model loading;
- ready / local inference;
- cloud helper disabled;
- cloud free quota exhausted;
- offline;
- memory pressure / model unloaded;
- task planning;
- waiting for approval;
- applying patch;
- test failed / retrying;
- diff ready for approval;
- commit complete.

## Interaction rules

- Model downloads are user initiated and show size before starting.
- No silent cloud calls.
- No automatic commit or push.
- Always show what files will change before writing.
- A task must be resumable after the PWA is backgrounded or reloaded.
- Provide stop, retry, undo, and export controls.
