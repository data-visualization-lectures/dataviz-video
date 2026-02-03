// Imports removed for browser usage


// ---- 設定 ----
const SUPABASE_URL = "https://vebhoeiltxspsurqoxvl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlYmhvZWlsdHhzcHN1cnFveHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAyMjI2MTIsImV4cCI6MjA0NTc5ODYxMn0.sV-Xf6wP_m46D_q-XN0oZfK9NogDqD9xV5sS-n6J8c4"; // 公開OKなAnon Key
const API_BASE_URL = "https://api.dataviz.jp"; // ユーザープロファイルAPIなど
const AUTH_APP_URL = "https://auth.dataviz.jp"; // ログイン画面

// ガイドに従った固定クッキー名
const AUTH_COOKIE_NAME = "sb-dataviz-auth-token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1年
const NO_SESSION_REDIRECT_DELAY_MS = 5000; // 未ログイン確定までの猶予
const PROFILE_RETRY_COUNT = 2; // /api/me の再試行回数
const PROFILE_RETRY_DELAYS_MS = [1000, 2000]; // 再試行間隔

/**
 * クッキー操作ヘルパー
 */
const COOKIE_DOMAIN = (() => {
  const hostname = window.location.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/)
  ) {
    return null;
  }
  return ".dataviz.jp";
})();

const cookieStorage = {
  getItem: (key) => {
    const cookies = document.cookie
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean);

    // Separate cookies into a map for easier lookup
    const cookieMap = {};
    for (const c of cookies) {
      const [k, ...rest] = c.split("=");
      cookieMap[k] = rest.join("=");
    }

    let combinedValue = null;

    if (cookieMap[key]) {
      combinedValue = decodeURIComponent(cookieMap[key]);
    } else if (cookieMap[`${key}.0`]) {
      let chunks = [];
      let i = 0;
      while (cookieMap[`${key}.${i}`]) {
        chunks.push(decodeURIComponent(cookieMap[`${key}.${i}`]));
        i++;
      }
      combinedValue = chunks.join("");
    }

    if (!combinedValue) return null;

    // Helper to decode base64 securely including Unicode
    const safeBase64Decode = (str) => {
      try {
        // Try Unicode-safe decode first
        return decodeURIComponent(escape(atob(str)));
      } catch (e) {
        try {
          // Fallback to standard decode
          return atob(str);
        } catch (e2) {
          return null;
        }
      }
    };

    try { return JSON.parse(combinedValue); } catch (e) { }
    try {
      let toDecode = combinedValue.startsWith('base64-') ? combinedValue.slice(7) : combinedValue;
      const base64Standard = toDecode.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = safeBase64Decode(base64Standard);
      return decoded ? JSON.parse(decoded) : null;
    } catch (e) { return null; }
  },
  setItem: (key, value) => {
    // Clear old data (both base key and potential chunks) first to avoid stale fragments
    cookieStorage.removeItem(key);

    let encoded;
    try {
      // Use Unicode-safe base64 encoding
      encoded = btoa(unescape(encodeURIComponent(value)));
    } catch (e) {
      return;
    }

    // Use a safe chunk size (approx 3KB) to stay well under the 4KB limit including headers/domain
    const CHUNK_SIZE = 3000;
    if (encoded.length <= CHUNK_SIZE) {
      let cookieStr = `${key}=${encoded}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=None; Secure`;
      if (COOKIE_DOMAIN) cookieStr += `; Domain=${COOKIE_DOMAIN}`;
      document.cookie = cookieStr;
    } else {
      for (let i = 0; i * CHUNK_SIZE < encoded.length; i++) {
        const chunk = encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        let cookieStr = `${key}.${i}=${chunk}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=None; Secure`;
        if (COOKIE_DOMAIN) cookieStr += `; Domain=${COOKIE_DOMAIN}`;
        document.cookie = cookieStr;
      }
    }
  },
  removeItem: (key) => {
    const removeSpecific = (k) => {
      let cookieStr = `${k}=; Max-Age=0; Path=/; SameSite=None; Secure`;
      if (COOKIE_DOMAIN) cookieStr += `; Domain=${COOKIE_DOMAIN}`;
      document.cookie = cookieStr;
    };

    // Remove the base key
    removeSpecific(key);

    // Also remove any existing chunks
    const cookies = document.cookie.split(";").map(c => c.trim().split("=")[0]);
    for (const k of cookies) {
      if (k.startsWith(`${key}.`)) {
        const suffix = k.substring(key.length + 1);
        if (/^\d+$/.test(suffix)) {
          removeSpecific(k);
        }
      }
    }
  },
};

// ---- Supabase クライアント作成 ----
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: cookieStorage,
    storageKey: AUTH_COOKIE_NAME,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}) : null;
// 外部公開（リファクタリング対応）
if (supabase) {
  window.datavizSupabase = supabase;
}


