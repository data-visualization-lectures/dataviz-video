export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const GA_PRODUCTION_HOSTNAMES = ["video.dataviz.jp"] as const;

export const GA_LINKER_DOMAINS = [
  "www.dataviz.jp",
  "id.dataviz.jp",
  "app.dataviz.jp",
  "video.dataviz.jp",
];

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

export function isProductionAnalyticsHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  return GA_PRODUCTION_HOSTNAMES.some((candidate) => candidate === normalized);
}

function canTrackAnalytics() {
  return (
    typeof window !== "undefined" &&
    isProductionAnalyticsHostname(window.location.hostname)
  );
}

export function event(name: string, params: Record<string, unknown> = {}) {
  if (!canTrackAnalytics()) return;
  const w = window as GtagWindow;
  w.gtag?.("event", name, params);
}

export function pageview(path: string) {
  if (!GA_MEASUREMENT_ID || !canTrackAnalytics()) return;
  const w = window as GtagWindow;
  w.gtag?.("config", GA_MEASUREMENT_ID, { page_path: path });
}
