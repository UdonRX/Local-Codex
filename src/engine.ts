import { Wllama } from '@wllama/wllama';
import wasmUrl from '@wllama/wllama/src/wasm/wllama.wasm?url';

export interface GenerationMetrics {
  text: string; elapsedMs: number; tokensPerSecond: number | null; estimatedOutputTokens: number;
}

type LoadStageCallback = (message: string) => void;

export class LocalModelEngine {
  private runtime: Wllama | null = null;
  private loadedFileName: string | null = null;

  async load(file: File, onStage?: LoadStageCallback): Promise<void> {
    const startedAt = performance.now();
    const log = (stage: string, message: string, details: Record<string, unknown> = {}) => {
      const elapsedSeconds = Number(((performance.now() - startedAt) / 1000).toFixed(1));
      console.info('[Local Codex][Model Load]', message, { stage, elapsedSeconds, ...details });
      onStage?.(message);
    };

    log('validate', 'ファイルを検証中', {
      fileName: file.name,
      fileSizeBytes: file.size,
      fileSizeMB: Number((file.size / 1024 ** 2).toFixed(1))
    });

    if (file.size >= 2 * 1024 ** 3) {
      throw new Error('初期ローダーでは2GB以上の単一GGUFファイルを扱いません。分割モデル対応は別途検証します。');
    }

    if (this.runtime) {
      log('unload', '前のモデルを解放中');
      await this.unload();
      log('unload-complete', '前のモデルを解放しました');
    }

    log('runtime-init', 'WASMランタイムを初期化中');
    const runtime = new Wllama({ default: wasmUrl });

    try {
      // wllama v3 の loadModel(File[]) はローカルファイル用の進捗率callbackを公開していない。
      // そのため、ここは実測できる百分率ではなく「処理中」としてUIに表示する。
      log('model-load', 'WASM・GGUF解析・モデルデータ展開を実行中', {
        note: 'ローカルloadModel APIに進捗率callbackはありません'
      });
      await runtime.loadModel([file], { n_ctx: 2048, n_batch: 128 });

      if (!runtime.isModelLoaded()) {
        throw new Error('loadModel()は終了しましたが、wllamaがモデル読み込み完了を確認できませんでした。');
      }

      this.runtime = runtime;
      this.loadedFileName = file.name;
      log('complete', 'モデル読み込み完了', {
        fileName: file.name,
        threads: runtime.getNumThreads(),
        multithread: runtime.isMultithread(),
        webGPU: runtime.isSupportWebGPU(),
        totalElapsedSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(1))
      });
    } catch (error) {
      console.error('[Local Codex][Model Load] 読み込み失敗', {
        fileName: file.name,
        elapsedSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(1)),
        error
      });
      try {
        await runtime.exit();
      } catch (cleanupError) {
        console.error('[Local Codex][Model Load] 失敗後のWASM解放にも失敗', cleanupError);
      }
      throw error;
    }
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
