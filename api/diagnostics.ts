type DiagnosticRequest = {
  method?: string;
  body?: unknown;
};

type DiagnosticResponse = {
  status: (code: number) => DiagnosticResponse;
  json: (body: unknown) => void;
};

const allowedEvents = new Set([
  'load_started',
  'phase',
  'heartbeat',
  'wllama_log',
  'worker_error',
  'worker_messageerror',
  'worker_signal_abort',
  'worker_task_error',
  'worker_message_hook_unavailable',
  'runtime_resources_selected',
  'compat_wasm_preflight_started',
  'compat_wasm_preflight_success',
  'compat_wasm_preflight_failed',
  'compat_worker_source_ready',
  'worker_runtime_selected',
  'worker_runtime_inspection_failed',
  'wasm_load_requested',
  'window_error',
  'unhandled_rejection',
  'load_success',
  'load_failed',
  'load_cleanup'
]);

export default function handler(req: DiagnosticRequest, res: DiagnosticResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  let body: unknown = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ ok: false, error: 'Invalid JSON' }); }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, error: 'Invalid payload' });
  }

  const input = body as Record<string, unknown>;
  const event = typeof input.event === 'string' ? input.event : '';
  const runId = typeof input.runId === 'string' ? input.runId.slice(0, 80) : '';
  const fileName = typeof input.fileName === 'string' ? input.fileName.slice(0, 180) : '';
  const fileSizeBytes = typeof input.fileSizeBytes === 'number' ? input.fileSizeBytes : null;

  if (!allowedEvents.has(event) || !runId || !fileName || fileSizeBytes === null || fileSizeBytes < 0) {
    return res.status(400).json({ ok: false, error: 'Invalid diagnostic fields' });
  }

  const record = {
    source: 'local-codex-client',
    runId,
    event,
    timestamp: typeof input.timestamp === 'string' ? input.timestamp : new Date().toISOString(),
    fileName,
    fileSizeBytes,
    phase: typeof input.phase === 'string' ? input.phase.slice(0, 120) : undefined,
    elapsedSeconds: typeof input.elapsedSeconds === 'number' ? input.elapsedSeconds : undefined,
    phaseElapsedSeconds: typeof input.phaseElapsedSeconds === 'number' ? input.phaseElapsedSeconds : undefined,
    payload: input
  };

  const serialized = JSON.stringify(record);
  if (serialized.length > 24000) {
    return res.status(413).json({ ok: false, error: 'Diagnostic payload too large' });
  }

  // This appears in Vercel Project > Logs (Runtime Logs), not deployment build logs.
  console.log('[LOCAL-CODEX-DIAG] ' + serialized);
  return res.status(200).json({ ok: true });
}
