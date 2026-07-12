export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

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

export function event(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const w = window as GtagWindow;
  w.gtag?.("event", name, params);
}

export function pageview(path: string) {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  const w = window as GtagWindow;
  w.gtag?.("config", GA_MEASUREMENT_ID, { page_path: path });
}
