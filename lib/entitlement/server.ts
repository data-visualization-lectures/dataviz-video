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

export async function getViewerEntitlement(): Promise<ViewerEntitlement> {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        return ANONYMOUS;
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

        return {
            userId: session.user.id,
            canWatch: scopes.length > 0,
            accessibleScopes: scopes,
        };
    } catch (error) {
        console.error("Failed to resolve viewer entitlement:", error);
        return { ...ANONYMOUS, userId: session.user.id };
    }
}
