import { createClient } from "@/lib/supabase/server";
import VideoPlayer from "@/components/VideoPlayer";
import { notFound } from "next/navigation";
import { generateStreamToken } from "@/lib/cloudflare/stream";
import { getViewerEntitlement } from "@/lib/entitlement/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ videoSlug: string }>;
}) {
    const { videoSlug } = await params;
    const supabase = await createClient();
    const { data: video } = await supabase
        .from("v_videos")
        .select("title")
        .eq("slug", videoSlug)
        .maybeSingle();
    return { title: video?.title ?? "動画が見つかりません" };
}

export default async function WatchPage({
    params,
}: {
    params: Promise<{ courseSlug: string; videoSlug: string }>;
}) {
    const { courseSlug, videoSlug } = await params;
    const supabase = await createClient();

    const [videoResult, entitlement, courseResult] = await Promise.all([
        supabase
            .from("v_videos")
            .select("id, title, cloudflare_uid, duration, slug")
            .eq("slug", videoSlug)
            .maybeSingle(),
        getViewerEntitlement(),
        supabase
            .from("v_courses")
            .select("id")
            .eq("slug", courseSlug)
            .maybeSingle(),
    ]);

    const video = videoResult.data;
    if (!video || !courseResult.data) return notFound();

    // Round 2: コース内の並びと視聴履歴を並列取得
    const [nodesResult, historyResult] = await Promise.all([
        supabase
            .from("v_course_nodes")
            .select("id, video:v_videos (id, slug)")
            .eq("course_id", courseResult.data.id)
            .order("id", { ascending: true }),
        entitlement.userId
            ? supabase
                .from("v_playback_history")
                .select("progress_seconds, is_completed")
                .eq("user_id", entitlement.userId)
                .eq("video_id", video.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
    ]);
    const nodes = nodesResult.data;
    const currentHistory = historyResult.data;

    const orderedVideos = (nodes || [])
        .map((n: any) => (Array.isArray(n.video) ? n.video[0] : n.video))
        .filter(Boolean);
    const currentIndex = orderedVideos.findIndex((v: any) => v.id === video.id);
    const nextVideo =
        currentIndex !== -1 && currentIndex < orderedVideos.length - 1
            ? orderedVideos[currentIndex + 1]
            : null;
    const nextHref = nextVideo
        ? `/courses/${courseSlug}/watch/${nextVideo.slug}`
        : null;

    const signedToken = entitlement.canWatch
        ? await generateStreamToken(video.cloudflare_uid)
        : null;

    return (
        <>
            <h1 className="text-2xl font-bold mb-2">{video.title}</h1>

            <VideoPlayer
                video={video}
                initialHistory={currentHistory}
                nextHref={nextHref}
                signedToken={signedToken}
                canWatch={entitlement.canWatch}
                isAuthenticated={!!entitlement.userId}
            />

            <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4">この動画について</h2>
                <p className="text-muted-foreground">
                    再生時間: {Math.floor(video.duration / 60)}分{video.duration % 60}秒
                </p>
            </div>
        </>
    );
}
