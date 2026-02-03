import { createClient } from "@/lib/supabase/server";
import VideoPlayer from "@/components/VideoPlayer";
import CourseSidebar from "@/components/CourseSidebar";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function WatchPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Fetch Current Video Details
    const { data: video, error: videoError } = await supabase
        .from("v_videos")
        .select("*")
        .eq("id", id)
        .single();

    if (videoError || !video) {
        console.error("Error fetching video:", videoError);
        return notFound();
    }

    // 2. Identify Course context
    // Find which course this video belongs to (via v_course_nodes)
    const { data: nodeData } = await supabase
        .from("v_course_nodes")
        .select("course_id")
        .eq("video_id", id)
        .single();

    // If not part of a course, treat as standalone (should ideally not happen in this app)
    const courseId = nodeData?.course_id;

    // 3. Fetch Course Videos & Structure
    let sidebarVideos: any[] = [];
    let courseTitle = "Course Content";

    if (courseId) {
        // Fetch course info
        const { data: course } = await supabase
            .from("v_courses")
            .select("title")
            .eq("id", courseId)
            .single();

        if (course) courseTitle = course.title;

        // Fetch all nodes in course
        const { data: nodes } = await supabase
            .from("v_course_nodes")
            .select(`
                id,
                video:v_videos (id, title, duration)
            `)
            .eq("course_id", courseId);

        // Fetch user history for these videos
        // Fetch user history for these videos
        const { data: { user } } = await supabase.auth.getUser();
        let userHistory: any[] = [];
        let userIdToCheck = user?.id;

        // DEV MODE Bypass logic
        // If local dev and no user, try finding test user
        if (!userIdToCheck && process.env.NODE_ENV === 'development') {
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const devUser = users?.find(u => u.email === "test_dev@dataviz.jp");
            if (devUser) userIdToCheck = devUser.id;
        }

        if (userIdToCheck) {
            const videoIds = nodes?.map((n: any) => n.video.id) || [];
            const { data: history } = await supabase
                .from("v_playback_history")
                .select("video_id, is_completed, progress_seconds")
                .eq("user_id", userIdToCheck)
                .in("video_id", videoIds);
            userHistory = history || [];
        }

        // Fetch edges for locking logic
        const nodeIds = nodes?.map((n: any) => n.id) || [];
        const { data: edges } = await supabase
            .from("v_node_edges")
            .select("source_node_id, target_node_id")
            .in("source_node_id", nodeIds);

        // Calculate Status
        const completedVideoIds = new Set(userHistory.filter(h => h.is_completed).map(h => h.video_id));
        const progressMap: Record<string, number> = {};
        userHistory.forEach(h => { progressMap[h.video_id] = h.progress_seconds; });

        // Map NodeID -> VideoID
        const nodeToVideo: Record<string, string> = {};
        nodes?.forEach((n: any) => { nodeToVideo[n.id] = n.video.id; });

        // Build dependencies
        sidebarVideos = nodes?.map((n: any) => {
            const vid = n.video.id;
            // Locking logic removed per user request: "Videos can be viewed in any order"
            const duration = n.video?.duration || 0;
            const progress = progressMap[vid] || 0;
            // Fix: Clamp percentage between 0 and 100 to prevent "900%" display errors
            const rawPercent = duration > 0 ? (progress / duration) * 100 : 0;
            const percent = Math.min(100, Math.max(0, rawPercent));

            // Console log for debugging
            // console.log(`[Debug Progress] ${n.video.title}: Duration=${duration}, Progress=${progress}, Percent=${percent}%`);

            return {
                id: vid,
                title: n.video.title,
                duration: duration,
                isCompleted: completedVideoIds.has(vid),
                isLocked: false, // Always unlocked
                progressPercent: percent
            };
        }) || [];

        // Simple sort by ID or keep DB order? 
        // nodes from DB come in arbitrary order unless sorted.
        // Usually we want a topological sort or sort_order field. 
        // For now, let's just assume we want them somewhat ordered or just use received order.
        // If v_course_nodes has no order, we might need to rely on the graph structure or add a sort_order.
        // Let's sort alphabetically for now as a fallback or just leave as is.
    }

    // 4. Fetch User's Playback History for CURRENT video
    const { data: { user } } = await supabase.auth.getUser();
    let currentHistory = null;
    let userIdForHistory = user?.id;

    // DEV MODE Bypass
    if (!userIdForHistory && process.env.NODE_ENV === 'development') {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const devUser = users?.find(u => u.email === "test_dev@dataviz.jp");
        if (devUser) userIdForHistory = devUser.id;
    }

    if (userIdForHistory) {
        const { data: historyData } = await supabase
            .from("v_playback_history")
            .select("progress_seconds, is_completed")
            .eq("user_id", userIdForHistory)
            .eq("video_id", id)
            .single();
        currentHistory = historyData;
    }

    // 5. Determine Next Video
    const currentVideoIndex = sidebarVideos.findIndex(v => v.id === id);
    let nextVideoId = null;
    if (currentVideoIndex !== -1 && currentVideoIndex < sidebarVideos.length - 1) {
        nextVideoId = sidebarVideos[currentVideoIndex + 1].id;
    }

    return (
        <div className="flex flex-col md:flex-row min-h-screen pt-16">
            {/* Sidebar (Desktop: Left, Mobile: Top/Hidden) */}
            <div className="hidden md:block h-[calc(100vh-64px)] sticky top-16 shrink-0">
                <CourseSidebar
                    courseTitle={courseTitle}
                    videos={sidebarVideos}
                    currentVideoId={id}
                />
            </div>

            {/* Main Content */}
            <div className="flex-grow p-4 md:p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    {/* Mobile Sidebar Toggle could go here */}

                    <h1 className="text-2xl font-bold mb-2">{video.title}</h1>

                    <VideoPlayer
                        video={video}
                        initialHistory={currentHistory}
                        nextVideoId={nextVideoId}
                    />

                    <div className="mt-8">
                        <h2 className="text-xl font-semibold mb-4">About this video</h2>
                        <p className="text-gray-600">
                            {/* Description would go here if we had it in schema */}
                            Duration: {Math.floor(video.duration / 60)} min {video.duration % 60} sec
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
