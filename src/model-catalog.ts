export type ModelStatus = 'primary-test' | 'secondary-test' | 'research-only';
export interface ModelCandidate {
  id: string; name: string; family: string; parameters: string;
  quantization: string; estimatedSize: string; sizeBytes?: number;
  purpose: string; status: ModelStatus; repoUrl: string;
  fileUrl?: string; license: string; notes: string;
}

export const modelCandidates: ModelCandidate[] = [
  {
    id: 'qwen35-2b-q4', name: 'Qwen3.5 2B', family: 'Qwen 3.5', parameters: '2B',
    quantization: 'Q4_K_M', estimatedSize: '約1.3 GB', sizeBytes: 1_310_000_000,
    purpose: '品質とサイズのバランスを取る主力コード生成候補',
    status: 'primary-test',
    repoUrl: 'https://huggingface.co/SoAIHQ/Qwen3.5-2B-GGUF',
    fileUrl: 'https://huggingface.co/SoAIHQ/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
    license: 'Apache-2.0（元モデルの条件を確認）',
    notes: 'Qwen3.5 2BのGGUF変換版。ツール呼び出し・思考モードの有無とwllamaのchat template互換性を実機確認する。'
  },
  {
    id: 'lfm2-26b-q4', name: 'LFM2 2.6B', family: 'Liquid Foundation Models', parameters: '2.6B',
    quantization: 'Q4_K_M', estimatedSize: '約1.56 GB', sizeBytes: 1_560_000_000,
    purpose: '速度・メモリ効率の比較基準', status: 'primary-test',
    repoUrl: 'https://huggingface.co/LiquidAI/LFM2-2.6B-GGUF',
    fileUrl: 'https://huggingface.co/LiquidAI/LFM2-2.6B-GGUF/resolve/main/LFM2-2.6B-Q4_K_M.gguf',
    license: 'LFM Open License（利用条件を要確認）',
    notes: 'コード専用モデルではない。速度の基準として比較し、コーディング品質は別軸で評価する。'
  },
  {
    id: 'qwen35-4b-q4', name: 'Qwen3.5 4B', family: 'Qwen 3.5', parameters: '4B',
    quantization: 'Q4_K_M', estimatedSize: '約2.78 GB（要分割）', sizeBytes: 2_780_000_000,
    purpose: '品質重視の上位候補', status: 'secondary-test',
    repoUrl: 'https://huggingface.co/SoAIHQ/Qwen3.5-4B-GGUF',
    fileUrl: 'https://huggingface.co/SoAIHQ/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf',
    license: 'Apache-2.0（元モデルの条件を確認）',
    notes: '単一GGUFは2GBを超えるため、PCでllama-gguf-splitを使い512MB程度に分割して全パーツを選択する。実機メモリとwllamaのqwen35対応も確認する。'
  },
  {
    id: 'gemma4-e2b-q4', name: 'Gemma 4 E2B', family: 'Gemma 4',
    parameters: '2.3B effective / 5.1B incl. embeddings', quantization: 'Q4_K_M',
    estimatedSize: '約3.11 GB（要分割）', sizeBytes: 3_110_000_000, purpose: 'モバイル向け推論・コーディング能力の比較',
    status: 'secondary-test', repoUrl: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF',
    fileUrl: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf',
    license: 'Gemma Terms of Use（Apache-2.0ではない）',
    notes: '単一GGUFは約3.11GB。PCでllama-gguf-splitを使い512MB程度に分割して全パーツを選択する。Gemma 4アーキテクチャがwllama内蔵llama.cppで動くか、実機で先に確認する。'
  },
  {
    id: 'gemma4-e4b-q4', name: 'Gemma 4 E4B', family: 'Gemma 4',
    parameters: '4.5B effective / 8B incl. embeddings', quantization: 'Q4_K_M',
    estimatedSize: '約4.6 GiB', purpose: 'メモリ上限付近での品質比較',
    status: 'research-only', repoUrl: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF',
    fileUrl: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf',
    license: 'Gemma Terms of Use（Apache-2.0ではない）',
    notes: '最初のiPhone PWA試験ではロード対象にしない。メモリ余裕・分割ロード・熱による速度低下を確認後に判断する。'
  },
  {
    id: 'qwen3-coder-next', name: 'Qwen3-Coder-Next', family: 'Qwen3-Coder',
    parameters: '80B total / 3B active', quantization: 'Q4_K_M',
    estimatedSize: '約48.4 GB', purpose: 'エージェント性能の上限参考・クラウド比較用',
    status: 'research-only', repoUrl: 'https://huggingface.co/Qwen/Qwen3-Coder-Next-GGUF',
    license: 'Apache-2.0',
    notes: 'iPhoneローカルモデルとしては非現実的。将来の無料クラウド候補や品質比較の参考にする。'
  }
];
