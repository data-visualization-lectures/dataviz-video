import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const COURSE_LOCK_POLICY = "always_open" as const;

type CourseNodeRow = {
    id: string;
    video: {
        id: string;
        title: string;
        thumbnail_url: string | null;
    };
};

type RawCourseNodeRow = {
    id: string;
    video:
    | {
        id: string;
        title: string;
        thumbnail_url: string | null;
    }
    | {
        id: string;
        title: string;
        thumbnail_url: string | null;
    }[]
    | null;
};

type NodeEdgeRow = {
    source_node_id: string;
    target_node_id: string;
};

type PlaybackHistoryRow = {
    video_id: string;
    is_completed: boolean | null;
};

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ courseId: string }> }
) {
    const { courseId } = await params;
    const supabase = await createClient();

    // 1. Get current user for progress tracking
    let { data: { user } } = await supabase.auth.getUser();

    // DEV MODE: Fallback to test user if not logged in
    if (!user && process.env.NODE_ENV === 'development') {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const devUser = users?.find(u => u.email === "test_dev@dataviz.jp");
        if (devUser) {
            user = devUser;
            console.log("[API Graph] Using Dev User:", user.id);
        }
    }

    console.log(`[API Graph] User: ${user?.id || 'Anonymous'}`);

    // 2. Fetch Course Nodes
    const { data: nodesRaw, error: nodesError } = await supabase
        .from("v_course_nodes")
        .select(`
      id,
      video:v_videos (id, title, duration, thumbnail_url)
    `)
        .eq("course_id", courseId);

    if (nodesError) {
        return NextResponse.json({ error: nodesError.message }, { status: 500 });
    }

    const nodes = ((nodesRaw ?? []) as RawCourseNodeRow[]).map((node) => {
        const video = Array.isArray(node.video) ? node.video[0] : node.video;
        if (!video?.id) return null;

        return {
            id: node.id,
            video: {
                id: video.id,
                title: video.title,
                thumbnail_url: video.thumbnail_url ?? null,
            },
        };
    }).filter(
        (node): node is CourseNodeRow => node !== null
    );

    if (nodes.length === 0) {
        return NextResponse.json({
            lockPolicy: COURSE_LOCK_POLICY,
            nodes: [],
            links: [],
        });
    }

    // 3. Fetch Edges associated with these nodes
    // We need edges where BOTH source and target are in our node list
    // Supabase doesn't support complex "OR" filtering easily across relations in one go sometimes,
    // but we can just fetch all edges that match the node IDs.
    // Actually, filtering edges by course indirectly is harder since they don't have course_id.
    // Strategy: Get edges where source_node_id IN (node_ids).

    const nodeIds = nodes.map(n => n.id);

    const { data: edgesRaw, error: edgesError } = await supabase
        .from("v_node_edges")
        .select("*")
        .in("source_node_id", nodeIds);
    // Technically we should check target_node_id too to be safe, but usually edges stay within a course.

    if (edgesError) {
        return NextResponse.json({ error: edgesError.message }, { status: 500 });
    }

    const edges = (edgesRaw ?? []) as NodeEdgeRow[];

    // 4. Fetch Playback History for Status Calculation
    let userHistory: PlaybackHistoryRow[] = [];
    if (user) {
        const videoIds = nodes.map((n) => n.video.id);
        const { data: history } = await supabase
            .from("v_playback_history")
            .select("video_id, is_completed")
            .eq("user_id", user.id)
            .in("video_id", videoIds);
        userHistory = (history ?? []) as PlaybackHistoryRow[];
    }

    // 5. Calculate Node Status (completed, available)
    // P2-2 仕様固定: 学習パスは常時解放（locked を返さない）
    // Map of Video ID -> Completed?
    const completedVideoIds = new Set(
        userHistory.filter(h => h.is_completed).map(h => h.video_id)
    );

    const formattedNodes = nodes.map((n) => {
        const vid = n.video.id;
        const isCompleted = completedVideoIds.has(vid);

        return {
            id: n.id, // Node ID
            videoId: vid,
            title: n.video.title,
            thumbnail: n.video.thumbnail_url,
            status: isCompleted ? "completed" : "available"
        };
    });

    const formattedEdges = edges.map(e => ({
        source: e.source_node_id,
        target: e.target_node_id
    }));

    return NextResponse.json({
        lockPolicy: COURSE_LOCK_POLICY,
        nodes: formattedNodes,
        links: formattedEdges
    });
}
