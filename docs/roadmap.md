# Development roadmap

The project is managed as eight explicit stages. A stage is marked complete only when its exit criteria are met and evidence is linked.

| # | Stage | Status | Exit criteria |
|---|---|---|---|
| 1 | Compare local coder models on the real iPhone | In progress | At least 3 models loaded on the target iPhone; repeatable speed, stability, thermal, memory-proxy, and code-quality results saved |
| 2 | Compare free cloud models and limits | Not started | Provider terms, free quota, credit-card requirement, data handling, and quality benchmark documented |
| 3 | Design Coding Agent architecture | Not started | Tool contracts, planner loop, state model, recovery, evaluation, and security decisions approved |
| 4 | Design GitHub integration and file editing engine | Not started | Read/write flow, branch strategy, atomic commit, diff review, conflict handling, and OAuth scopes specified |
| 5 | Design iPhone UI/UX | Not started | Main flows, navigation, accessibility, safe-area behavior, and design tokens approved |
| 6 | PC initial development | In progress | PWA can install, persist app shell, run local model, edit a sandbox repo, and pass baseline tests |
| 7 | Real iPhone performance validation | In progress | iPhone-only acceptance tests pass for model loading, long sessions, memory pressure, thermal behavior, and offline recovery |
| 8 | Consolidation and quality pass | Not started | Critical bugs fixed, docs updated, release checklist passed, free-only audit passed |

## Verified progress (2026-11-03)

- Qwen3.5 2B Q4_K_M successfully loaded on the user's iPhone. Client diagnostic: load_success, file size 1,280,835,840 bytes, elapsed 4.3 seconds.
- The iOS Safari compatibility WASM/Worker path has been deployed and the first real model load succeeded.
- This is one successful model-load observation, not a completed benchmark. Generation quality, TTFT, repeated-run stability, thermal behavior, and a second/third model are still unmeasured.
- LFM2 2.6B is a single-file candidate below wllama's per-file 2GB limit. Qwen3.5 4B and Gemma 4 E2B exceed it as single files and need genuine GGUF splitting, not byte slicing.

## Stage 1 work packages

1. Confirm exact iPhone model, iOS version, available storage, and Home Screen PWA mode.
2. Check WebGPU, WebAssembly SIMD, SharedArrayBuffer, cross-origin isolation, storage quota, and worker behavior.
3. Confirm Qwen3.5 2B generation and repeatable benchmark baseline.
4. Load LFM2 2.6B as the second single-file model.
5. Split Qwen3.5 4B and Gemma 4 E2B into <=512MB GGUF shards on a PC, then test memory and architecture compatibility on iPhone.
6. Run the same task suite: one warm-up + three measured runs per task/model; record load time, TTFT, generation time, chunk/s estimate, manual quality score, device mode, and crashes/reloads.
7. Export CSV/JSON and select a default only from measured results.

## Status discipline

- Research is not implementation.
- A build passing on desktop is not an iPhone test.
- A browser capability flag is not proof that a large model will fit.
- A benchmark number copied from another device is reference data, not this project's result.
