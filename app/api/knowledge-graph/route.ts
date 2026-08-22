import { assignKnowledgeNodeStatuses, KNOWLEDGE_LOCK_POLICY } from "@/lib/knowledge-graph";
import type {
    KnowledgeGraphLink,
    KnowledgeGraphNode,
    PlaybackProgress,
} from "@/lib/knowledge-graph";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type RawVideo = {
    id: string;
    title: string;
    slug: string;
    thumbnail_url: string | null;
};

type RawCourse = {
    id: string;
    title: string;
    slug: string;
    sort_order: number | null;
};

type RawNodeRow = {
    id: string;
    course_id: string;
    video: RawVideo | RawVideo[] | null;
    course: RawCourse | RawCourse[] | null;
};

type RawEdgeRow = {
    source_node_id: string;
    target_node_id: string;
};

type RawHistoryRow = {
    video_id: string;
    is_completed: boolean | null;
    progress_seconds: number | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { data: nodesRaw, error: nodesError } = await supabase
        .from("v_course_nodes")
        .select(`
            id,
            course_id,
            video:v_videos (id, title, slug, thumbnail_url),
            course:v_courses (id, title, slug, sort_order)
        `);

    if (nodesError) {
        return NextResponse.json({ error: nodesError.message }, { status: 500 });
    }

    const nodes = ((nodesRaw ?? []) as RawNodeRow[])
        .map((row) => {
            const video = unwrapOne(row.video);
            const course = unwrapOne(row.course);
            if (!video?.id || !video.slug || !course?.id || !course.slug) {
                return null;
            }
            return {
                id: row.id,
                videoId: video.id,
                videoSlug: video.slug,
                title: video.title,
                thumbnail: video.thumbnail_url ?? null,
                courseId: course.id,
                courseSlug: course.slug,
                courseTitle: course.title,
                courseSortOrder: course.sort_order ?? 0,
            };
        })
        .filter((node): node is Omit<KnowledgeGraphNode, "status"> => node !== null);

    if (nodes.length === 0) {
        return NextResponse.json({
            lockPolicy: KNOWLEDGE_LOCK_POLICY,
            nodes: [],
            links: [],
        });
    }

    const nodeIds = nodes.map((node) => node.id);
    const { data: edgesRaw, error: edgesError } = await supabase
        .from("v_node_edges")
        .select("source_node_id, target_node_id")
        .in("source_node_id", nodeIds);

    if (edgesError) {
        return NextResponse.json({ error: edgesError.message }, { status: 500 });
    }

    const nodeIdSet = new Set(nodeIds);
    const links: KnowledgeGraphLink[] = ((edgesRaw ?? []) as RawEdgeRow[])
        .filter(
            (edge) =>
                nodeIdSet.has(edge.source_node_id) &&
                nodeIdSet.has(edge.target_node_id) &&
                edge.source_node_id !== edge.target_node_id
        )
        .map((edge) => ({
            source: edge.source_node_id,
            target: edge.target_node_id,
        }));

    let history: PlaybackProgress[] = [];
    if (user) {
        const videoIds = [...new Set(nodes.map((node) => node.videoId))];
        const { data: historyRaw } = await supabase
            .from("v_playback_history")
            .select("video_id, is_completed, progress_seconds")
            .eq("user_id", user.id)
            .in("video_id", videoIds);

        history = ((historyRaw ?? []) as RawHistoryRow[]).map((row) => ({
            videoId: row.video_id,
            isCompleted: !!row.is_completed,
            progressSeconds: row.progress_seconds ?? 0,
        }));
    }

    const statuses = assignKnowledgeNodeStatuses(nodes, links, history);
    const formattedNodes: KnowledgeGraphNode[] = nodes.map((node) => ({
        ...node,
        status: statuses.get(node.id) ?? "later",
    }));

    return NextResponse.json({
        lockPolicy: KNOWLEDGE_LOCK_POLICY,
        nodes: formattedNodes,
        links,
    });
}
