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
- **設定場所**: `lib/supabase/server.ts`（Next.js Server Side）。cookie 契約（domain / sameSite / secure 等）の正本は `_app_core/_documents/セットアップ/CLIENT_INTEGRATION_GUIDE.md`。

### 開発モード (Development Mode)
- 開発用バックドア（`test_dev@dataviz.jp` の自動なりすまし）は 2026-07 に廃止しました。
- 未ログイン時のリダイレクト抑制は、共通認証スクリプト標準の `?auth_debug` を使います。
- ローカルで「契約済みユーザー」として視聴確認する場合は、実セッション Cookie（`sb-dataviz-auth-token`）が必要です。

### 視聴権限（2026-07-12 確定）
- 視聴可否の正本は dataviz-api（`/api/me` の `accessible_scopes`）。本リポジトリでは契約判定ロジックを複製しない。
- `lib/entitlement/server.ts` がサーバー側で `/api/me` を呼び、`accessible_scopes` が非空（viz / prep / bundle / trial 中 / academia / admin / team のいずれか有効）なら視聴可。
- Cloudflare Stream の署名トークンは視聴可の場合のみ発行する（`app/courses/[courseSlug]/watch/[videoSlug]/page.tsx`）。
- 視聴不可の場合もページ自体は表示し、プレイヤー部分をロックパネル（ログイン / プランを見る導線）に差し替える。
- `/api/me` 呼び出し時に `Origin` や `x-dv-app` を送らないこと（service trial の自動開始を防ぐため）。

---

## 3. 学習パス（Learning Path）のロジック

コース詳細画面のグラフ表示 (`LearningPathGraph`) およびノードのステータス判定ロジックについて。

### ステータス判定（2026-04-27確定）
現状の実装では、以下の2状態のみを返します。

1.  **Completed (緑)**: `v_playback_history` テーブルに `is_completed = true` のレコードがある場合。
2.  **Available (青)**: 上記以外すべて。

補足:
- 学習パスは**常時解放**を正式仕様とし、`locked` ステータスは返しません。
- 実装根拠: `app/api/course-graph/[courseId]/route.ts` の `COURSE_LOCK_POLICY = "always_open"`。

---

## 4. デプロイメント要件 (Vercel)

本番環境 (Vercel) で動作させるためには、以下の環境変数が必須です。設定漏れがあると 500 Error でクラッシュします。

| 変数名 | 説明 |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseのプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 公開キー（新形式 `sb_publishable_...`）。旧 `NEXT_PUBLIC_SUPABASE_ANON_KEY` も互換で読む |
| `NEXT_PUBLIC_AUTH_COOKIE_NAME` | (任意) クッキー名を変更する場合のみ指定。デフォルトは `sb-dataviz-auth-token` |
| `NEXT_PUBLIC_API_BASE` | (任意) dataviz-api のベースURL。デフォルトは `https://api.dataviz.jp` |
| `CLOUDFLARE_KEY_ID` / `CLOUDFLARE_KEY_PEM` | Cloudflare Stream 署名トークン発行用 |
| `SUPABASE_SERVICE_ROLE_KEY` | (任意) `v_videos.duration` の自己修復更新にのみ使用。未設定なら duration 更新をスキップ |

> **重要**: サーバー側の通常クエリ（`lib/supabase/server.ts`）は必ず公開キーで実行し RLS を前提とする。service role を通常クエリに使ってはならない（2026-07 に service role フォールバックを撤去済み）。

---

## 5. URL 構造（2026-07-12 確定）

- 正準 URL は `/courses/[courseSlug]/watch/[videoSlug]`（例: `/courses/openrefine/watch/openrefine-2-basics`）。
- `slug` 列は `v_courses`（UNIQUE NOT NULL）と `v_videos`（UNIQUE NOT NULL）に持つ。移行 SQL は `_documents/migrations/2026-07-12_add_slugs.sql`。
- サイドバーはコース layout（`app/courses/[courseSlug]/layout.tsx`）に分離されており、動画切り替え時は動画部分だけが再レンダリングされる。
- 視聴権限（/api/me）はアクセストークン単位で 2 分キャッシュされる（`lib/entitlement/server.ts`）。
- UI コンポーネントは shadcn/ui（radix ベース、`components/ui/`）を使う。
