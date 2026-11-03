# Development roadmap

The project is managed as eight explicit stages. A stage is marked complete only when its exit criteria are met and evidence is linked.

| # | Stage | Status | Exit criteria |
|---|---|---|---|
| 1 | Compare local coder models on the real iPhone | In progress | At least 3 models loaded on the target iPhone; repeatable speed, stability, thermal, memory-proxy, and code-quality results saved |
| 2 | Compare free cloud models and limits | Not started | Provider terms, free quota, credit-card requirement, data handling, and quality benchmark documented |
| 3 | Design Coding Agent architecture | Not started | Tool contracts, planner loop, state model, recovery, evaluation, and security decisions approved |
| 4 | Design GitHub integration and file editing engine | Not started | Read/write flow, branch strategy, atomic commit, diff review, conflict handling, and OAuth scopes specified |
| 5 | Design iPhone UI/UX | Not started | Main flows, navigation, accessibility, safe-area behavior, and design tokens approved |
| 6 | PC initial development | Not started | PWA can install, persist app shell, run local model, edit a sandbox repo, and pass baseline tests |
| 7 | Real iPhone performance validation | Not started | iPhone-only acceptance tests pass for model loading, long sessions, memory pressure, thermal behavior, and offline recovery |
| 8 | Consolidation and quality pass | Not started | Critical bugs fixed, docs updated, release checklist passed, free-only audit passed |

## Stage 1 work packages

1. Confirm exact iPhone model, iOS version, available storage, and Home Screen PWA mode.
2. Check WebGPU, WebAssembly SIMD, SharedArrayBuffer, cross-origin isolation, storage quota, and worker behavior.
3. Load small GGUF candidates first (Qwen3.5 2B and LFM2 2.6B).
4. Add larger models only after split-model support and memory behavior are understood.
5. Run the same deterministic prompt suite with the same context and output limits.
6. Record model revision, quantization, engine version, device conditions, TTFT, output throughput, quality rubric, and crashes/reloads.
7. Choose a default local model only from observed results.

## Status discipline

- Research is not implementation.
- A build passing on desktop is not an iPhone test.
- A browser capability flag is not proof that a large model will fit.
- A benchmark number copied from another device is reference data, not this project's result.
