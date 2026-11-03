# Local model benchmark protocol

## Purpose

Compare model quality and real-world usability on the same target iPhone. This is not a generic LLM leaderboard.

## Fixed test conditions

For every run, record:
- exact iPhone model and iOS version;
- Safari tab or Home Screen PWA;
- battery percentage and Low Power Mode state;
- device temperature/thermal state (qualitative: cool / warm / hot);
- free storage before and after model download;
- browser/app build commit;
- wllama version and runtime backend;
- model repository, exact file, quantization, file size, revision/hash;
- context length, batch size, output token cap, temperature;
- network state (download phase vs inference phase).

Keep prompts, context length, temperature, and output cap the same for model comparisons.

## Metrics

- Model load time.
- Time to first visible token (TTFT).
- End-to-end generation time.
- Time to first visible output (TTFT).
- Streamed chunk count and **chunk/s estimate**. A streamed chunk is not a tokenizer token; do not label this tok/s.
- Model load duration for the current model session.
- Whether the app is terminated/reloaded.
- Thermal slowdown across repeated runs.
- Manual quality score 1–5 using the task rubric.
- Correctness checks for code tasks, ideally run against tests on a PC or deterministic evaluator.

## Run protocol

1. Restart the PWA and ensure no model is loaded.
2. Select one candidate and load its GGUF file(s); the app records the load duration.
3. For each of the four fixed tasks, run one warm-up using the dedicated warm-up button. Do not save it.
4. Run that exact task three times with the same prompt. Score each measured output from 1–5 and save it.
5. Repeat all four tasks for each model, without changing context (512), max output (512), temperature (0.1), or CPU thread count (1).
6. Unload the model and allow the device to cool before the next candidate.
7. Repeat the benchmark separately in Safari and Home Screen PWA mode; do not mix those environments in one comparison.
8. Use the model comparison table for averages and export CSV/JSON for the raw records.

## Quality scoring

| Score | Meaning |
|---|---|
| 1 | Fails the core requirement or produces unusable code |
| 2 | Major omissions or unsafe implementation |
| 3 | Partially correct; requires substantial human repair |
| 4 | Mostly correct; minor edits needed |
| 5 | Correct, complete, follows constraints, and handles edge cases |

## Important measurement caveats

The app records TTFT, generation duration, streamed chunk count, and chunk/s estimate. A chunk is not guaranteed to equal one token, so chunk/s is only a same-engine relative indicator and must never be presented as exact tokens/second. Tokenizer-aware counting is a future improvement.

For files above 2GB, wllama requires genuine GGUF shards, not arbitrary byte slices. Use llama-gguf-split --split-max-size 512M input.gguf output-prefix, then select all -00001-of-0000N.gguf parts together in the app. Every individual shard must be smaller than 2GB.

The browser does not expose reliable physical RAM usage on iOS. Record load failures, app reloads, memory warnings where visible, and storage quota separately.
