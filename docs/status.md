# Project status

Last updated: 2026-11-03

## Overall

- Current stage: **Stage 1 — local coder model comparison**
- Stage 1 status: **In progress**
- Completed stages: **0 / 8**
- PWA-first direction: **Chosen as primary implementation path, not yet proven on target iPhone**
- Free-only rule: **Mandatory**
- Paid AI API / paid server / required subscription: **Prohibited**

## Stage-by-stage

| Stage | Status | Evidence |
|---|---|---|
| 1. Local coder model comparison | In progress | Candidate list, PWA diagnostic harness, and benchmark tasks added. No target-iPhone benchmark results yet. |
| 2. Free cloud model comparison | Not started | No provider comparison yet. |
| 3. Coding Agent architecture | Not started | Initial direction documented; detailed design pending. |
| 4. GitHub and file editing engine | Not started | High-level direction documented; implementation design pending. |
| 5. iPhone UI/UX | Not started | Foundation principles and initial research UI exist; product UX is not approved. |
| 6. PC initial development | Not started | PWA scaffold exists and the first GitHub Actions typecheck/build passed. Full development and PC/manual testing are not complete. |
| 7. iPhone validation | Not started | Requires user-run test on target iPhone. |
| 8. Final quality pass | Not started | Not started. |

## What exists

- Vite + React + TypeScript PWA scaffold.
- Local GGUF file loading experiment using wllama v3.
- Device capability diagnostic panel.
- Initial model candidate catalog.
- Four repeatable coding benchmark prompts.
- LocalStorage result log (prototype only).
- Architecture, PWA constraints, UX, free-only policy, and roadmap docs.
- GitHub Pages deployment workflow and CI build workflow.

## Validation evidence

- GitHub Actions Validate PWA passed for commit b432cd3988732f06007a1e68eb1720000ff3817d: npm install and npm run build (TypeScript + Vite production build) succeeded.
- A subsequent commit only adjusted the GitHub Pages enablement workflow; its CI run is queued.
- The first Pages deployment attempt built successfully but failed at the Pages configuration step because Pages was not enabled. The workflow was updated to request automatic enablement; deployment is pending re-run.
- No iPhone execution, model load, or performance measurement has been completed.

## Known gaps / blockers

1. PWA runtime and model loading have not been tested on the user's iPhone.
2. iOS Safari WebGPU support is detected but not yet used by the current loader.
3. The initial file loader rejects single GGUF files at or above 2 GB; split-model support is not implemented.
4. Browser-reported storage quota is not free RAM and cannot guarantee model load success.
5. LocalStorage result persistence is temporary; IndexedDB migration is required.
6. The app is not yet a Coding Agent and does not yet connect to GitHub.
7. GitHub Pages cannot set COOP/COEP headers; multi-thread WASM is not assumed.
8. No deployed URL has been verified yet.

## Next action

Wait for the GitHub Pages workflow to complete, open the HTTPS PWA on the target iPhone, record device diagnostics in both Safari and Home Screen mode, then load the first sub-2-GB GGUF model.
