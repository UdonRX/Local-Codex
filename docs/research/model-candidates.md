# Local coding model candidates

Research snapshot: 2026-11-03. Candidate selection is provisional. The user's iPhone 18 Pro must be tested directly; public benchmark data from another iPhone is reference-only.

## Shortlist

| Candidate | Quant / approximate file size | Role | Initial decision |
|---|---:|---|---|
| Qwen3.5 2B | Q4_K_M / ~1.3 GB | Main quality-vs-size candidate | First load test |
| LFM2 2.6B | Q4_K_M / ~1.56 GB | Speed and memory baseline | First load test |
| Qwen3.5 4B | Q4_K_M / ~2.78 GB | Higher-quality candidate | Requires GGUF split into <=512MB shards |
| Gemma 4 E2B | Q4_K_M / ~3.11 GB | Mobile-oriented reasoning/coding | Requires GGUF split; architecture compatibility must be proven |
| Gemma 4 E4B | Q4_K_M / ~4.6 GiB | Higher-quality, memory-heavy candidate | Research only initially |
| Qwen3-Coder-Next | Q4_K_M / ~48.4 GB | Agentic coding ceiling reference | Not an iPhone local candidate |

## Candidate details

### Qwen3.5 2B GGUF
- Repository: https://huggingface.co/SoAIHQ/Qwen3.5-2B-GGUF
- Q4_K_M file: `Qwen3.5-2B-Q4_K_M.gguf`
- Approximate size: 1.3 GB.
- License: Apache-2.0 for the upstream model; verify the exact derivative repository's terms.
- Why test: small enough for the first browser file-loader experiment, with reasoning/tool-call capability claimed by the GGUF publisher.
- Risks: Qwen3.5 architecture and chat-template support must match the llama.cpp revision bundled by wllama. Verify generated tool-call syntax; do not assume compatibility merely because the model supports tools.

### LFM2 2.6B GGUF
- Repository: https://huggingface.co/LiquidAI/LFM2-2.6B-GGUF
- Q4_K_M file: `LFM2-2.6B-Q4_K_M.gguf`
- Approximate size: 1.56 GB (below wllama's per-file 2GB limit).
- Role: speed/memory reference, not a coding-specialized winner.
- License: LFM Open License; read its terms before redistribution or commercial use.
- Risks: general conversational performance may not translate into multi-file coding quality.

### Qwen3.5 4B GGUF
- Repository: https://huggingface.co/SoAIHQ/Qwen3.5-4B-GGUF
- Q4_K_M file: `Qwen3.5-4B-Q4_K_M.gguf`
- Approximate size: 2.78 GB.
- Role: higher-quality comparison.
- The app accepts a complete set of GGUF split files. Split the monolithic source on a PC with llama-gguf-split --split-max-size 512M.
- Risks: iPhone memory pressure and actual Qwen3.5 4B runtime compatibility remain untested.

### Gemma 4 E2B / E4B
- Repositories: https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF and https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF
- Q4_K_M approximate sizes: E2B ~2.9 GiB; E4B ~4.6 GiB.
- Google describes Gemma 4 as open-weight models for coding, reasoning, and agentic workflows with native function-calling support.
- License: Gemma Terms of Use, not Apache-2.0. Confirm that the terms fit the intended use.
- Risks: model size, context/KV cache, device thermal throttling, browser process memory, and whether the wllama 3.8.1 bundled llama.cpp build recognizes the gemma4 architecture. A successful GGUF header read is not sufficient; native load must pass.

### Qwen3-Coder-Next
- Repository: https://huggingface.co/Qwen/Qwen3-Coder-Next-GGUF
- Q4_K_M reported at ~48.4 GB.
- This is an agentic coding model but is not feasible for the target iPhone's local storage/memory budget. Keep it as a cloud/desktop quality reference, not a mobile download candidate.

## External reference measurements

A public iPhone Air benchmark report measured, in its own setup:
- Qwen3.5 2B GGUF: around 36.6 tokens/s and quality score 64.4.
- Qwen3.5 4B GGUF: around 14.7 tokens/s and quality score 68.6.
- Gemma 4 E2B GGUF: around 35 tokens/s and quality score 63.6.
- LFM2 2.6B GGUF: around 35.9 tokens/s and quality score 60.2.

Source: https://ananasdda.github.io/pocket-ai-lab/benchmarks/

These are not results from the target iPhone and not a coding-agent benchmark. Do not copy these values into the project's results as if they were measured locally.

## Selection rule

Do not choose the model based on parameter count or tok/s alone. Score each candidate on:
1. coding task correctness;
2. instruction adherence and Japanese communication;
3. tool-call formatting and argument correctness;
4. repository-level planning;
5. generation speed and time-to-first-token;
6. peak memory / process reloads;
7. thermal slowdown after repeated runs;
8. context stability;
9. license and redistribution terms.

The default model is chosen only after the target-device benchmark is complete.
