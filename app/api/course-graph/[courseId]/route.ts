import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
    request: Request,
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
            user = devUser as any;
            if (user) {
                console.log("[API Graph] Using Dev User:", user.id);
            }
        }
    }

    console.log(`[API Graph] User: ${user?.id || 'Anonymous'}`);

    // 2. Fetch Course Nodes
    const { data: nodes, error: nodesError } = await supabase
        .from("v_course_nodes")
        .select(`
      id,
      video:v_videos (id, title, duration, thumbnail_url)
    `)
        .eq("course_id", courseId);

    if (nodesError) {
        return NextResponse.json({ error: nodesError.message }, { status: 500 });
    }

    // 3. Fetch Edges associated with these nodes
    // We need edges where BOTH source and target are in our node list
    // Supabase doesn't support complex "OR" filtering easily across relations in one go sometimes,
    // but we can just fetch all edges that match the node IDs.
    // Actually, filtering edges by course indirectly is harder since they don't have course_id.
    // Strategy: Get edges where source_node_id IN (node_ids).

    const nodeIds = nodes.map(n => n.id);

    const { data: edges, error: edgesError } = await supabase
        .from("v_node_edges")
        .select("*")
        .in("source_node_id", nodeIds);
    // Technically we should check target_node_id too to be safe, but usually edges stay within a course.

    if (edgesError) {
        return NextResponse.json({ error: edgesError.message }, { status: 500 });
    }

    // 4. Fetch Playback History for Status Calculation
    let userHistory: any[] = [];
    if (user) {
        const videoIds = nodes.map((n: any) => n.video.id);
        const { data: history } = await supabase
            .from("v_playback_history")
            .select("video_id, is_completed")
            .eq("user_id", user.id)
            .in("video_id", videoIds);
        userHistory = history || [];
    }

    // 5. Calculate Node Status (locked, available, completed)
    // Map of Video ID -> Completed?
    const completedVideoIds = new Set(
        userHistory.filter(h => h.is_completed).map(h => h.video_id)
    );

    // Build a graph in memory to traverse dependencies
    // Map: NodeID -> Array of Parent NodeIDs
    const incomingEdges: Record<string, string[]> = {};
    nodes.forEach(n => { incomingEdges[n.id] = []; });
    edges.forEach(e => {
        if (incomingEdges[e.target_node_id]) {
            incomingEdges[e.target_node_id].push(e.source_node_id);
        }
    });

    // Helper to check if a node is completed
    // We need to map NodeID -> VideoID first
    const nodeToVideo: Record<string, string> = {};
    nodes.forEach((n: any) => { nodeToVideo[n.id] = n.video.id; });

    const isNodeCompleted = (nodeId: string) => {
        const vid = nodeToVideo[nodeId];
        return completedVideoIds.has(vid);
    };

    const formattedNodes = nodes.map((n: any) => {
        const vid = n.video.id;
        const isCompleted = completedVideoIds.has(vid);

        // Check if unlocked: All parents must be completed
        // Locking logic removed per user request. Always unlocked.
        const isUnlocked = true;
        // const parents = incomingEdges[n.id] || [];
        // if (parents.length > 0) {
        //     isUnlocked = parents.every(parentId => isNodeCompleted(parentId));
        // }

        // Status priority: Completed > Available (Unlocked) > Locked
        let status = "available"; // Default to available instead of locked
        if (isCompleted) status = "completed";
        else status = "available"; // No locking

        return {
            id: n.id, // Node ID
            videoId: vid,
            title: n.video.title,
            thumbnail: n.video.thumbnail_url,
            status: status
        };
    });

    const formattedEdges = edges.map(e => ({
        source: e.source_node_id,
        target: e.target_node_id
    }));

    return NextResponse.json({
        nodes: formattedNodes,
        links: formattedEdges
    });
}
