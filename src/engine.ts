import { Wllama } from '@wllama/wllama';
import wasmUrl from '@wllama/wllama/src/wasm/wllama.wasm?url';
import compatWasmUrl from '@wllama/wllama-compat/wasm/wllama.wasm?url';
import compatWorkerCode from '@wllama/wllama-compat/wasm/wllama.js?raw';
import { createLoadDiagnosticReporter } from './load-telemetry';

export interface GenerationMetrics {
  text: string; elapsedMs: number; tokensPerSecond: number | null; estimatedOutputTokens: number;
}

type LoadStageCallback = (message: string) => void;

type GgufHeaderInfo = {
  valid: boolean;
  version?: number;
  tensorCount?: number;
  metadataCount?: number;
  architecture?: string;
  modelName?: string;
  fileType?: number;
  note?: string;
};

type MemorySnapshot = {
  deviceMemoryGB?: number;
  jsHeapUsedMB?: number;
  jsHeapLimitMB?: number;
  storageQuotaGB?: number;
  storageUsageGB?: number;
  fileSizeMB: number;
  roughWorkingSetLowGB: number;
  roughWorkingSetHighGB: number;
  note: string;
};

function readGgufHeader(file: File): Promise<GgufHeaderInfo> {
  // Read only the header area. Never copy the 1.22GB model into JS memory for diagnosis.
  return file.slice(0, Math.min(file.size, 16 * 1024 * 1024)).arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    let offset = 0;
    const need = (length: number) => {
      if (offset + length > view.byteLength) throw new Error('GGUF metadata exceeds the 16MB diagnostic header window');
    };
    const u32 = () => { need(4); const value = view.getUint32(offset, true); offset += 4; return value; };
    const u64 = () => {
      need(8);
      const low = view.getUint32(offset, true);
      const high = view.getUint32(offset + 4, true);
      offset += 8;
      const value = high * 0x100000000 + low;
      if (!Number.isSafeInteger(value)) throw new Error('GGUF field length is too large');
      return value;
    };
    const string = () => {
      const length = u64();
      if (length > 16 * 1024 * 1024) throw new Error('GGUF string is too large for the diagnostic header window');
      need(length);
      const value = new TextDecoder().decode(bytes.subarray(offset, offset + length));
      offset += length;
      return value;
    };
    const skip = (type: number) => {
      const sizes: Record<number, number> = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };
      if (type === 8) { string(); return; }
      if (type === 9) {
        const elementType = u32();
        const count = u64();
        if (count > 100000) throw new Error('GGUF array is too large for safe diagnostic parsing');
        for (let i = 0; i < count; i++) skip(elementType);
        return;
      }
      const size = sizes[type];
      if (size === undefined) throw new Error('Unknown GGUF metadata value type: ' + type);
      need(size);
      offset += size;
    };

    try {
      if (view.byteLength < 24 || view.getUint32(0, true) !== 0x46554747) {
        return { valid: false, note: 'GGUF magicが見つからない。ファイル形式または破損を確認' };
      }
      offset = 4;
      const version = u32();
      const tensorCount = u64();
      const metadataCount = u64();
      if (metadataCount > 100000) throw new Error('GGUF metadata count is implausibly large');
      let architecture: string | undefined;
      let modelName: string | undefined;
      let fileType: number | undefined;
      for (let i = 0; i < metadataCount; i++) {
        const key = string();
        const type = u32();
        if (key === 'general.architecture' && type === 8) architecture = string();
        else if (key === 'general.name' && type === 8) modelName = string();
        else if (key === 'general.file_type' && type === 4) fileType = u32();
        else skip(type);
      }
      return { valid: true, version, tensorCount, metadataCount, architecture, modelName, fileType,
        note: architecture ? 'GGUFヘッダーを解析できた' : 'ヘッダーは読めたがgeneral.architectureが見つからない' };
    } catch (error) {
      return { valid: false, note: error instanceof Error ? error.message : String(error) };
    }
  });
}

