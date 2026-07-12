-- パーマリンクのスラッグ化（/courses/[courseSlug]/watch/[videoSlug]）
-- 適用先: 共有 Supabase プロジェクト vebhoeiltxspsurqoxvl
-- 1) 列追加 → 2) 既存データの backfill → 3) NOT NULL + UNIQUE 制約

-- 1) 列追加
ALTER TABLE public.v_courses ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.v_videos  ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2) backfill（現行の seed / 本番データ）
UPDATE public.v_courses SET slug = 'data-viz-intro' WHERE id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
UPDATE public.v_courses SET slug = 'openrefine'     WHERE id = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

UPDATE public.v_videos SET slug = 'introduction' WHERE id = '11111111-1111-4111-a111-111111111111';
UPDATE public.v_videos SET slug = 'bar-chart'    WHERE id = '22222222-2222-4222-a222-222222222222';
UPDATE public.v_videos SET slug = 'line-chart'   WHERE id = '33333333-3333-4333-a333-333333333333';
UPDATE public.v_videos SET slug = 'combo-chart'  WHERE id = '44444444-4444-4444-a444-444444444444';
UPDATE public.v_videos SET slug = 'dashboard'    WHERE id = '55555555-5555-4555-a555-555555555555';

UPDATE public.v_videos SET slug = 'openrefine-1-intro'          WHERE id = 'c1111111-1111-4111-c111-111111111111';
UPDATE public.v_videos SET slug = 'openrefine-2-basics'         WHERE id = 'c2222222-2222-4222-c222-222222222222';
UPDATE public.v_videos SET slug = 'openrefine-3-filtering'      WHERE id = 'c3333333-3333-4333-c333-333333333333';
UPDATE public.v_videos SET slug = 'openrefine-4-text-transform' WHERE id = 'c4444444-4444-4444-c444-444444444444';
UPDATE public.v_videos SET slug = 'openrefine-5-splitting'      WHERE id = 'c5555555-5555-4555-c555-555555555555';
UPDATE public.v_videos SET slug = 'openrefine-6-joining'        WHERE id = 'c6666666-6666-4666-c666-666666666666';
UPDATE public.v_videos SET slug = 'openrefine-7-advanced'       WHERE id = 'c7777777-7777-4777-c777-777777777777';
UPDATE public.v_videos SET slug = 'openrefine-8-export'         WHERE id = 'c8888888-8888-4888-c888-888888888888';

-- 3) 制約（backfill 後に実行）
ALTER TABLE public.v_courses ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.v_videos  ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.v_courses ADD CONSTRAINT v_courses_slug_key UNIQUE (slug);
ALTER TABLE public.v_videos  ADD CONSTRAINT v_videos_slug_key  UNIQUE (slug);
