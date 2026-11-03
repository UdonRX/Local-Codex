export interface BenchmarkTask {
  id: string; title: string; category: string;
  difficulty: 'easy' | 'medium' | 'hard'; prompt: string; rubric: string[];
}

export const benchmarkTasks: BenchmarkTask[] = [
  {
    id: 'ts-bugfix-01', title: 'TypeScriptの境界値バグ修正',
    category: 'Bug fixing', difficulty: 'easy',
    prompt: `次のTypeScript関数にはバグがあります。仕様を満たす修正版の関数だけを出力し、最後に境界値テストを5件示してください。

仕様:
- 有効なTCPポート番号は整数の1〜65535
- 空文字、空白、NaN、小数、0、65536、負数は無効
- 文字列の数字は前後の空白を除去してから判定
- 無効な場合は null を返す

コード:
function parsePort(value: string | number): number | null {
  const port = Number(value);
  return port ? port : null;
}`,
    rubric: ['整数判定がある', '1〜65535の範囲判定がある', '空文字・空白を拒否する', '数値文字列を扱える', 'テストが仕様を網羅する']
  },
  {
    id: 'ts-security-02', title: 'パストラバーサル対策',
    category: 'Security', difficulty: 'medium',
    prompt: `Node.js / TypeScriptで、rootディレクトリ配下の相対パスを安全に解決する関数 safeResolve(root: string, input: string): string を実装してください。

要件:
- path.resolve と path.relative を使う
- root外へ出るパスを拒否する
- 絶対パス入力を拒否する
- Windows形式の区切り文字も考慮する
- NUL文字を拒否する
- symlinkによる脱出はこの関数だけでは完全防止できないことを説明する

コードと、正常系・異常系のテスト例を出してください。`,
    rubric: ['絶対パス拒否', 'path.relativeによるroot境界検査', 'NUL文字拒否', 'Windows区切り文字への配慮', 'symlinkの限界を明記']
  },
  {
    id: 'ts-async-03', title: 'AbortSignal対応リトライ',
    category: 'Implementation', difficulty: 'medium',
    prompt: `TypeScriptで汎用 retry<T>(operation, options) を実装してください。

要件:
- maxAttempts、baseDelayMs、maxDelayMsを指定可能
- 指数バックオフ
- AbortSignal対応
- Abort後は待機を即時解除
- 最終失敗時は最後のエラーをthrow
- 成功時はTを返す
- タイマーを確実に解除する

実装と、成功・再試行・Abortのテスト例を出してください。`,
    rubric: ['指数バックオフ', 'AbortSignal', 'Abort時の待機解除', 'タイマー解除', '最後のエラーを保持']
  },
  {
    id: 'repo-plan-04', title: '複数ファイル変更計画',
    category: 'Agent planning', difficulty: 'hard',
    prompt: `次の要求を実装するCoding Agentの作業計画を作ってください。

要求: GitHubリポジトリのファイルを複数編集する。AIが編集計画を作り、変更差分をユーザーが確認してから、1つのコミットとしてブランチへ反映する。

出力:
1. 必要なモジュール
2. データフロー
3. 競合・失敗ケース
4. セキュリティ対策
5. テスト項目
6. 最小実装順

コードを書き始めず、実装計画に限定してください。`,
    rubric: ['計画と実行の分離', '差分の事前承認', '競合検出', '秘密情報の保護', '単一コミットの一貫性']
  }
];