async function collectMemorySnapshot(fileSizeBytes: number): Promise<MemorySnapshot> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const perf = performance as Performance & { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } };
  let storageQuotaGB: number | undefined;
  let storageUsageGB: number | undefined;
  try {
    const estimate = await navigator.storage?.estimate();
    if (estimate?.quota !== undefined) storageQuotaGB = Number((estimate.quota / 1024 ** 3).toFixed(2));
    if (estimate?.usage !== undefined) storageUsageGB = Number((estimate.usage / 1024 ** 3).toFixed(2));
  } catch { /* Storage estimate is optional and often unavailable on iOS. */ }
  return {
    deviceMemoryGB: nav.deviceMemory,
    jsHeapUsedMB: perf.memory?.usedJSHeapSize === undefined ? undefined : Number((perf.memory.usedJSHeapSize / 1024 ** 2).toFixed(1)),
    jsHeapLimitMB: perf.memory?.jsHeapSizeLimit === undefined ? undefined : Number((perf.memory.jsHeapSizeLimit / 1024 ** 2).toFixed(1)),
    storageQuotaGB,
    storageUsageGB,
    fileSizeMB: Number((fileSizeBytes / 1024 ** 2).toFixed(1)),
    // Heuristic only: weights + runtime/KV/work buffers. Not a measurement or guaranteed upper bound.
    roughWorkingSetLowGB: Number((fileSizeBytes * 1.5 / 1024 ** 3).toFixed(2)),
    roughWorkingSetHighGB: Number((fileSizeBytes * 2.5 / 1024 ** 3).toFixed(2)),
    note: 'iOS Safariは実RAM/空きRAMを通常公開しない。deviceMemory・JS heap・StorageはRAM容量の代用ではない'
  };
}

function classifyLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/out of memory|oom|memory access out of bounds|allocation failed|cannot enlarge memory|bad alloc/i.test(message)) {
    return 'メモリ不足の可能性が高い';
  }
  if (/unknown model architecture|unsupported architecture|unsupported model|qwen35|qwen3.?5/i.test(message)) {
    return 'モデルアーキテクチャ非対応の可能性が高い';
  }
  if (/wasm|webassembly|worker|moduleinit|instantiate|compile|network|fetch/i.test(message)) {
    return 'WASMまたはWorker初期化の問題の可能性が高い';
  }
  return 'ログだけでは原因を確定できない。直前のwllamaログを確認';
}

export class LocalModelEngine {
  private runtime: Wllama | null = null;
  private loadedFileName: string | null = null;

