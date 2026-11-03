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
- Approximate tokens/second. The current prototype counts streamed chunks, not tokenizer tokens; label this **chunk/s estimate**, not exact tok/s, until tokenizer-aware measurement is added.
- Whether the app is terminated/reloaded.
- Thermal slowdown across repeated runs.
- Manual quality score 1–5 using the task rubric.
- Correctness checks for code tasks, ideally run against tests on a PC or deterministic evaluator.

## Run protocol

1. Restart the PWA and ensure no model is loaded.
2. Record device state and select one candidate model.
3. Load the GGUF and record load duration.
4. Run each task once as warm-up; do not score the warm-up.
5. Run the full task set three times per model.
6. Score output blind where practical, using the same rubric.
7. Unload the model and allow the device to cool before the next candidate.
8. Repeat in both Safari and Home Screen PWA mode.
9. Export or copy results before clearing browser storage.

## Quality scoring

| Score | Meaning |
|---|---|
| 1 | Fails the core requirement or produces unusable code |
| 2 | Major omissions or unsafe implementation |
| 3 | Partially correct; requires substantial human repair |
| 4 | Mostly correct; minor edits needed |
| 5 | Correct, complete, follows constraints, and handles edge cases |

## Important measurement caveats

The prototype currently estimates output rate by streamed chunk count. A chunk is not guaranteed to equal one token. Do not compare its number directly with published tokens/second benchmarks. Add tokenizer-aware counting or llama.cpp performance counters before making final speed claims.

The browser does not expose reliable physical RAM usage on iOS. Record load failures, app reloads, memory warnings where visible, and storage quota separately.