// =========================================================================
// UI Component: 共通ヘッダー (Web Component Standard)
// =========================================================================
class DatavizGlobalHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = {
      isLoading: true,
      user: null,
      error: null
    };
  }

  connectedCallback() {
    this.render();
  }

  updateState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  // スタイル定義
  getStyles() {
    return `
      :host {
        all: initial; /* 親スタイルの影響をリセット */
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 99999;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
      }
      .dv-header {
        background-color: #111;
        color: #ddd;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        font-size: 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      }
      .dv-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .dv-brand {
        font-weight: 700;
        color: #fff;
        text-decoration: none;
        letter-spacing: 0.5px;
      }
      .dv-right {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .dv-user-info {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #aaa;
      }
      .dv-user-email {
        white-space: nowrap;
        color: inherit;
        text-decoration: none;
        cursor: pointer;
      }
      .dv-user-email:hover {
        color: #fff;
        text-decoration: underline;
      }
      .dv-btn {
        background: transparent;
        border: 1px solid #444;
        color: #eee;
        padding: 4px 10px;
        border-radius: 4px;
        text-decoration: none;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
      }
      .dv-btn:hover {
        background: #333;
        border-color: #666;
        color: #fff;
      }
      .dv-btn-primary {
        background: #eee;
        color: #111;
        border-color: #eee;
        font-weight: 600;
      }
      .dv-btn-primary:hover {
        background: #fff;
        color: #000;
      }
      .dv-loading {
        opacity: 0.5;
        font-size: 12px;
      }
      /* Mobile Optimizations */
      @media (max-width: 600px) {
        .dv-user-email { display: none; }
      }
    `;
  }

  render() {
    const { isLoading, user, error } = this.state;

    // アカウントページのURL
    const accountUrl = `${AUTH_APP_URL}/account`;
    const loginUrl = `${AUTH_APP_URL}/auth/login?redirect_to=${encodeURIComponent(window.location.href)}`;

    let rightContent = '';

    if (isLoading) {
      rightContent = `<span class="dv-loading">Loading...</span>`;
    } else if (error) {
      rightContent = `<span class="dv-loading">${error}</span>`;
    } else if (user) {
      const email = user.email || 'User';
      rightContent = `
        <div class="dv-user-info">
          <a href="${accountUrl}" class="dv-user-email" title="${email}">${email}</a>
        </div>
        <button class="dv-btn" id="dv-logout-btn">Log out</button>
      `;
    } else {
      rightContent = `
        <span style="font-size:12px; color:#888;">Not logged in</span>
        <a href="${loginUrl}" class="dv-btn dv-btn-primary">Log in</a>
      `;
    }

    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="dv-header">
        <div class="dv-left">
          <a href="${AUTH_APP_URL}" class="dv-brand">dataviz.jp</a>
        </div>
        <div class="dv-right">
          ${rightContent}
        </div>
      </div>
    `;

    // イベントリスナーの再結合 (Shadow DOM再描画後)
    const logoutBtn = this.shadowRoot.getElementById('dv-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('ログアウトしますか？')) {
          await supabase.auth.signOut();
          window.location.reload();
        }
      });
    }
  }
}
customElements.define('dataviz-header', DatavizGlobalHeader);


// =========================================================================
// Logic: 認証・認可ロジック
// =========================================================================

function isAuthDebugMode() {
  const params = new URLSearchParams(window.location.search);
  return params.has("auth_debug");
}

function performRedirect(url, reason) {
  if (isAuthDebugMode()) {
    console.warn(`[dataviz-auth-client] Redirect suppressed. Reason: ${reason} -> ${url}`);
    return;
  }
  window.location.href = url;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ユーザー状態検証
 * @returns UserProfile object OR null (if unauthenticated/invalid)
 */
async function verifyUserAccess(session) {
  if (!session) {
    // 公開モード（ショーケース）の場合はリダイレクトしない
    if (window.DATAVIZ_HEADER_CONFIG && window.DATAVIZ_HEADER_CONFIG.mode === 'public') {
      return null;
    }

    const redirectTo = encodeURIComponent(window.location.href);
    const signUpUrl = `${AUTH_APP_URL}/auth/sign-up?redirect_to=${redirectTo}`;
    performRedirect(signUpUrl, 'Unauthenticated');
    return null;
  }

  try {
    let lastError = null;
    for (let attempt = 0; attempt <= PROFILE_RETRY_COUNT; attempt++) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          credentials: "include", // Cookie送信
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);

        const profile = await res.json();
        lastError = null;

        // サブスクチェック
        const sub = profile.subscription || {};
        const status = sub.status || "none";

        // 「キャンセル済みだが期間内」は cancel_at_period_end で判断
        const isCanceledButValid = sub.cancel_at_period_end;

        const isActive = status === "active" || status === "trialing" || isCanceledButValid;

        if (!isActive) {
          // 公開モードなら期限切れでもスルー（ただしログインユーザーとしては扱うか、あるいはnullにするか）
          // ここでは「ログイン済みだが権限なし」としてスルーして、UI側でハンドリングも可能だが、
          // 基本的には「ツール利用権限なし」ならログアウト扱いにするのが安全。
          // ただしショーケースなら「ログインはしてるけど使えません」表示などが親切。
          // 現状はシンプルに「公開モードならリダイレクトしない」とする。
          if (window.DATAVIZ_HEADER_CONFIG && window.DATAVIZ_HEADER_CONFIG.mode === 'public') {
            // In public mode, we still want to indicate the user is logged in
            // even if their subscription is inactive or expired.
            return { ...profile, email: session.user.email, _inactive: true };
          }

          performRedirect(AUTH_APP_URL, `Inactive Subscription (${status})`);
          return null;
        }

        // ユーザー情報にemailが含まれていない場合があるので、Sessionからマージ
        return { ...profile, email: session.user.email };
      } catch (err) {
        lastError = err;
        if (attempt < PROFILE_RETRY_COUNT) {
          const delayMs = PROFILE_RETRY_DELAYS_MS[attempt] || PROFILE_RETRY_DELAYS_MS[PROFILE_RETRY_DELAYS_MS.length - 1];
          await wait(delayMs);
          continue;
        }
      }
    }

    console.error("[dataviz-auth-client] Profile check failed after retries", lastError);
    return { _error: "Temporarily unavailable" };
  } catch (err) {
    console.error("[dataviz-auth-client] Profile check failed", err);
    return { _error: "Temporarily unavailable" };
  }
}


// =========================================================================
// Controller: メイン処理 (変更なしのエントリーポイント名)
// =========================================================================

async function initDatavizToolAuth() {
  // 1. UIの初期化・表示 (Web Component)
  let headerEl = document.querySelector('dataviz-header');
  if (!headerEl) {
    headerEl = document.createElement('dataviz-header');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => document.body.prepend(headerEl));
    } else {
      document.body.prepend(headerEl);
    }
  }

  if (!supabase) {
    console.error("[dataviz-auth-client] Supabase client missing. Make sure supabase.js is loaded.");
    if (headerEl) {
      // Show error in header
      headerEl.updateState({ isLoading: false, user: null, error: "Auth Client Missing" });
    }
    return;
  }

  let isCheckDone = false;
  let noSessionTimer = null;

  const clearNoSessionTimer = () => {
    if (noSessionTimer) {
      clearTimeout(noSessionTimer);
      noSessionTimer = null;
    }
  };

  const scheduleNoSessionRedirect = () => {
    if (noSessionTimer) return;
    noSessionTimer = setTimeout(async () => {
      noSessionTimer = null;
      await verifyUserAccess(null); // 未ログイン確定後のみリダイレクト
    }, NO_SESSION_REDIRECT_DELAY_MS);
  };

  const handleSession = async (session) => {
    // URLパラメータ掃除
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("code") || hashParams.has("access_token")) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!session) {
      // 未ログイン
      if (headerEl) {
        const isPublicMode = window.DATAVIZ_HEADER_CONFIG && window.DATAVIZ_HEADER_CONFIG.mode === 'public';
        headerEl.updateState({ isLoading: !isPublicMode, user: null, error: null });
      }
      scheduleNoSessionRedirect();
      return;
    }

    // ログイン済み -> 権限チェック
    clearNoSessionTimer();
    const profile = await verifyUserAccess(session);
    if (profile && !profile._error) {
      // 成功 -> UI更新
      if (headerEl) headerEl.updateState({ isLoading: false, user: profile, error: null });
    } else if (profile && profile._error) {
      if (headerEl) headerEl.updateState({ isLoading: false, user: null, error: profile._error });
    }
    // 失敗時は verifyUserAccess 内でリダイレクトされる
  };

  // Immediate initial check to avoid waiting for onAuthStateChange to fire
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await handleSession(session);
    } else {
      // セッションが復元される可能性があるため、猶予中はローディング維持
      if (headerEl) {
        const isPublicMode = window.DATAVIZ_HEADER_CONFIG && window.DATAVIZ_HEADER_CONFIG.mode === 'public';
        headerEl.updateState({ isLoading: !isPublicMode, user: null, error: null });
      }
      scheduleNoSessionRedirect();
    }
  } catch (e) {
    console.warn("[dataviz-auth-client] Initial session check failed", e);
  }

  // authStateChange のみで判定（初期化タイミング問題を回避）
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
      if (!isCheckDone) {
        isCheckDone = true;
      }
      if (event === 'SIGNED_OUT') {
        clearNoSessionTimer();
        await verifyUserAccess(null);
        return;
      }
      await handleSession(session);
    }
  });
}

// 自動実行
initDatavizToolAuth();
