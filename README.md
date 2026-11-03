# Local Codex

iPhone-first coding agent research and development project.

**Primary direction:** installable iPhone PWA, local-first inference, optional free-only cloud assistance, and direct GitHub workflows. The product must never require a paid AI API, paid server, subscription, or credit card.

## Current focus

Stage 1 — compare local coding models and validate an iPhone Safari/PWA inference path.

This repository starts with:
- a mobile-first PWA research dashboard;
- an initial GGUF model candidate registry;
- a local inference adapter based on wllama v3;
- device capability diagnostics;
- repeatable coding benchmark prompts and a result log;
- architecture, security, UX, and roadmap documents.

## Run locally

Requirements: Node.js 20.19+ or 22.12+, npm.

```bash
npm install
npm run dev
```

Open the Vite URL in Safari on the iPhone for device testing. For Home Screen installation, use an HTTPS deployment.

## First model test

1. Open the **Models** tab.
2. Download a supported GGUF file from the model link in the candidate registry.
3. Save it in the iPhone Files app.
4. Choose the GGUF file in the PWA.
5. Load it, then run the same benchmark prompts for each model.
6. Record device, model revision, quantization, context size, generation speed, memory symptoms, thermal state, and quality score.

The initial in-browser loader is intended for GGUF files below 2 GB. Larger models are listed for research but require split-file/model-manager support before this PWA can load them safely.

## Deployment

The repository includes a GitHub Pages workflow. Enable **Settings → Pages → Build and deployment → GitHub Actions** once. The workflow publishes the static PWA without a paid server.

GitHub Pages cannot set custom COOP/COEP response headers. The first deployment therefore targets the single-thread-compatible browser path. Multi-threaded WASM and advanced WebGPU configurations remain compatibility experiments, not assumed capabilities.

## Project rules

- [Free-only policy](docs/policy/free-only.md)
- [Development roadmap](docs/roadmap.md)
- [Current status](docs/status.md)
- [Model candidate research](docs/research/model-candidates.md)
- [PWA runtime research](docs/research/pwa-runtime.md)

## Important status note

A repository scaffold and benchmark harness are not proof that the iPhone model runtime works. Stage 1 remains **in progress** until a real iPhone run produces saved benchmark results.