  async load(file: File, onStage?: LoadStageCallback): Promise<void> {
    const startedAt = performance.now();
    const report = createLoadDiagnosticReporter(file.name, file.size);
    let currentPhase = '入力検査';
    let phaseStartedAt = performance.now();
    let heartbeatBusy = false;
    const elapsed = () => Number(((performance.now() - startedAt) / 1000).toFixed(1));
    const setPhase = (phase: string, message: string, details: Record<string, unknown> = {}) => {
      const now = performance.now();
      const previousPhase = currentPhase;
      const previousPhaseElapsedSeconds = Number(((now - phaseStartedAt) / 1000).toFixed(1));
      currentPhase = phase;
      phaseStartedAt = now;
      console.info('[Local Codex][Load Diagnosis]', message, {
        phase,
        previousPhase,
        previousPhaseElapsedSeconds,
        elapsedSeconds: elapsed(),
        ...details
      });
      report('phase', { phase, previousPhase, previousPhaseElapsedSeconds, elapsedSeconds: elapsed(), message, details });
      onStage?.(message);
    };
    const logWllama = (level: 'debug' | 'log' | 'warn' | 'error', ...args: unknown[]) => {
      const text = args.map((item) => typeof item === 'string' ? item : (() => {
        try { return JSON.stringify(item); } catch { return String(item); }
      })()).join(' ');
      console[level === 'log' ? 'info' : level === 'debug' ? 'info' : level]('[wllama][' + level + ']', ...args);
      if (/Calling wllamaStart|Loading model|error|failed|exception|abort|memory/i.test(text)) {
        report('wllama_log', { level, message: text.slice(0, 1600), elapsedSeconds: elapsed(), phase: currentPhase });
      }
      if (/Calling wllamaStart/i.test(text)) {
        setPhase('moduleInit終了', 'moduleInit完了。WASMエンジン起動へ移行', { wllamaLog: text });
        setPhase('WASM起動（wllamaStart）', 'WASMエンジンを起動中', { wllamaLog: text });
      } else if (/Loading model/i.test(text)) {
        setPhase('GGUFモデル読み込み（ネイティブload）', 'GGUFモデル本体を解析・展開中', { wllamaLog: text });
      }
    };

    setPhase('ファイル検査', 'GGUFファイル情報を検査中', {
      fileName: file.name,
      fileSizeBytes: file.size,
      fileSizeMB: Number((file.size / 1024 ** 2).toFixed(1)),
      userAgent: navigator.userAgent
    });
    if (file.size >= 2 * 1024 ** 3) {
      throw new Error('初期ローダーでは2GB以上の単一GGUFファイルを扱いません。');
    }
    const [header, memoryBefore] = await Promise.all([
      readGgufHeader(file),
      collectMemorySnapshot(file.size)
    ]);
    console.info('[Local Codex][GGUF Header]', header);
    console.info('[Local Codex][Memory Snapshot][before]', memoryBefore);
    if (!header.valid) {
      console.warn('[Local Codex][GGUF Header] ヘッダーを完全に解析できなかったため、形式不正とは断定しません', header.note);
    }
    if (header.architecture) {
      console.info('[Local Codex][Architecture Check]', {
        ggufArchitecture: header.architecture,
        expectedQwen35Architecture: 'qwen35',
        matchesSelectedQwen35Family: header.architecture === 'qwen35',
        note: 'この一致だけではwllama内蔵llama.cppの対応を証明できない。実際のnative load結果とエラーを確認する'
      });
    }

    if (this.runtime) {
      setPhase('前モデル解放', '前のモデルを解放中');
      await this.unload();
    }

    // The default wllama WASM uses Memory64, which current Safari/iOS does not parse.
    // Enable the official Safari compatibility build before any WASM is fetched or compiled.
    setPhase('Safari互換WASMを準備中', 'iPhone用のSafari互換WASMを準備中');
    console.info('[Local Codex][WASM Compatibility] Safari/Memory64 fallback enabled', {
      strategy: 'bundled @wllama/wllama-compat 3.8.1 (no CDN)',
      wasmAsset: 'Vite-bundled local asset',
      workerAsset: 'Vite-bundled inline worker code',
      note: 'Memory64非対応ブラウザでは同梱済みAsyncify + wasm32互換ビルドを使用する。実行時CDN取得なし'
    });

    setPhase('WASMランタイム生成', 'wllamaランタイムを生成中');
    const runtime = new Wllama(
      { default: wasmUrl },
      {
        logger: {
          debug: (...args: unknown[]) => logWllama('debug', ...args),
          log: (...args: unknown[]) => logWllama('log', ...args),
          warn: (...args: unknown[]) => logWllama('warn', ...args),
          error: (...args: unknown[]) => logWllama('error', ...args)
        }
      }
    );
    runtime.setCompat({
      wasm: compatWasmUrl,
      worker: { code: compatWorkerCode }
    });
    console.info('[Local Codex][Runtime Info]', {
      libllamaVersion: Wllama.getLibllamaVersion(),
      webGPUAvailable: runtime.isSupportWebGPU(),
      loadMode: 'CPU only / single thread',
      wasmCompatibility: 'Safari compatibility bundled locally (no CDN)',
      ggufArchitecture: header.architecture ?? 'unknown'
    });

    const heartbeat = window.setInterval(() => {
      if (heartbeatBusy) return;
      heartbeatBusy = true;
      void collectMemorySnapshot(file.size).then((memory) => {
        const phaseSeconds = Number(((performance.now() - phaseStartedAt) / 1000).toFixed(1));
        let suspicion = '処理中。まだ原因を断定できない';
        if (currentPhase === 'wllama.loadModel内部準備') suspicion = 'wllamaのWorker準備・prepareBlobs・moduleInitのいずれかで停滞している可能性';
        if (currentPhase === 'WASM起動（wllamaStart）') suspicion = 'WASMランタイム起動中。WASM/Worker初期化を疑う';
        if (currentPhase === 'GGUFモデル読み込み（ネイティブload）') {
          suspicion = header.architecture === 'qwen35'
            ? 'GGUF本体の読み込み中。メモリ不足または内蔵llama.cppのqwen35対応を切り分ける'
            : 'GGUF本体の読み込み中。メモリ不足・GGUF形式・アーキテクチャを切り分ける';
        }
        const diagnostic = {
          phase: currentPhase,
          elapsedSeconds: elapsed(),
          phaseElapsedSeconds: phaseSeconds,
          suspicion,
          memory,
          gguf: header,
          fileName: file.name,
          fileSizeBytes: file.size,
          libllamaVersion: Wllama.getLibllamaVersion(),
          lastHeartbeatAt: new Date().toISOString()
        };
        console.warn('[Local Codex][Load Diagnosis][heartbeat]', diagnostic);
        report('heartbeat', diagnostic);
        try {
          localStorage.setItem('local-codex-load-diagnostic', JSON.stringify({
            state: phaseSeconds >= 30 ? 'stalled' : 'running',
            stage: currentPhase,
            stageStartedAt: new Date(phaseStartedAt).toISOString(),
            startedAt: new Date(startedAt).toISOString(),
            fileName: file.name,
            fileSize: file.size,
            diagnostic
          }));
        } catch (storageError) {
          console.warn('[Local Codex][Load Diagnosis] heartbeat診断を保存できません', storageError);
        }
      }).catch((error) => console.warn('[Local Codex][Memory Snapshot] 取得失敗', error))
        .finally(() => { heartbeatBusy = false; });
    }, 15000);

    const originalWorker = window.Worker;
    const originalBlobArrayBuffer = Blob.prototype.arrayBuffer;
    let workerPreparationFinished = false;
    let ggufPreparationStarted = false;

    const onWindowError = (event: ErrorEvent) => {
      const detail = { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno, phase: currentPhase, elapsedSeconds: elapsed() };
      console.error('[Local Codex][Window error]', detail);
      report('window_error', detail);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? { name: event.reason.name, message: event.reason.message, stack: event.reason.stack } : String(event.reason);
      const detail = { reason, phase: currentPhase, elapsedSeconds: elapsed() };
      console.error('[Local Codex][Unhandled rejection]', detail);
      report('unhandled_rejection', detail);
    };

    try {
      window.addEventListener('error', onWindowError);
      window.addEventListener('unhandledrejection', onUnhandledRejection);
      report('load_started', { phase: currentPhase, userAgent: navigator.userAgent, platform: navigator.platform, isStandalone: window.matchMedia('(display-mode: standalone)').matches });
      // wllama 3.8.1 internal sequence:
      // Worker proxy setup -> prepareBlobs -> moduleInit -> wllamaStart -> native load.
      // The library does not expose callbacks for these internal steps, so observe
      // the Blob probe and Worker construction while loadModel is running.
      try {
        Blob.prototype.arrayBuffer = function (this: Blob): Promise<ArrayBuffer> {
          if (!workerPreparationFinished) {
            workerPreparationFinished = true;
            setPhase('Worker準備終了', 'Worker準備完了。GGUFファイルの内部準備を開始', {
              marker: 'wllama internal prepareBlobs probe'
            });
          }
          if (!ggufPreparationStarted) {
            ggufPreparationStarted = true;
            setPhase('GGUF準備開始', 'GGUFファイルの内部準備中（形式判定・Blob整理）', {
              blobSizeBytes: this.size,
              marker: 'wllama prepareBlobs / isMmproj'
            });
          }
          return originalBlobArrayBuffer.call(this).then((buffer) => {
            console.info('[Local Codex][Load Phase] GGUFヘッダー判定用Blob読み取り完了', {
              blobSizeBytes: this.size,
              elapsedSeconds: elapsed()
            });
            return buffer;
          });
        };

        window.Worker = new Proxy(originalWorker, {
          construct(target, args, newTarget) {
            if (ggufPreparationStarted) {
              setPhase('GGUF準備終了', 'GGUF内部準備完了。Worker moduleInitを開始', {
                marker: 'Worker construction follows prepareBlobs in wllama 3.8.1'
              });
            } else if (!workerPreparationFinished) {
              workerPreparationFinished = true;
              setPhase('Worker準備終了', 'Worker準備完了。moduleInitを開始', {
                marker: 'Worker construction reached before Blob probe'
              });
            }
            setPhase('moduleInit開始', 'moduleInit開始（互換Worker生成・WASMモジュール初期化）');
            const worker = Reflect.construct(target, args, newTarget) as Worker;
            worker.addEventListener('error', (event) => {
              console.error('[Local Codex][Load Phase] Worker error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                elapsedSeconds: elapsed(),
                phase: currentPhase
              });
              report('worker_error', { message: event.message, filename: event.filename, lineno: event.lineno, elapsedSeconds: elapsed(), phase: currentPhase });
            });
            worker.addEventListener('messageerror', (event) => {
              const detail = { type: event.type, elapsedSeconds: elapsed(), phase: currentPhase };
              console.error('[Local Codex][Load Phase] Worker messageerror', detail);
              report('worker_messageerror', detail);
            });
            return worker;
          }
        });
      } catch (instrumentationError) {
        console.warn('[Local Codex][Load Phase] 内部工程計測を一部有効化できません', instrumentationError);
      }

      setPhase('Worker準備開始', 'Worker準備開始（wllama内部ロード前処理）', {
        note: 'Worker proxy初期化・実行環境判定の開始'
      });
      console.info('[Local Codex][Load Diagnosis] wllama.loadModel enter', {
        lowMemoryDiagnosticMode: true,
        n_ctx: 512,
        n_batch: 32,
        n_ubatch: 32,
        n_parallel: 1,
        n_gpu_layers: 0,
        n_threads: 1,
        warmup: false
      });
      await runtime.loadModel([file], {
        n_ctx: 512,
        n_batch: 32,
        n_ubatch: 32,
        n_parallel: 1,
        n_gpu_layers: 0,
        n_threads: 1,
        warmup: false
      });

      if (!runtime.isModelLoaded()) throw new Error('loadModel()は終了しましたが、wllamaがモデル読み込み完了を確認できませんでした。');
      this.runtime = runtime;
      this.loadedFileName = file.name;
      console.info('[Local Codex][Load Diagnosis] load success', {
        elapsedSeconds: elapsed(),
        modelMetadata: runtime.getModelMetadata(),
        loadedContextInfo: runtime.getLoadedContextInfo(),
        memoryAfter: await collectMemorySnapshot(file.size)
      });
      report('load_success', { phase: currentPhase, elapsedSeconds: elapsed(), fileName: file.name, fileSizeBytes: file.size });
      setPhase('読み込み完了', 'モデル読み込み完了', {
        fileName: file.name,
        threads: runtime.getNumThreads(),
        multithread: runtime.isMultithread(),
        webGPU: runtime.isSupportWebGPU(),
        totalElapsedSeconds: elapsed()
      });
    } catch (error) {
      console.error('[Local Codex][Load Diagnosis] load failed', {
        elapsedSeconds: elapsed(),
        phase: currentPhase,
        phaseElapsedSeconds: Number(((performance.now() - phaseStartedAt) / 1000).toFixed(1)),
        diagnosis: classifyLoadError(error),
        error,
        ggufHeader: header,
        memoryAtFailure: await collectMemorySnapshot(file.size)
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      report('load_failed', { phase: currentPhase, elapsedSeconds: elapsed(), phaseElapsedSeconds: Number(((performance.now() - phaseStartedAt) / 1000).toFixed(1)), diagnosis: classifyLoadError(error), errorMessage, errorStack: error instanceof Error ? error.stack : undefined, ggufHeader: header, memoryAtFailure: await collectMemorySnapshot(file.size) });
      try { await runtime.exit(); }
      catch (cleanupError) { console.error('[Local Codex][Load Diagnosis] runtime cleanup failed', cleanupError); }
      throw error;
    } finally {
      window.clearInterval(heartbeat);
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      report('load_cleanup', { phase: currentPhase, elapsedSeconds: elapsed() });
      // Restore browser globals even if only one of the instrumentation hooks
      // could be installed successfully.
      window.Worker = originalWorker;
      Blob.prototype.arrayBuffer = originalBlobArrayBuffer;
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
