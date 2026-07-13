'use server'

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function savePlaybackProgress(videoId: string, seconds: number, is_completed: boolean, total_duration?: number) {
    const supabase = await createClient();
    const user = (await supabase.auth.getUser()).data.user;

    if (!user) {
        return { error: "Not authenticated" };
    }

    // 1. Update Video Duration if provided (Self-correction of DB data)
    // 呼び出し側（VideoPlayer）が「DB 値と実測が乖離した初回のみ」渡す契約。
    // ここで revalidatePath を呼んではならない: 再生中は 5 秒ごとに本アクションが
    // 実行されるため、layout 全体の再検証はサイト全体を継続的に再レンダリングさせる。
    // We use a Service Role client here because regular users don't have UPDATE permission on v_videos
    if (total_duration && total_duration > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const adminClient = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error: updateError } = await adminClient
            .from("v_videos")
            .update({ duration: Math.floor(total_duration) })
            .eq("id", videoId);

        if (updateError) {
            console.error("Error updating video duration:", updateError);
            // Do not return, continue to save playback history
        }
    }

    // 2. Save Playback History
    const payload = {
        user_id: user.id,
        video_id: videoId,
        progress_seconds: Math.floor(seconds),
        is_completed: is_completed,
        last_watched_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from("v_playback_history")
        .upsert(payload, { onConflict: "user_id, video_id" });

    if (error) {
        console.error("Error saving progress:", error);
        return { error: error.message };
    }

    // 完了時のサイドバー更新はクライアント側の router.refresh()（VideoPlayer）が行う。
    // サーバー側の revalidatePath はルーターキャッシュ全体を落とすためここでは使わない。
    return { success: true };
}
