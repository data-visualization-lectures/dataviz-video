import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = async () => {
    const cookieStore = await cookies();

    // 必ず公開キーで作成する（RLS 前提）。service role はここでは絶対に使わない。
    // 旧 anon key と新 publishable key の両方の環境変数名を受け付ける。
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
            // Use the shared cookie name
            cookieOptions: {
                name: process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME ?? 'sb-dataviz-auth-token',
            }
        }
    );
};
