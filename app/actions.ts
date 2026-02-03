'use server'

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function savePlaybackProgress(videoId: string, seconds: number, is_completed: boolean, total_duration?: number) {
    const supabase = await createClient();
    let user = (await supabase.auth.getUser()).data.user;

    if (!user) {
        // DEV MODE: Authenticate as a test user automatically if on localhost
        if (process.env.NODE_ENV === 'development') {
            const testEmail = "test_dev@dataviz.jp";
            // Check if test user exists
            // Admin API is needed for createUser, but 'supabase' here is a standard client.
            // We need to upgrade to admin client.
            // Actually, server.ts creates a client. We can use the service role key there.

            // Try enabling "Implicit Auth" for dev:
            // Let's just create a user if not exists using the service role admin API

            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            let devUser = users?.find(u => u.email === testEmail);

            if (!devUser) {
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: testEmail,
                    password: "password123",
                    email_confirm: true
                });
                if (createError) {
                    console.error("Failed to create dev user:", createError);
                    return { error: "Dev Auth Failed" };
                }
                devUser = newUser.user;
            }

            if (devUser) {
                console.log("Using Dev User:", devUser.id);
                user = devUser; // Assign devUser to user variable
            }
        }
    }

    if (!user) {
        // console.error("No user found in savePlaybackProgress. Cookies present:", allCookies.length);
        return { error: "Not authenticated" };
    }

    // 1. Update Video Duration if provided (Self-correction of DB data)
    if (total_duration && total_duration > 0) {
        const { error: updateError } = await supabase.from("v_videos").update({ duration: Math.floor(total_duration) }).eq("id", videoId);
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
