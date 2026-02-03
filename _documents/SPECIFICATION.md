# Dataviz Video - システム仕様書 & アーキテクチャ

本ドキュメントは、コードからは読み取りにくい「暗黙の仕様」や「設計判断 (Architecture Decisions)」を記録するものです。
保守・運用や機能追加の際に参照してください。

## 1. 動画メタデータの同期戦略（Hybrid Sync）

動画の「長さ（Duration）」データは、パフォーマンスと正確性を両立させるため、以下のハイブリッド方式を採用しています。

### 仕様
1.  **DB初期値**: `seed_data.sql` や管理画面からの登録時は、**概算値（または仮の値）** を入力します。
2.  **自己修復 (Self-Correction)**: ユーザーが動画を再生 (`VideoPlayer` コンポーネントがロード) したタイミングで、Cloudflare Stream APIから**正確な秒数**を取得します。
3.  **DB更新**: 取得した正確な値を、Server Action (`savePlaybackProgress`) を通じてデータベースの `v_videos.duration` カラムに上書き保存します。

### 運用上の注意
- 「DBの値が実際の動画の長さと少し違う」という状態は正常です。
- 誰か一人でもその動画を再生すれば、自動的に正しい値に修正されます。
- 初期データ投入時に厳密な秒数を調査する必要はありません（おおよその分数でOK）。

---

## 2. 認証とクッキーの取り扱い

本アプリケーションは、既存の認証基盤（Authサイト）と連携するため、特殊なクッキー設定を行っています。

### クッキー仕様
- **Cookie名**: `sb-dataviz-auth-token`
- **共有範囲**: 同一ドメイン（サブドメイン間）で共有されることを想定。
- **設定場所**:
    - `lib/supabase/client.ts`: ブラウザ側での利用
    - `lib/supabase/server.ts`: Next.js Server Sideでの利用（`cookies().get(...)`）

### 開発モード (Development Mode)
- `process.env.NODE_ENV === 'development'` の場合のみ有効なバックドアが存在します。
- 認証クッキーが存在しない場合、自動的に `test_dev@dataviz.jp` という開発用ユーザーとして振る舞い、ログイン画面へのリダイレクトを回避します (`app/api/course-graph` 等)。

---

## 3. 学習パス（Learning Path）のロジック

コース詳細画面のグラフ表示 (`LearningPathGraph`) およびノードのステータス判定ロジックについて。

### ステータス判定
現状の実装では、以下の優先順位でステータスが決まります。

1.  **Completed (緑)**: `v_playback_history` テーブルに `is_completed = true` のレコードがある場合。
2.  **Available (青)**: 上記以外すべて。
3.  **Locked (グレー)**: **無効化中**。
    - *設計判断*: 当初は「前の動画を見ないと次が見れない」ロック機能を想定していましたが、ユーザビリティを考慮し、現在は**全ノードを常に Available** としています。ロックロジックを復活させる場合は `app/api/course-graph/[courseId]/route.ts` 内のコメントアウトを解除してください。

---

## 4. デプロイメント要件 (Vercel)

本番環境 (Vercel) で動作させるためには、以下の環境変数が必須です。設定漏れがあると 500 Error でクラッシュします。

| 変数名 | 説明 |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseのプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | クライアント/サーバー共通で使用するAnon Key |
| `NEXT_PUBLIC_AUTH_COOKIE_NAME` | (任意) クッキー名を変更する場合のみ指定。デフォルトは `sb-dataviz-auth-token` |

> **注意**: `SUPABASE_SERVICE_ROLE_KEY` は現状のユーザー機能では必須ではありませんが、管理者バッチ処理等を実装する場合は必要になります。
