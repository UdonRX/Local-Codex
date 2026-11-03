import { useEffect, useMemo, useState } from 'react';
import { benchmarkTasks } from './benchmark-tasks';
import { detectDeviceCapabilities, type DeviceCapabilities } from './device-capabilities';
import { LocalModelEngine, type GenerationMetrics } from './engine';
import { modelCandidates } from './model-catalog';

type Tab = 'overview' | 'models' | 'benchmark' | 'blueprint';
type SavedResult = {
  model: string; task: string; timestamp: string; elapsedMs: number;
  tokensPerSecond: number | null; output: string; score: number | null;
};
const engine = new LocalModelEngine();

function App() {
  const [tab, setTab] = useState<Tab>('overview');
  const [device, setDevice] = useState<DeviceCapabilities | null>(null);
  const [selectedModel, setSelectedModel] = useState(modelCandidates[0].id);
  const [file, setFile] = useState<File | null>(null);
  const [loadedModel, setLoadedModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const [loadStartedAt, setLoadStartedAt] = useState<number | null>(null);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
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
    if (loadStartedAt === null || loadingStage === null) return;
    const timer = window.setInterval(() => {
      console.info('[Local Codex][Model Load] まだ処理中', {
        stage: loadingStage,
        elapsedSeconds: Math.floor((Date.now() - loadStartedAt) / 1000),
        hint: 'この工程はwllama内部処理のため、ローカルloadModelから進捗率を取得できません'
      });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadStartedAt, loadingStage]);

  async function loadModel() {
    if (!file) return;
    const startedAt = Date.now();
    setBusy(true);
    setLoadingElapsed(0);
    setLoadStartedAt(startedAt);
    setLoadingStage('読み込みを準備中');
    setStatus('モデルを読み込み中。画面を閉じないでください');
    setOutput('');
    setMetrics(null);
    console.info('[Local Codex][Model Load] 読み込み開始', {
      fileName: file.name,
      fileSizeBytes: file.size,
      fileSizeMB: Number((file.size / 1024 ** 2).toFixed(1)),
      userAgent: navigator.userAgent
    });
    try {
      await engine.load(file, (stage) => {
        setLoadingStage(stage);
        setStatus('モデルを読み込み中：' + stage);
      });
      setLoadedModel(file.name);
      setStatus('モデル読み込み完了');
    } catch (error) {
      console.error('[Local Codex][Model Load] UI側でエラーを検知', error);
      setStatus(error instanceof Error ? error.message : 'モデル読み込みに失敗しました');
      setLoadedModel(null);
    } finally {
      setBusy(false);
      setLoadingStage(null);
      setLoadStartedAt(null);
      console.info('[Local Codex][Model Load] UI処理終了', {
        elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1))
      });
    }
  }

  async function runPrompt(text: string) {
    if (!loadedModel) { setStatus('先にGGUFモデルを読み込んでください'); return; }
    setBusy(true); setOutput(''); setMetrics(null); setStatus('生成中');
    try {
      const result = await engine.generate(text, setOutput);
      setMetrics(result); setStatus('生成完了');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '生成に失敗しました');
    } finally { setBusy(false); }
  }

  function saveBenchmarkResult() {
    if (!metrics) return;
    setResults((current) => [{
      model: loadedModel || 'unknown', task: task.title, timestamp: new Date().toISOString(),
      elapsedMs: metrics.elapsedMs, tokensPerSecond: metrics.tokensPerSecond,
      output, score: Number(score)
    }, ...current]);
  }

  async function unloadModel() {
    setBusy(true);
    try { await engine.unload(); setLoadedModel(null); setFile(null); setStatus('モデルを解放しました'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'モデル解放に失敗しました'); }
    finally { setBusy(false); }
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
          <input className="file-input" type="file" accept=".gguf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          {file && <div className="selected-file">{file.name} · {(file.size / 1024 ** 3).toFixed(2)} GB</div>}
          <button className="primary-button" disabled={!file || busy} onClick={loadModel}>{busy ? '処理中…' : 'このGGUFをiPhone内で読み込む'}</button>
          {loadingStage && <div className="model-loading-panel" role="status" aria-live="polite">
            <div className="loading-heading"><strong>モデルを読み込み中</strong><span>{loadingElapsed}秒経過</span></div>
            <div className="loading-stage">{loadingStage}</div>
            <div className="progress-track" role="progressbar" aria-label="モデル読み込み状況" aria-valuetext="処理中。正確な進捗率は取得できません">
              <div className="progress-indicator" />
            </div>
            <p>このローカルファイル読み込み処理は、wllama側から進捗率が通知されないため、バーは進行中を示す表示だよ。完了・エラーはコンソールにも記録される。</p>
          </div>}
          {loadedModel && <div className="loaded-row"><span>読み込み済み：{loadedModel}</span><button className="text-button" onClick={unloadModel} disabled={busy}>解放</button></div>}
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
          <button className="primary-button" disabled={!loadedModel || busy || !prompt.trim()} onClick={() => runPrompt(prompt)}>{busy ? '生成中…' : 'ローカルモデルで実行'}</button>
        </div>
        {output && <div className="output-card"><div className="card-title-row"><h3>モデル出力</h3>{metrics && <span className="subtle-tag">{(metrics.elapsedMs / 1000).toFixed(1)} sec</span>}</div>
          <pre>{output}</pre>{metrics && <div className="metric-strip"><span>生成時間 <b>{(metrics.elapsedMs / 1000).toFixed(2)}秒</b></span><span>概算chunk/s <b>{metrics.tokensPerSecond?.toFixed(1) ?? '—'}</b></span></div>}
          <label className="field-label" htmlFor="score">手動品質スコア（1〜5）</label>
          <select id="score" value={score} onChange={(event) => setScore(event.target.value)}><option value="1">1 — 要件を満たさない</option><option value="2">2 — 大きな欠落</option><option value="3">3 — 部分的に正しい</option><option value="4">4 — ほぼ正しい</option><option value="5">5 — 正確・完全</option></select>
          <button className="primary-button" onClick={saveBenchmarkResult}>この結果を保存</button>
        </div>}
        <div className="info-card"><h3>保存済み結果</h3>
          {results.length === 0 ? <p className="muted">まだ結果はありません。モデルを読み込んで課題を実行してね。</p> : results.map((result, index) => <div className="result-row" key={result.timestamp + index}>
            <div><strong>{result.model}</strong><span>{result.task} · {new Date(result.timestamp).toLocaleString()}</span></div><div className="result-score">{result.score ?? '—'}/5</div>
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
