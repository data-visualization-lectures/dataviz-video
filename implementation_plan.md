# システム設計方針と技術スタック：動画サブスクリプションサービス

本ドキュメントは、既存の DatavizJP インフラストラクチャと連携する新しい動画学習サービスの技術スタック案とシステム概要をまとめたものです。

## 1. 推奨技術スタック

| カテゴリ | 技術選択 | 選定理由 |
| :--- | :--- | :--- |
| **フロントエンド** | **Next.js (React)** | Web アプリケーションとして実績があり、モバイルファーストなレスポンシブデザインに最適。Vercel へのデプロイも容易。 |
| **スタイリング** | **Tailwind CSS** | 迅速な UI 開発が可能。クラス名で管理するため、モバイル対応の調整がしやすい。 |
| **認証・DB** | **Supabase** | **既存インスタンスを共有**。`auth.dataviz.jp/lib/` 以下の `dataviz-auth-client.js` と `supabase.js` を利用し、共通ヘッダーと認証状態を同期します。 |
| **動画ホスティング** | **Cloudflare Stream** | HLS エンコード、ストレージ、グローバル配信を一括管理。署名付き URL による会員限定配信が可能で、コストパフォーマンスに優れる。 |
| **決済** | **Stripe** | 顧客・サブスクリプションデータを共有。Supabase Edge Functions または Webhook で連携し、権限管理を行う。 |
| **可視化** | **D3.js** | 「ネットワーク的な視聴順」の可視化に使用。方向性のあるエッジを持つグラフ構造の描画に柔軟に対応可能。 |

## 2. システム概要

### コアコンセプトと統合
新サービスは独立したフロントエンドアプリケーションとして構築しますが、バックエンド（Supabase）は既存の可視化ツールと共有します。特に `subscriptions` テーブルを共通化することで、将来的なバンドルプランなどのクロスサービス展開を可能にします。

### データフローとアーキテクチャ

1.  **認証 (Authentication)**:
    - 既存の `dataviz-auth-client.js` と `supabase.js` を読み込みます。
    - 共通ヘッダー（`<dataviz-tool-header>`）を表示し、既存ツールと同様のログイン体験を提供します。
    - **未ログインユーザーはリダイレクトさせますが、テスト容易性のため URL パラメータに `/?auth_debug` がある場合はリダイレクトを無効化します。**
2.  **アクセス制御 (Access Control)**:
    - アプリケーションは `subscriptions` テーブルを参照し、有効なステータス（`public.subscription_status`）か確認します。
    - 有効であれば、動画コンテンツへのアクセスを許可します。
3.  **動画再生 (Video Playback)**:
    - フロントエンドが動画をリクエストします。
    - バックエンド（Supabase Edge Function）が Cloudflare Stream 用の **署名付きトークン** を発行します。
    - プレイヤー（Cloudflare Stream Player）がトークンを使用して動画を読み込みます。
4.  **視聴進捗 (Progress Tracking)**:
    - プレイヤーがイベント（再生時間更新、完了）を発火させます。
    - アプリケーションが進捗状況を Supabase の `v_playback_history` テーブルに保存します。**（`user_id` ごとに保存され、視聴完了フラグ `is_completed` も管理します）**

### スキーマ拡張 (Supabase への新規追加テーブル案)

動画機能を実現しつつ、ユーザーデータを共有するために以下のテーブルを追加します。

*   **`v_videos`**: `id`, `title`, `cloudflare_uid`, `duration`, `thumbnail_url`
*   **`v_courses`**: `id`, `title`, `description`, `sort_order` (表示順序)
*   **`v_course_nodes`**: `id`, `course_id`, `video_id` (ノード定義)
*   **`v_node_edges`**: `source_node_id`, `target_node_id` (視聴順序の定義。1つのsourceに対して複数のtargetが存在し得る＝分岐視聴が可能)
*   **`v_playback_history`**: `user_id`, `video_id`, `progress_seconds`, `is_completed`, `last_watched_at`

## 3. 実装ステップ (概略)

1.  **セットアップ**: Next.js プロジェクトの作成。既存の Supabase プロジェクトへの接続設定。
2.  **認証**: `dataviz-auth-client.js` 等の共通スクリプトを導入し、共通ヘッダーの実装。`/?auth_debug` によるリダイレクト回避の実装。
3.  **動画基盤**: Cloudflare Stream アカウント設定。`videos` テーブル作成。テスト動画のアップロード。
4.  **UI/UX**:
    - 「ネットワークビュー」の構築（D3.js を使用した有向グラフ表示）。
    - 視聴進捗を保存する「プレイヤービュー」の構築（視聴完了フラグの連動）。
5.  **統合**: Stripe のサブスクリプション状態とコンテンツアクセスの連携。
