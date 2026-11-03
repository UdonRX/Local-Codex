import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { benchmarkTasks } from './benchmark-tasks';
import { detectDeviceCapabilities, type DeviceCapabilities } from './device-capabilities';
import { LocalModelEngine, type GenerationMetrics } from './engine';
import { modelCandidates } from './model-catalog';

type Tab = 'overview' | 'models' | 'benchmark' | 'blueprint';
type SavedResult = {
  model: string;
  modelId?: string;
  task: string;
  taskId?: string;
  timestamp: string;
  elapsedMs: number;
  firstTokenMs?: number | null;
  outputChunks?: number;
  chunksPerSecondEstimate?: number | null;
  tokensPerSecond?: number | null;
  loadDurationMs?: number | null;
  fileName?: string;
  fileSizeBytes?: number;
  output: string;
  score: number | null;
  isStandalone?: boolean;
  platform?: string;
  userAgent?: string;
  hardwareConcurrency?: number | null;
};
const engine = new LocalModelEngine();

function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [device, setDevice] = useState<DeviceCapabilities | null>(null);
  const [selectedModel, setSelectedModel] = useState(modelCandidates[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loadedModel, setLoadedModel] = useState<string | null>(null);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const [loadDurationMs, setLoadDurationMs] = useState<number | null>(null);
  const [runIsWarmup, setRunIsWarmup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('local-codex-load-diagnostic') || 'null');
      return ['running', 'stalled'].includes(saved?.state) ? (saved?.stage ?? '前回の読み込みが中断されました') : saved?.stage ?? null;
    } catch { return null; }
  });
  const [loadStartedAt, setLoadStartedAt] = useState<number | null>(null);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [loadingStageSince, setLoadingStageSince] = useState<number | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('local-codex-load-diagnostic') || 'null');
      return saved?.stageStartedAt ? Date.parse(saved.stageStartedAt) : null;
    } catch { return null; }
  });
  const [stageElapsed, setStageElapsed] = useState(0);
  const [stageStalled, setStageStalled] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('local-codex-load-diagnostic') || 'null');
      return saved?.state === 'stalled';
    } catch { return false; }
  });
  const [loadError, setLoadError] = useState<string | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('local-codex-load-diagnostic') || 'null');
      return ['running', 'stalled'].includes(saved?.state)
        ? '前回の読み込みが完了せず中断、または30秒以上同じ工程で停滞しました。保存された診断情報を確認してください。'
        : saved?.error ?? null;
    } catch { return null; }
  });
  const [status, setStatus] = useState('端末診断を実行中');
  const [prompt, setPrompt] = useState('TypeScriptで配列の重複を除去し、元の順序を維持する関数を書いて。');
  const [output, setOutput] = useState('');
  const [metrics, setMetrics] = useState<GenerationMetrics | null>(null);
  const [taskId, setTaskId] = useState(benchmarkTasks[0].id);
  const [results, setResults] = useState<SavedResult[]>(() => {
    try { return JSON.parse(localStorage.getItem('local-codex-results') || '[]') as SavedResult[]; }
    catch { return []; }
  });
  const [score, setScore] = useState('3');
  const candidate = useMemo(() => modelCandidates.find((model) => model.id === selectedModel) ?? modelCandidates[0], [selectedModel]);
  const task = useMemo(() => benchmarkTasks.find((item) => item.id === taskId) ?? benchmarkTasks[0], [taskId]);

  useEffect(() => {
    detectDeviceCapabilities().then((value) => {
      setDevice(value);
      setStatus(value.isIOS ? 'iPhone / iPadを検出' : 'ブラウザ環境を検出');
    });
  }, []);
  useEffect(() => { localStorage.setItem('local-codex-results', JSON.stringify(results)); }, [results]);

  useEffect(() => {
    if (loadStartedAt === null) return;
    const updateElapsed = () => setLoadingElapsed(Math.floor((Date.now() - loadStartedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [loadStartedAt]);

  useEffect(() => {
    if (loadingStageSince === null || loadingStage === null) return;
    const updateStageElapsed = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - loadingStageSince) / 1000));
      setStageElapsed(seconds);
      if (seconds >= 30 && !stageStalled) {
        setStageStalled(true);
        console.warn('[Local Codex][Model Load] 工程が30秒以上停滞', {
          stage: loadingStage,
          stageElapsedSeconds: seconds,
          totalElapsedSeconds: loadStartedAt === null ? null : Math.floor((Date.now() - loadStartedAt) / 1000),
          fileName: file?.name ?? null,
          fileSizeBytes: file?.size ?? null,
          action: '停滞時点の工程・ファイル情報をlocalStorageに保存'
        });
        try {
          const previous = JSON.parse(localStorage.getItem('local-codex-load-diagnostic') || '{}');
          localStorage.setItem('local-codex-load-diagnostic', JSON.stringify({
            ...previous,
            state: 'stalled',
            stage: loadingStage,
            stageStartedAt: new Date(loadingStageSince).toISOString(),
            stageElapsedSeconds: seconds,
            stalledAt: new Date().toISOString(),
            fileName: file?.name ?? previous.fileName ?? null,
            fileSize: file?.size ?? previous.fileSize ?? null
          }));
        } catch (storageError) {
          console.warn('[Local Codex][Model Load] 停滞診断を保存できません', storageError);
        }
      }
    };
    updateStageElapsed();
    const timer = window.setInterval(updateStageElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [loadingStageSince, loadingStage, stageStalled, loadStartedAt, file]);

  async function loadModel() {
    if (busy) return;
    if (selectedFiles.length === 0 || !file) {
      const message = 'GGUFファイルが選択されていません。「ファイルを選択」からGGUFを選んでね。';
      setLoadError(message);
      setLoadingStage('GGUFファイル未選択');
      setStatus(message);
      return;
    }
    const startedAt = Date.now();
    console.info('[Local Codex][Model Load] 読み込みボタンのクリックを検知', {
      fileName: file.name,
      fileCount: selectedFiles.length,
      fileSizeBytes: selectedFiles.reduce((sum, item) => sum + item.size, 0),
      timestamp: new Date(startedAt).toISOString()
    });
    // Force React to paint the loading state synchronously before starting any
    // file/WASM work. This avoids relying on Safari's next animation frame.
    flushSync(() => {
      setBusy(true);
      setLoadingElapsed(0);
      setLoadError(null);
      setLoadStartedAt(startedAt);
      setLoadingStageSince(startedAt);
      setStageElapsed(0);
      setStageStalled(false);
      setLoadingStage('読み込みを開始しました');
      setStatus('読み込みボタンを検知。GGUFの読み込み処理を開始します');
    });
    try {
      localStorage.setItem('local-codex-load-diagnostic', JSON.stringify({ state: 'running', stage: '読み込みを準備中', startedAt: new Date(startedAt).toISOString(), stageStartedAt: new Date(startedAt).toISOString(), fileName: file.name, fileCount: selectedFiles.length, fileSize: selectedFiles.reduce((sum, item) => sum + item.size, 0) }));
    } catch (storageError) {
      console.warn('[Local Codex][Model Load] 診断状態を保存できません', storageError);
    }
    setOutput('');
    setMetrics(null);
    console.info('[Local Codex][Model Load] 読み込み開始', {
      fileName: file.name,
      fileCount: selectedFiles.length,
      fileSizeBytes: selectedFiles.reduce((sum, item) => sum + item.size, 0),
      fileSizeMB: Number((selectedFiles.reduce((sum, item) => sum + item.size, 0) / 1024 ** 2).toFixed(1)),
      userAgent: navigator.userAgent
    });
    try {
      // Start the engine directly after the synchronous UI update above.
      await engine.load(selectedFiles, (stage) => {
        const stageSince = Date.now();
        setLoadingStage(stage);
        setLoadingStageSince(stageSince);
        setStageElapsed(0);
        setStageStalled(false);
        setStatus('モデルを読み込み中：' + stage);
        try {
          localStorage.setItem('local-codex-load-diagnostic', JSON.stringify({ state: 'running', stage, startedAt: new Date(startedAt).toISOString(), stageStartedAt: new Date(stageSince).toISOString(), fileName: file.name, fileCount: selectedFiles.length, fileSize: selectedFiles.reduce((sum, item) => sum + item.size, 0) }));
        } catch (storageError) {
          console.warn('[Local Codex][Model Load] 診断状態を保存できません', storageError);
        }
      });
      const loadedName = selectedFiles.length === 1
        ? selectedFiles[0].name
        : selectedFiles[0].name.replace(/-\d{5}-of-\d{5}\.gguf$/i, '.gguf');
      setLoadedModel(loadedName);
      setLoadedModelId(selectedModel);
      setLoadDurationMs(Date.now() - startedAt);
      setLoadError(null);
      setLoadingStage(null);
      setLoadingStageSince(null);
      setStageElapsed(0);
      setStageStalled(false);
      localStorage.removeItem('local-codex-load-diagnostic');
      setStatus('モデル読み込み完了');
    } catch (error) {
      console.error('[Local Codex][Model Load] UI側でエラーを検知', error);
      const message = error instanceof Error ? error.message : 'モデル読み込みに失敗しました';
      setLoadError(message);
      setLoadingStage('読み込みに失敗しました');
      setLoadingStageSince(null);
      setStageStalled(false);
      try {
        localStorage.setItem('local-codex-load-diagnostic', JSON.stringify({ state: 'error', stage: '読み込みに失敗しました', error: message, failedAt: new Date().toISOString(), fileName: file.name, fileSize: file.size }));
      } catch (storageError) {
        console.warn('[Local Codex][Model Load] エラー内容を保存できません', storageError);
      }
      setStatus('モデル読み込みに失敗しました：' + message);
      setLoadedModel(null);
      setLoadedModelId(null);
      setLoadDurationMs(null);
    } finally {
      setBusy(false);
      // Keep the last stage and error visible after a fast failure. Clear them only
      // when the user starts another attempt or a later attempt succeeds.
      setLoadStartedAt(null);
      console.info('[Local Codex][Model Load] UI処理終了', {
        elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1))
      });
    }
  }

  async function runPrompt(text: string, isWarmup = false) {
    if (!loadedModel) { setStatus('先にGGUFモデルを読み込んでください'); return; }
    setBusy(true); setOutput(''); setMetrics(null); setRunIsWarmup(isWarmup); setStatus(isWarmup ? 'ウォームアップ生成中' : 'ベンチマーク生成中');
    try {
      const result = await engine.generate(text, setOutput);
      setMetrics(result); setStatus(isWarmup ? 'ウォームアップ完了（結果は保存しない）' : '生成完了');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '生成に失敗しました');
    } finally { setBusy(false); }
  }

  function saveBenchmarkResult() {
    if (!metrics) return;
    const modelInfo = modelCandidates.find((item) => item.id === loadedModelId);
    setResults((current) => [{
      model: modelInfo?.name ?? loadedModel ?? 'unknown',
      modelId: loadedModelId ?? undefined,
      task: task.title,
      taskId: task.id,
      timestamp: new Date().toISOString(),
      elapsedMs: metrics.elapsedMs,
      firstTokenMs: metrics.firstTokenMs,
      outputChunks: metrics.outputChunks,
      chunksPerSecondEstimate: metrics.chunksPerSecondEstimate,
      loadDurationMs,
      fileName: loadedModel ?? undefined,
      fileSizeBytes: selectedFiles.reduce((sum, item) => sum + item.size, 0),
      output,
      score: Number(score),
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency || null
    }, ...current]);
  }

  async function unloadModel() {
    setBusy(true);
    try { await engine.unload(); setLoadedModel(null); setLoadedModelId(null); setLoadDurationMs(null); setFile(null); setSelectedFiles([]); setStatus('モデルを解放しました'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'モデル解放に失敗しました'); }
    finally { setBusy(false); }
  }

  const comparisonRows = useMemo(() => modelCandidates.flatMap((model) =>
    [false, true].map((isStandalone) => {
      const rows = results.filter((result) =>
        result.modelId === model.id && Boolean(result.isStandalone) === isStandalone
      );
      const average = (values: (number | null | undefined)[]) => {
        const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
      };
      return {
        model,
        isStandalone,
        count: rows.length,
        loadMs: average(rows.map((row) => row.loadDurationMs)),
        ttftMs: average(rows.map((row) => row.firstTokenMs)),
        chunksPerSecond: average(rows.map((row) => row.chunksPerSecondEstimate ?? row.tokensPerSecond)),
        score: average(rows.map((row) => row.score))
      };
    })
  ), [results]);

  function exportBenchmarkResults(format: 'csv' | 'json') {
    if (results.length === 0) return;
    const content = format === 'json'
      ? JSON.stringify({ exportedAt: new Date().toISOString(), protocol: { context: 512, maxTokens: 512, temperature: 0.1, threads: 1 }, results }, null, 2)
      : [
          ['modelId','model','taskId','task','timestamp','loadMs','ttftMs','generationMs','outputChunks','chunksPerSecondEstimate','score','fileName','fileSizeBytes','isStandalone','platform','hardwareConcurrency'].join(','),
          ...results.map((row) => [
            row.modelId, row.model, row.taskId, row.task, row.timestamp, row.loadDurationMs,
            row.firstTokenMs, row.elapsedMs, row.outputChunks, row.chunksPerSecondEstimate ?? row.tokensPerSecond,
            row.score, row.fileName, row.fileSizeBytes, row.isStandalone, row.platform, row.hardwareConcurrency
          ].map((value) => {
            const text = value === null || value === undefined ? '' : String(value);
            return '"' + text.replace(/"/g, '""') + '"';
          }).join(','))
        ].join('\r\n');
    const blob = new Blob([content], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `local-codex-benchmark-${new Date().toISOString().slice(0,10)}.${format}`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">&lt;/&gt;</div>
        <div className="brand-copy"><strong>LOCAL CODEX</strong><span>ON-DEVICE MODEL LAB</span></div>
        <div className="live-pill"><i /> LOCAL FIRST</div>
      </header>
      <section className="hero">
        <div className="eyebrow">RESEARCH / STAGE 01</div>
        <h1>Find the best<br /><em>coding model</em><br />for your iPhone.</h1>
        <p>iPhone上で動くモデルを、同じ課題・同じ条件で比較するための実験環境。</p>
        <div className="hero-meta"><span>NO PAID API</span><span>NO REQUIRED SERVER</span><span>PWA FIRST</span></div>
      </section>
      <nav className="tabbar" aria-label="メインナビゲーション">
        {([['overview', '概要'], ['models', 'モデル'], ['benchmark', 'ベンチマーク'], ['blueprint', '設計']] as [Tab, string][]).map(([key, label]) =>
          <button key={key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>{label}</button>
        )}
      </nav>
      <div className="status-line"><span className="status-dot" />{status}</div>
      {loadingStage && <section className="model-loading-panel global-loading-panel" role="status" aria-live="polite">
        <div className="loading-heading"><strong>{loadError ? 'モデル読み込みエラー' : stageStalled ? '工程が30秒以上停滞' : busy ? 'モデルを読み込み中' : '前回の読み込み結果'}</strong><span>合計 {loadingElapsed}秒</span></div>
        <div className="loading-stage">{loadingStage}</div>
        <div className={stageStalled ? 'load-stall-warning' : 'load-phase-time'} role={stageStalled ? 'alert' : 'status'}>
          {stageStalled
            ? `この工程で約${stageElapsed}秒停止しています。処理が進んでいない可能性があります。工程名・開始時刻・ファイル情報を診断記録に保存しました。`
            : `現在の工程の経過時間：${stageElapsed}秒（30秒を超えると停滞として記録）`}
        </div>
        {busy && <div className="progress-track" role="progressbar" aria-label="モデル読み込み状況" aria-valuetext="処理中。正確な進捗率は取得できません">
          <div className="progress-indicator" />
        </div>}
        {loadError
          ? <p className="load-error-message">エラー内容：{loadError}<br />診断ログはVercelのRuntime Logsにも送信されます。ファイル本体やモデルの内容は送信しません。</p>
          : <p>{stageStalled ? '読み込みを続けていますが、この工程は30秒以上応答していません。VercelのRuntime Logsで [LOCAL-CODEX-DIAG] を検索してね。' : busy ? '工程ごとの開始・終了・15秒ごとの状態をVercelにも送信中。バーは正確な進捗率ではありません。' : '読み込み処理は終了しました。'}</p>}
      </section>}

      {tab === 'overview' && <section className="content-stack">
        <div className="section-heading"><div><div className="eyebrow">DEVICE PROFILE</div><h2>このiPhoneの実行能力</h2></div><span className="subtle-tag">LIVE CHECK</span></div>
        <div className="capability-grid">
          <Metric label="WebGPU" value={device ? (device.webGPU ? '対応' : '未検出') : '確認中'} good={Boolean(device?.webGPU)} />
          <Metric label="WebAssembly" value={device ? (device.wasm ? '対応' : '非対応') : '確認中'} good={Boolean(device?.wasm)} />
          <Metric label="SharedArrayBuffer" value={device ? (device.sharedArrayBuffer ? '対応' : '制限') : '確認中'} good={Boolean(device?.sharedArrayBuffer)} />
          <Metric label="Cross-origin isolated" value={device ? (device.crossOriginIsolated ? 'YES' : 'NO') : '確認中'} good={Boolean(device?.crossOriginIsolated)} />
          <Metric label="CPU threads hint" value={device?.hardwareConcurrency ? String(device.hardwareConcurrency) : '不明'} />
          <Metric label="Storage quota" value={device?.storageQuotaGB ? device.storageQuotaGB.toFixed(1) + ' GB' : '取得不可'} />
        </div>
        <div className="info-card"><div className="card-title-row"><h3>最初に確認すること</h3><span className="number-chip">01</span></div>
          <p>iPhoneのSafariで開き、WebGPU・WASM・ストレージの診断結果を確認する。ホーム画面に追加した状態でも同じ診断を行う。</p>
          <p className="muted">{device?.isStandalone ? 'ホーム画面アプリとして起動中。' : 'Safariブラウザで起動中。ホーム画面に追加した後も再確認してね。'}</p>
        </div>
        <div className="info-card warning-card"><div className="card-title-row"><h3>現時点の制約</h3><span className="number-chip">!</span></div>
          <p>GitHub PagesはCOOP/COEPヘッダーを設定できないため、SharedArrayBufferを使うマルチスレッドWASMは期待しない。まず単一スレッドでモデルがロードできるか確認する。</p>
        </div>
        <div className="info-card"><div className="card-title-row"><h3>実機テスト対象</h3><span className="subtle-tag">STAGE 1</span></div>
          <p>iPhone 18 Pro / iOS 27系を予定。正確なiOSバージョン、空き容量、ホーム画面起動の有無は実機で記録する。</p>
        </div>
      </section>}

      {tab === 'models' && <section className="content-stack">
        <div className="section-heading"><div><div className="eyebrow">MODEL CANDIDATES</div><h2>比較するモデル</h2></div><span className="subtle-tag">{modelCandidates.length} MODELS</span></div>
        {modelCandidates.map((model) => <button key={model.id} className={selectedModel === model.id ? 'model-card selected' : 'model-card'} onClick={() => setSelectedModel(model.id)}>
          <div className="model-top"><div><span className={'status-tag ' + model.status}>{model.status === 'primary-test' ? '優先テスト' : model.status === 'secondary-test' ? '次点' : '調査のみ'}</span><h3>{model.name}</h3></div><span className="radio-mark">{selectedModel === model.id ? '●' : '○'}</span></div>
          <div className="model-spec">{model.parameters} <b>·</b> {model.quantization} <b>·</b> {model.estimatedSize}</div>
          <p>{model.purpose}</p><div className="model-note">{model.notes}</div><span className="text-link">モデル配布ページ ↗</span>
        </button>)}
        <div className="info-card"><h3>選択中：{candidate.name}</h3><p>{candidate.license}</p>
          <a className="external-link" href={candidate.repoUrl} target="_blank" rel="noreferrer">Hugging Faceでモデル情報を確認 ↗</a>
          {candidate.fileUrl && <a className="external-link" href={candidate.fileUrl} target="_blank" rel="noreferrer">GGUFファイルを開く ↗</a>}
          <p className="muted">大容量モデルはダウンロード前にファイルサイズとiPhoneの空き容量を確認してね。モデルのライセンスは利用前に原文を確認すること。</p>
        </div>
        <div className="info-card"><h3>GGUFを読み込む</h3><p>まずは2GB未満のGGUFをiPhoneの「ファイル」に保存して選択する。初期ローダーでは2GB以上の単一ファイルは対象外。</p>
          <input className="file-input" type="file" accept=".gguf" multiple onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            setSelectedFiles(selected);
            setFile(selected[0] ?? null);
            setLoadError(null);
            setLoadingStage(null);
            const total = selected.reduce((sum, item) => sum + item.size, 0);
            setStatus(selected.length > 1
              ? `${selected.length}個のGGUF分割ファイルを選択しました（合計 ${(total / 1024 ** 3).toFixed(2)} GB）`
              : selected.length === 1 ? 'GGUFファイルを選択しました' : 'GGUFファイルが未選択です');
          }} />
          {selectedFiles.length > 0
            ? <div className="selected-file">
                {selectedFiles.length === 1
                  ? `${file?.name} · ${(file!.size / 1024 ** 3).toFixed(2)} GB`
                  : `${selectedFiles.length}個の分割ファイル · 合計 ${(selectedFiles.reduce((sum, item) => sum + item.size, 0) / 1024 ** 3).toFixed(2)} GB`}
                {selectedFiles.map((item) => <div key={item.name}>{item.name} · {(item.size / 1024 ** 2).toFixed(0)} MB</div>)}
              </div>
            : <p className="muted">まだファイルが選択されていません。先にGGUFファイルを選んでね。</p>}
          <p className="muted">2GB以上のモデルは、PCでllama-gguf-splitを使って512MB程度に分割し、全パーツをまとめて選択してね。単純なファイル分割ではなくGGUF専用ツールが必要。</p>
          <button type="button" className="primary-button" disabled={busy || selectedFiles.length === 0} onClick={() => { console.info("[Local Codex][UI] GGUF読み込みボタンが押されました"); void loadModel(); }}>{busy ? '処理中…' : '選択したGGUFをiPhone内で読み込む'}</button>
          {loadedModel && <div className="loaded-row"><span>読み込み済み：{loadedModel} {loadDurationMs !== null ? `· 読み込み ${(loadDurationMs / 1000).toFixed(1)}秒` : ''}</span><button className="text-button" onClick={unloadModel} disabled={busy}>解放</button></div>}
        </div>
      </section>}

      {tab === 'benchmark' && <section className="content-stack">
        <div className="section-heading"><div><div className="eyebrow">REPEATABLE EVALUATION</div><h2>同じ課題で比較</h2></div><span className="subtle-tag">{results.length} RESULTS</span></div>
        <div className="info-card"><label className="field-label" htmlFor="task-select">テスト課題</label>
          <select id="task-select" value={taskId} onChange={(event) => setTaskId(event.target.value)}>
            {benchmarkTasks.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.difficulty}</option>)}
          </select>
          <div className="task-rubric"><strong>採点基準</strong>{task.rubric.map((item) => <span key={item}>• {item}</span>)}</div>
          <button className="secondary-button" onClick={() => setPrompt(task.prompt)}>課題文を入力欄にセット</button>
          <label className="field-label" htmlFor="prompt">プロンプト</label>
          <textarea id="prompt" rows={9} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          <button className="secondary-button" disabled={!loadedModel || busy || !prompt.trim()} onClick={() => runPrompt(prompt, true)}>ウォームアップとして実行（保存しない）</button>
          <button className="primary-button" disabled={!loadedModel || busy || !prompt.trim()} onClick={() => runPrompt(prompt, false)}>{busy ? '生成中…' : '測定実行（結果を採点して保存）'}</button>
          <p className="muted">比較条件は全モデル共通：context 512、max_tokens 512、temperature 0.1、CPU 1 thread。各課題はウォームアップ1回の後、測定を3回行う。</p>
        </div>
        {output && <div className="output-card"><div className="card-title-row"><h3>モデル出力</h3>{metrics && <span className="subtle-tag">{(metrics.elapsedMs / 1000).toFixed(1)} sec</span>}</div>
          <pre>{output}</pre>{metrics && <div className="metric-strip">
            <span>生成時間 <b>{(metrics.elapsedMs / 1000).toFixed(2)}秒</b></span>
            <span>初回出力 TTFT <b>{metrics.firstTokenMs === null ? '—' : (metrics.firstTokenMs / 1000).toFixed(2) + '秒'}</b></span>
            <span>概算chunk/s <b>{metrics.chunksPerSecondEstimate?.toFixed(1) ?? '—'}</b></span>
            <span>出力chunk数 <b>{metrics.outputChunks}</b></span>
          </div>}
          <label className="field-label" htmlFor="score">手動品質スコア（1〜5）</label>
          <select id="score" value={score} onChange={(event) => setScore(event.target.value)}><option value="1">1 — 要件を満たさない</option><option value="2">2 — 大きな欠落</option><option value="3">3 — 部分的に正しい</option><option value="4">4 — ほぼ正しい</option><option value="5">5 — 正確・完全</option></select>
          {runIsWarmup
            ? <p className="muted">これはウォームアップ結果。比較データには保存しないでね。</p>
            : <button className="primary-button" onClick={saveBenchmarkResult}>採点して比較データに保存</button>}
        </div>}
        <div className="info-card">
          <h3>モデル別の比較表</h3>
          <p className="muted">保存した測定結果の平均値。scoreは手動採点の平均。chunk/sはトークン速度ではなく、ストリームchunk数による参考値。</p>
          <div className="comparison-table-wrap"><table className="comparison-table">
            <thead><tr><th>起動</th><th>モデル</th><th>回数</th><th>読込</th><th>TTFT</th><th>chunk/s</th><th>品質</th></tr></thead>
            <tbody>{comparisonRows.map((row) => <tr key={row.model.id + String(row.isStandalone)}>
              <td>{row.isStandalone ? 'PWA' : 'Safari'}</td><td>{row.model.name}</td><td>{row.count}</td>
              <td>{row.loadMs === null ? '—' : (row.loadMs / 1000).toFixed(1) + 's'}</td>
              <td>{row.ttftMs === null ? '—' : (row.ttftMs / 1000).toFixed(1) + 's'}</td>
              <td>{row.chunksPerSecond === null ? '—' : row.chunksPerSecond.toFixed(1)}</td>
              <td>{row.score === null ? '—' : row.score.toFixed(2) + '/5'}</td>
            </tr>)}</tbody>
          </table></div>
          <div className="export-actions">
            <button className="secondary-button" disabled={results.length === 0} onClick={() => exportBenchmarkResults('csv')}>CSVを書き出す</button>
            <button className="secondary-button" disabled={results.length === 0} onClick={() => exportBenchmarkResults('json')}>JSONを書き出す</button>
          </div>
          <h3>保存済み結果（{results.length}件）</h3>
          {results.length === 0 ? <p className="muted">まだ結果はありません。モデルを読み込んで課題を実行してね。</p> : results.slice(0, 30).map((result, index) => <div className="result-row" key={result.timestamp + index}>
            <div><strong>{result.model}</strong><span>{result.task} · TTFT {result.firstTokenMs == null ? '—' : (result.firstTokenMs / 1000).toFixed(1) + 's'} · {new Date(result.timestamp).toLocaleString()}</span></div><div className="result-score">{result.score ?? '—'}/5</div>
          </div>)}
          {results.length > 0 && <button className="text-button" onClick={() => { setResults([]); localStorage.removeItem('local-codex-results'); }}>結果を全削除</button>}
        </div>
      </section>}

      {tab === 'blueprint' && <section className="content-stack">
        <div className="section-heading"><div><div className="eyebrow">FOUNDATION</div><h2>開発の基本設計</h2></div><span className="subtle-tag">PWA FIRST</span></div>
        <Blueprint title="01 / Presentation" detail="React + TypeScript + Vite。iPhone縦画面、safe-area、ホーム画面起動、オフライン対応。" />
        <Blueprint title="02 / Local inference" detail="wllama v3 + llama.cpp WASM。最初は単一スレッドで検証し、WebGPU・分割モデル・永続キャッシュを順番に検証。" />
        <Blueprint title="03 / Coding agent" detail="Planner → Repository map → Tool router → Patch writer → Test runner → Reviewer。モデルとツール実行を分離する。" />
        <Blueprint title="04 / GitHub" detail="GitHub APIで取得・ブランチ・ツリー・コミット。編集差分の確認とユーザー承認を必須にする。" />
        <Blueprint title="05 / Storage" detail="IndexedDBを主ストアにし、モデル・会話・作業チェックポイントを分離。ブラウザ保存領域の消去に備え再取得とエクスポートを用意。" />
        <Blueprint title="06 / Free-only routing" detail="ローカルを既定にする。無料クラウドは明示許可・無料枠内だけ。上限・課金リスク・規約不明なら呼び出さずローカルへ戻す。" />
        <a className="external-link" href="https://github.com/UdonRX/Local-Codex/tree/main/docs" target="_blank" rel="noreferrer">設計ドキュメントをGitHubで読む ↗</a>
      </section>}

      <footer className="footer"><div className="footer-brand">LOCAL CODEX <span>v0.1 FOUNDATION</span></div>
        <p>Local inference first. Free-only by design. No paid API fallback.</p>
        <p className="muted">モデルの実機適合・速度・品質は未検証。診断表示はブラウザの能力情報であり、実際の空きRAMを示すものではありません。</p>
      </footer>
    </main>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div className="metric-card"><span>{label}</span><strong className={good ? 'good' : ''}>{value}</strong></div>;
}
function Blueprint({ title, detail }: { title: string; detail: string }) {
  return <div className="blueprint-card"><span>{title}</span><p>{detail}</p></div>;
}
export default App;
