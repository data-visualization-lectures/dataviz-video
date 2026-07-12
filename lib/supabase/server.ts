import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

const COOKIE_NAME =
    process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME ?? "sb-dataviz-auth-token";

// 共有 cookie の契約は CLIENT_INTEGRATION_GUIDE.md / dataviz-app 実装が正本。
// domain は *.dataviz.jp 上でのみ `.dataviz.jp`（Preview の *.vercel.app や
// localhost では host 限定にする）。
function cookieDomainForHostname(hostname: string | null): string | undefined {
    if (!hostname) return undefined;
    const normalized = hostname.toLowerCase().replace(/:\d+$/, "");
    if (normalized === "dataviz.jp" || normalized.endsWith(".dataviz.jp")) {
        return ".dataviz.jp";
    }
    return undefined;
}

export const createClient = async () => {
    const cookieStore = await cookies();
    const headerStore = await headers();
    const hostname =
        headerStore.get("x-forwarded-host") ?? headerStore.get("host");

    const cookieOptions = {
        domain:
            process.env.NODE_ENV === "development"
                ? undefined
                : cookieDomainForHostname(hostname),
        path: "/",
        sameSite: "none" as const,
        secure: true,
        httpOnly: false,
        name: COOKIE_NAME,
    };

    // 必ず公開キーで作成する（RLS 前提）。service role はここでは絶対に使わない。
    // 旧 anon key と新 publishable key の両方の環境変数名を受け付ける。
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                storageKey: COOKIE_NAME,
            },
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        const { name: _name, ...optionsToSet } = cookieOptions;
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, {
                                ...options,
                                ...optionsToSet,
                            })
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
            cookieOptions,
        }
    );
};
