# iPhone PWA local inference feasibility

## Current decision

PWA is the primary product path because it avoids the recurring iOS personal-team signing/reinstallation cycle and supports immediate web updates. It is not yet proven to match native performance.

## Runtime candidate: wllama v3

- Project: https://github.com/ngxson/wllama
- It binds llama.cpp to WebAssembly for browser inference.
- V3 documents OpenAI-compatible chat/completion APIs, Jinja chat templates, tool calling, and multimodal inputs.
- The project advertises WebGPU support and a worker-based inference architecture.
- This repository uses the standard wllama package as the first loader experiment.

## Important iOS/PWA constraints

1. **WebGPU:** feature detection is included, but the current prototype loader uses the default wllama WASM path. WebGPU acceleration must be integrated and measured separately.
2. **SharedArrayBuffer:** multi-threaded WASM generally requires cross-origin isolation via COOP/COEP headers.
3. **GitHub Pages:** static hosting does not let this repository set arbitrary response headers. Therefore, do not assume multi-thread WASM works on GitHub Pages.
4. **Single-thread fallback:** validate that the selected model can load and generate with the single-thread-compatible runtime.
5. **Memory:** browser APIs do not expose reliable free physical RAM. DeviceMemory is not a dependable iOS memory report; storage quota is not RAM.
6. **File size:** wllama examples document a 2 GB ArrayBuffer limit and show split-model support. This first app loader rejects one-file GGUFs >=2 GB until a proper split/model-manager flow is implemented.
7. **Backgrounding:** iOS may suspend or terminate browser/PWA work when backgrounded. Save task state and assume inference must run while the PWA is foregrounded.
8. **Persistence:** browser storage can be evicted. Use IndexedDB, request persistent storage where supported, show disk usage, and provide model re-download/import recovery.
9. **Safari vs Home Screen:** test both. A successful Safari tab test does not prove standalone PWA behavior.

## Runtime comparison plan

| Route | Benefit | Risk | Decision |
|---|---|---|---|
| wllama + WASM single-thread | Browser portability, no native signing | Slower; model memory still constrained | First test |
| wllama + WebGPU | Potential GPU acceleration | iOS support/driver/runtime compatibility must be verified | Experiment after baseline |
| wllama + COOP/COEP + multi-thread | More CPU parallelism | GitHub Pages cannot set required headers | Hosting-dependent experiment |
| Native llama.cpp + Metal | Best native GPU path | Requires native app/signing and loses pure-PWA simplicity | Fallback only if PWA fails acceptance tests |

## Hosting options

- GitHub Pages: free static hosting for this public repository; simplest deployment. No custom COOP/COEP headers.
- Cloudflare Pages: possible free static-hosting alternative with a `_headers` file; check current free-plan and no-credit-card conditions before adopting.
- Do not introduce a paid server or backend just to run inference.

## Acceptance criteria for PWA

- Home Screen installation works on target iPhone.
- App shell opens offline after first successful load.
- GGUF can be selected from Files without a server upload.
- A model below the supported size threshold loads without tab/PWA termination.
- Token streaming does not freeze the UI.
- At least 20 minutes of foreground use does not crash.
- Model can be released and another model loaded.
- Benchmark results persist across app restart.
- Offline generation works after model load.
