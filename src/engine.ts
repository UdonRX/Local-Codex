import { Wllama } from '@wllama/wllama';
import wasmUrl from '@wllama/wllama/src/wasm/wllama.wasm?url';

export interface GenerationMetrics {
  text: string; elapsedMs: number; tokensPerSecond: number | null; estimatedOutputTokens: number;
}

export class LocalModelEngine {
  private runtime: Wllama | null = null;
  private loadedFileName: string | null = null;

  async load(file: File): Promise<void> {
    if (file.size >= 2 * 1024 ** 3) {
      throw new Error('初期ローダーでは2GB以上の単一GGUFファイルを扱いません。分割モデル対応は別途検証します。');
    }
    await this.unload();
    const runtime = new Wllama({ default: wasmUrl });
    await runtime.loadModel([file], { n_ctx: 2048, n_batch: 128 });
    this.runtime = runtime;
    this.loadedFileName = file.name;
  }

  get modelName(): string | null { return this.loadedFileName; }

  async generate(prompt: string, onText?: (text: string) => void): Promise<GenerationMetrics> {
    if (!this.runtime) throw new Error('先にGGUFモデルを読み込んでください。');
    const startedAt = performance.now();
    let text = '';
    let chunkCount = 0;
    const stream = await this.runtime.createChatCompletion({
      messages: [
        { role: 'system', content: 'You are a careful coding assistant. Follow the requested output format. Do not invent files or APIs.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 512, temperature: 0.1, stream: true
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) { text += delta; chunkCount += 1; onText?.(text); }
    }
    const elapsedMs = performance.now() - startedAt;
    return {
      text, elapsedMs,
      tokensPerSecond: elapsedMs > 0 ? chunkCount / (elapsedMs / 1000) : null,
      estimatedOutputTokens: chunkCount
    };
  }

  async unload(): Promise<void> {
    if (this.runtime) {
      await this.runtime.exit();
      this.runtime = null;
      this.loadedFileName = null;
    }
  }
}
