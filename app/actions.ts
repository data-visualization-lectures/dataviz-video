'use server'

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function savePlaybackProgress(videoId: string, seconds: number, is_completed: boolean, total_duration?: number) {
    const supabase = await createClient();
    const user = (await supabase.auth.getUser()).data.user;

    if (!user) {
        return { error: "Not authenticated" };
    }

    // 1. Update Video Duration if provided (Self-correction of DB data)
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
        } else {
            // Force revalidation so the UI shows the correct duration immediately
            revalidatePath("/", "layout");
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

    // We might want to revalidate on completion too, to update the sidebar checkmark
    if (is_completed) {
        revalidatePath("/", "layout");
    }

    return { success: true };
}
