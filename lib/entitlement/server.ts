import { createClient } from "@/lib/supabase/server";

// 認可判定の正本は dataviz-api（/api/me の accessible_scopes）。
// このモジュールは判定結果を参照するだけで、契約状態のロジックを複製しない。
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.dataviz.jp";

export type ViewerEntitlement = {
    userId: string | null;
    /** 有効な契約（accessible_scopes が非空）を持つか */
    canWatch: boolean;
    accessibleScopes: string[];
};

const ANONYMOUS: ViewerEntitlement = {
    userId: null,
    canWatch: false,
    accessibleScopes: [],
};

// 動画切り替えごとの /api/me 往復を避けるため、アクセストークン単位で短期キャッシュする。
// トークン自体が失効すれば別キーになるため、TTL は契約状態の変化への追従時間だけを決める。
const CACHE_TTL_MS = 2 * 60 * 1000;
const entitlementCache = new Map<
    string,
    { expiresAt: number; value: ViewerEntitlement }
>();

export async function getViewerEntitlement(): Promise<ViewerEntitlement> {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        return ANONYMOUS;
    }

    const cached = entitlementCache.get(session.access_token);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    try {
        // Origin / x-dv-app を送らないこと。/api/me はアプリ文脈を検出すると
        // service trial の自動開始を行うため、閲覧ガードから副作用を起こさない。
        const res = await fetch(`${API_BASE}/api/me`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
        });

        if (!res.ok) {
            return { ...ANONYMOUS, userId: session.user.id };
        }

        const me = await res.json();
        const scopes: string[] = Array.isArray(me?.accessible_scopes)
            ? me.accessible_scopes
            : [];

        const value: ViewerEntitlement = {
            userId: session.user.id,
            canWatch: scopes.length > 0,
            accessibleScopes: scopes,
        };

        if (entitlementCache.size > 500) entitlementCache.clear();
        entitlementCache.set(session.access_token, {
            expiresAt: Date.now() + CACHE_TTL_MS,
            value,
        });
        return value;
    } catch (error) {
        console.error("Failed to resolve viewer entitlement:", error);
        return { ...ANONYMOUS, userId: session.user.id };
    }
}
