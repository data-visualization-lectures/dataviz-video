# dataviz-video

「データの道具箱」契約者向けの動画教材サイト。本番は `https://video.dataviz.jp`（Vercel、main ブランチから自動デプロイ）。

## 技術スタック

- Next.js (App Router) + Tailwind CSS
- Supabase（プラットフォーム共有インスタンス。`v_courses` / `v_videos` / `v_course_nodes` / `v_node_edges` / `v_playback_history`）
- Cloudflare Stream（署名付き URL で配信）
- 共通認証: `id.data-viz-lectures.com/lib/supabase.v1.js` + `dataviz-auth-client.v1.js`
- 認可判定の正本は dataviz-api（`/api/me` の `accessible_scopes`）。`lib/entitlement/server.ts` 参照

詳細仕様は [_documents/SPECIFICATION.md](./_documents/SPECIFICATION.md)、プロジェクト横断仕様は `_app_core/_documents/` を参照。

## ローカル開発

```bash
npm install
npm run dev
```

- http://localhost:3000/?auth_debug
- http://localhost:3000/courses/openrefine/watch/openrefine-2-basics?auth_debug

`?auth_debug` は共通認証スクリプトの未ログインリダイレクトを抑止するデバッグパラメータ（URL にのみ付ける。env や設定値に入れない）。

localhost では `.dataviz.jp` の cookie が届かないため、未ログイン状態（プレイヤーはロックパネル表示）になるのが正常。契約者としての再生確認は本番 `video.dataviz.jp` で行う。

### 環境変数（.env.local）

| 変数 | 必須 | 説明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | 公開キー（新形式 `sb_publishable_...`） |
| `CLOUDFLARE_KEY_ID` / `CLOUDFLARE_KEY_PEM` | ✅(再生に必要) | Cloudflare Stream 署名トークン発行用 |
| `SUPABASE_SERVICE_ROLE_KEY` | 任意 | `v_videos.duration` の自己修復更新のみに使用 |
| `NEXT_PUBLIC_API_BASE` | 任意 | dataviz-api のベース URL（既定 `https://api.dataviz.jp`） |
| `NEXT_PUBLIC_AUTH_COOKIE_NAME` | 任意 | 既定 `sb-dataviz-auth-token` |

## ブランチ / CI / デプロイ

- 変更は **PR 経由**（CI `ci-video` は PR トリガーのみ。typecheck + build）
- main へのマージで Vercel が本番へ自動デプロイ
- ビルド確認: `npx tsc --noEmit && npm run build`
