-- 1. Insert Sample Videos
-- Note: 'cloudflare_uid' are dummy values. In production, these come from Cloudflare Stream.
INSERT INTO public.v_videos (id, title, cloudflare_uid, duration, thumbnail_url)
VALUES
    ('11111111-1111-4111-a111-111111111111', 'イントロダクション: データ可視化とは', 'uid_intro_123', 596, 'https://placehold.co/600x400?text=Intro'), -- BigBuckBunny approx
    ('22222222-2222-4222-a222-222222222222', '基本編: 棒グラフの作り方', 'uid_bar_456', 653, 'https://placehold.co/600x400?text=BarChart'), -- ElephantsDream approx
    ('33333333-3333-4333-a333-333333333333', '基本編: 折れ線グラフの作り方', 'uid_line_789', 596, 'https://placehold.co/600x400?text=LineChart'),
    ('44444444-4444-4444-a444-444444444444', '応用編: 複合グラフのデザイン', 'uid_combo_012', 653, 'https://placehold.co/600x400?text=ComboChart'),
    ('55555555-5555-4555-a555-555555555555', '実践編: ダッシュボード構築', 'uid_dash_345', 596, 'https://placehold.co/600x400?text=Dashboard');

-- 2. Insert Sample Course
INSERT INTO public.v_courses (id, title, description, sort_order)
VALUES
    ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', 'データ可視化入門コース', '初心者向けの基礎から応用まで学べるコースです。', 1);

-- 3. Insert Course Nodes (Connecting Videos to Course)
-- We map the course to the videos created above.
INSERT INTO public.v_course_nodes (id, course_id, video_id)
VALUES
    ('b1111111-1111-4111-b111-111111111111', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '11111111-1111-4111-a111-111111111111'), -- Node for Intro
    ('b2222222-2222-4222-b222-222222222222', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '22222222-2222-4222-a222-222222222222'), -- Node for Bar
    ('b3333333-3333-4333-b333-333333333333', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '33333333-3333-4333-a333-333333333333'), -- Node for Line
    ('b4444444-4444-4444-b444-444444444444', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-a444-444444444444'), -- Node for Combo
    ('b5555555-5555-4555-b555-555555555555', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', '55555555-5555-4555-a555-555555555555'); -- Node for Dashboard

-- 4. Insert Node Edges (Defining the Flow)
INSERT INTO public.v_node_edges (source_node_id, target_node_id)
VALUES
    ('b1111111-1111-4111-b111-111111111111', 'b2222222-2222-4222-b222-222222222222'), -- Intro -> Bar
    ('b1111111-1111-4111-b111-111111111111', 'b3333333-3333-4333-b333-333333333333'), -- Intro -> Line (Branch)
    ('b2222222-2222-4222-b222-222222222222', 'b4444444-4444-4444-b444-444444444444'), -- Bar -> Combo
    ('b3333333-3333-4333-b333-333333333333', 'b4444444-4444-4444-b444-444444444444'), -- Line -> Combo (Merge)
    ('b4444444-4444-4444-b444-444444444444', 'b5555555-5555-4555-b555-555555555555'); -- Combo -> Dashboard

-- 5. Insert OpenRefine Course (Real Cloudflare Data)
INSERT INTO public.v_courses (id, title, description, sort_order)
VALUES
    ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'OpenRefine 実践コース', 'データクレンジングツール OpenRefine の使い方を実践的に学びます。', 2);

-- 6. Insert OpenRefine Videos
INSERT INTO public.v_videos (id, title, cloudflare_uid, duration, thumbnail_url)
VALUES
    ('c1111111-1111-4111-c111-111111111111', 'OpenRefine 1: 導入', '35394fe7ae6ded4c707d6eb49e910906', 600, 'https://placehold.co/600x400?text=OpenRefine+1'),
    ('c2222222-2222-4222-c222-222222222222', 'OpenRefine 2: 基本操作', '7fa9c1146a3a9a2afbe9a25a5eb9dc7d', 600, 'https://placehold.co/600x400?text=OpenRefine+2'),
    ('c3333333-3333-4333-c333-333333333333', 'OpenRefine 3: フィルタリング', 'ecff2b5298222b089ff3b7b663d0ffc6', 600, 'https://placehold.co/600x400?text=OpenRefine+3'),
    ('c4444444-4444-4444-c444-444444444444', 'OpenRefine 4: 文字列変換', 'fe13743d55642e41a68defb5f348b745', 600, 'https://placehold.co/600x400?text=OpenRefine+4'),
    ('c5555555-5555-4555-c555-555555555555', 'OpenRefine 5: データ分割', '1bf2a88821e4c0f72bb63d796e282ff9', 600, 'https://placehold.co/600x400?text=OpenRefine+5'),
    ('c6666666-6666-4666-c666-666666666666', 'OpenRefine 6: 結合', 'f6ccf29fee076ff6e5e7900d2e569339', 600, 'https://placehold.co/600x400?text=OpenRefine+6'),
    ('c7777777-7777-4777-c777-777777777777', 'OpenRefine 7: 高度な変換', 'ae67b25f2c3feb092a1fceea52efb230', 600, 'https://placehold.co/600x400?text=OpenRefine+7'),
    ('c8888888-8888-4888-c888-888888888888', 'OpenRefine 8: エクスポート', 'b46e8c53c404157956c3f793833e1a9c', 600, 'https://placehold.co/600x400?text=OpenRefine+8');

-- 7. Insert OpenRefine Nodes
INSERT INTO public.v_course_nodes (id, course_id, video_id)
VALUES
    ('d1111111-1111-4111-d111-111111111111', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c1111111-1111-4111-c111-111111111111'),
    ('d2222222-2222-4222-d222-222222222222', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c2222222-2222-4222-c222-222222222222'),
    ('d3333333-3333-4333-d333-333333333333', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c3333333-3333-4333-c333-333333333333'),
    ('d4444444-4444-4444-d444-444444444444', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c4444444-4444-4444-c444-444444444444'),
    ('d5555555-5555-4555-d555-555555555555', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c5555555-5555-4555-c555-555555555555'),
    ('d6666666-6666-4666-d666-666666666666', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c6666666-6666-4666-c666-666666666666'),
    ('d7777777-7777-4777-d777-777777777777', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c7777777-7777-4777-c777-777777777777'),
    ('d8888888-8888-4888-d888-888888888888', 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', 'c8888888-8888-4888-c888-888888888888');

-- 8. Insert OpenRefine Edges (Linear for now)
INSERT INTO public.v_node_edges (source_node_id, target_node_id)
VALUES
    ('d1111111-1111-4111-d111-111111111111', 'd2222222-2222-4222-d222-222222222222'),
    ('d2222222-2222-4222-d222-222222222222', 'd3333333-3333-4333-d333-333333333333'),
    ('d3333333-3333-4333-d333-333333333333', 'd4444444-4444-4444-d444-444444444444'),
    ('d4444444-4444-4444-d444-444444444444', 'd5555555-5555-4555-d555-555555555555'),
    ('d5555555-5555-4555-d555-555555555555', 'd6666666-6666-4666-d666-666666666666'),
    ('d6666666-6666-4666-d666-666666666666', 'd7777777-7777-4777-d777-777777777777'),
    ('d7777777-7777-4777-d777-777777777777', 'd8888888-8888-4888-d888-888888888888');
