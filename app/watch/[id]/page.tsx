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

    // Parallel Fetching Round 1: Get Video & Auth User
    const [videoResult, authResult] = await Promise.all([
        supabase.from("v_videos").select("*").eq("id", id).single(),
        supabase.auth.getUser()
    ]);

    const video = videoResult.data;
    const videoError = videoResult.error;
    let user = authResult.data.user;

    // DEV MODE: Fallback to test user if not logged in
    if (!user && process.env.NODE_ENV === 'development') {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const devUser = users?.find(u => u.email === "test_dev@dataviz.jp");
        if (devUser) user = devUser as any;
    }

    if (videoError || !video) {
        console.error("Error fetching video:", videoError);
        return notFound();
    }

    // 2. Identify Course context & details
    // Find which course this video belongs to
    const { data: nodeData } = await supabase
        .from("v_course_nodes")
        .select("course_id")
        .eq("video_id", id)
        .single();

    const courseId = nodeData?.course_id;
    let sidebarVideos: any[] = [];
    let courseTitle = "Course Content";
    let userHistory: any[] = [];
    let currentHistory = null;
    let nextVideoId = null;

    // Parallel Fetching Round 2: Course Content & History
    if (courseId) {
        // We know courseId, so we can fetch title and nodes in parallel
        const [courseResult, nodesResult] = await Promise.all([
            supabase.from("v_courses").select("title").eq("id", courseId).single(),
            supabase.from("v_course_nodes").select(`id, video:v_videos (id, title, duration)`).eq("course_id", courseId)
        ]);

        if (courseResult.data) courseTitle = courseResult.data.title;
        const nodes = nodesResult.data || [];

        // Fetch user history for ALL videos in this course (including current)
        if (user) {
            const videoIds = nodes.map((n: any) => n.video.id);
            const { data: history } = await supabase
                .from("v_playback_history")
                .select("video_id, is_completed, progress_seconds")
                .eq("user_id", user.id)
                .in("video_id", videoIds);
            userHistory = history || [];
        }

        // Calculate Status & Sidebar Data
        const completedVideoIds = new Set(userHistory.filter(h => h.is_completed).map(h => h.video_id));
        const progressMap: Record<string, number> = {};
        userHistory.forEach(h => { progressMap[h.video_id] = h.progress_seconds; });

        sidebarVideos = nodes.map((n: any) => {
            const vid = n.video.id;
            const duration = n.video?.duration || 0;
            const progress = progressMap[vid] || 0;
            const rawPercent = duration > 0 ? (progress / duration) * 100 : 0;
            const percent = Math.min(100, Math.max(0, rawPercent));

            return {
                id: vid,
                title: n.video.title,
                duration: duration,
                isCompleted: completedVideoIds.has(vid),
                isLocked: false,
                progressPercent: percent
            };
        });

        // Current Video History (extract from the already fetched batch)
        const currentHistEntry = userHistory.find(h => h.video_id === id);
        if (currentHistEntry) {
            currentHistory = currentHistEntry;
        }

        // Determine Next Video
        const currentVideoIndex = sidebarVideos.findIndex(v => v.id === id);
        if (currentVideoIndex !== -1 && currentVideoIndex < sidebarVideos.length - 1) {
            nextVideoId = sidebarVideos[currentVideoIndex + 1].id;
        }
    } else {
        // Fallback for standalone video (no course context)
        // Just fetch history for this single video
        if (user) {
            const { data: historyData } = await supabase
                .from("v_playback_history")
                .select("progress_seconds, is_completed")
                .eq("user_id", user.id)
                .eq("video_id", id)
                .single();
            currentHistory = historyData;
        }
    }

    return (
        <div className="flex flex-col md:flex-row min-h-screen pt-32">
            {/* Sidebar (Desktop: Left, Mobile: Top/Hidden) */}
            <div className="hidden md:block h-[calc(100vh-128px)] sticky top-32 shrink-0">
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
