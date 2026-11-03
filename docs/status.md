# Project status

Last updated: 2026-11-03

## Overall

- Current stage: **Stage 1 — local coder model comparison**
- Stage 1 status: **In progress**
- Completed stages: **0 / 8**
- PWA-first direction: **Chosen and successfully used for a real iPhone GGUF load; broader validation remains**
- Free-only rule: **Mandatory**
- Paid AI API / paid server / required subscription: **Prohibited**

## Stage-by-stage

| Stage | Status | Evidence |
|---|---|---|
| 1. Local coder model comparison | In progress | Qwen3.5 2B Q4_K_M loaded successfully on iPhone in 4.3s. LFM2/Qwen3.5 4B/Gemma 4 E2B and comparative generation benchmarks remain. |
| 2. Free cloud model comparison | Not started | No provider comparison yet. |
| 3. Coding Agent architecture | Not started | Initial direction documented; detailed design pending. |
| 4. GitHub and file editing engine | Not started | High-level direction documented; implementation design pending. |
| 5. iPhone UI/UX | Not started | Foundation principles and initial research UI exist; product UX is not approved. |
| 6. PC initial development | In progress | PWA shell, local GGUF load, benchmark UI and Vercel deployment exist. PC workflow, sandbox repository editing and full acceptance tests remain. |
| 7. iPhone validation | In progress | First iPhone model-load test passed; generation, repeatability, long sessions, thermal and memory-pressure tests remain. |
| 8. Final quality pass | Not started | Not started. |

## What exists

- Vite + React + TypeScript PWA scaffold.
- Local GGUF file loading experiment using wllama v3.
- Device capability diagnostic panel.
- Initial model candidate catalog.
- Four repeatable coding benchmark prompts.
- Benchmark UI records model ID, load duration, TTFT, generation duration, streamed chunk count/rate estimate, manual 1–5 quality score, and device mode.
- Per-model average comparison table plus CSV/JSON export.
- Multi-file GGUF split selection and validation for models larger than 2GB per file.
- LocalStorage benchmark result log (export CSV/JSON regularly; IndexedDB migration remains).
- Architecture, PWA constraints, UX, free-only policy, and roadmap docs.
- GitHub Pages deployment workflow and CI build workflow.

## Validation evidence

- GitHub Actions Validate PWA passed on earlier scaffold commits; TypeScript and Vite production builds have passed before the latest benchmark changes.
- Vercel deployment at https://localcodex.vercel.app has been used for the iPhone test.
- User-confirmed iPhone run on 2026-11-03: Qwen3.5-2B-Q4_K_M.gguf loaded successfully; 1,280,835,840 bytes; 4.3 seconds.
- The successful load confirms the Safari-compatible WASM/Worker path can initialize and load this model. It does not yet establish generation quality, sustained stability, or support for the other model architectures.
- The latest benchmark and multi-file loader changes still require a fresh Vercel build and on-device test.

## Known gaps / blockers

1. Only Qwen3.5 2B has a confirmed iPhone load; other candidates and inference quality are not yet tested.
2. iOS Safari WebGPU support is detected but not yet used by the current loader.
3. Single GGUF files >=2GB must be split with llama-gguf-split. The app now accepts and validates all correctly named shards; splitting still happens on a PC.
4. Browser-reported storage quota is not free RAM and cannot guarantee model load success.
5. LocalStorage result persistence is temporary; IndexedDB migration is required.
6. The app is not yet a Coding Agent and does not yet connect to GitHub.
7. GitHub Pages cannot set COOP/COEP headers; multi-thread WASM is not assumed.
8. The current Vercel URL is deployed; the newest benchmark update needs its own deployment verification.

## Next action

1. Run Qwen3.5 2B through all four benchmark tasks: one warm-up and three measured runs per task.
2. Load LFM2 2.6B and repeat the same suite.
3. On a PC, split Qwen3.5 4B and Gemma 4 E2B GGUF files into <=512MB shards with llama-gguf-split, transfer every shard to iPhone, and load them together.
4. Export the benchmark CSV/JSON after each model and compare the averages. Test both Safari and Home Screen PWA separately after the first comparison round.
