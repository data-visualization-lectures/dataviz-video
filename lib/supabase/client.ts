import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
    createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookieOptions: {
                name: process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME ?? 'sb-dataviz-auth-token',
            }
        }
    );
