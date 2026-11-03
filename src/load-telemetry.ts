type DiagnosticPayload = {
  runId: string;
  event: string;
  timestamp: string;
  fileName: string;
  fileSizeBytes: number;
  [key: string]: unknown;
};

export function createLoadDiagnosticReporter(fileName: string, fileSizeBytes: number) {
  const runId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `lc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return (event: string, details: Record<string, unknown> = {}) => {
    const payload: DiagnosticPayload = {
      runId,
      event,
      timestamp: new Date().toISOString(),
      fileName,
      fileSizeBytes,
      ...details
    };

    // Never wait for telemetry: diagnostics must not block model loading.
    void fetch('/api/diagnostics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      cache: 'no-store'
    }).then((response) => {
      if (!response.ok) console.warn('[Local Codex][Remote Diagnosis] Vercelへの送信失敗', response.status);
    }).catch((error) => {
      console.warn('[Local Codex][Remote Diagnosis] Vercelへ接続できません', error);
    });
  };
}
