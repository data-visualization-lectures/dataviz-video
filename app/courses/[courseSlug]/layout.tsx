import { createClient } from "@/lib/supabase/server";
import CourseSidebar from "@/components/CourseSidebar";
import { notFound } from "next/navigation";

// サイドバーを layout に分離することで、コース内の動画切り替え時は
// 動画部分（子ページ）だけが再レンダリングされる。
export default async function CourseLayout({
    params,
    children,
}: {
    params: Promise<{ courseSlug: string }>;
    children: React.ReactNode;
}) {
    const { courseSlug } = await params;
    const supabase = await createClient();

    const [courseResult, sessionResult] = await Promise.all([
        supabase
            .from("v_courses")
            .select("id, title, slug")
            .eq("slug", courseSlug)
            .maybeSingle(),
        supabase.auth.getSession(),
    ]);

    const course = courseResult.data;
    if (!course) return notFound();

    const userId = sessionResult.data.session?.user.id ?? null;

    const { data: nodes } = await supabase
        .from("v_course_nodes")
        .select("id, video:v_videos (id, title, duration, slug)")
        .eq("course_id", course.id)
        .order("id", { ascending: true });

    const videos = (nodes || [])
        .map((n: any) => (Array.isArray(n.video) ? n.video[0] : n.video))
        .filter(Boolean);

    let history: { video_id: string; is_completed: boolean | null; progress_seconds: number | null }[] = [];
    if (userId && videos.length > 0) {
        const { data } = await supabase
            .from("v_playback_history")
            .select("video_id, is_completed, progress_seconds")
            .eq("user_id", userId)
            .in("video_id", videos.map((v: any) => v.id));
        history = data || [];
    }

    const historyByVideo = new Map(history.map((h) => [h.video_id, h]));
    const sidebarVideos = videos.map((v: any) => {
        const h = historyByVideo.get(v.id);
        const duration = v.duration || 0;
        const progress = h?.progress_seconds || 0;
        const percent =
            duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;
        return {
            slug: v.slug,
            title: v.title,
            duration,
            isCompleted: !!h?.is_completed,
            progressPercent: percent,
        };
    });

    return (
        <div className="flex flex-col md:flex-row min-h-screen pt-32">
            <div className="hidden md:block h-[calc(100vh-128px)] sticky top-32 shrink-0">
                <CourseSidebar
                    courseSlug={course.slug}
                    courseTitle={course.title}
                    videos={sidebarVideos}
                />
            </div>
            <div className="flex-grow p-4 md:p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">{children}</div>
            </div>
        </div>
    );
}
