import ministriesData from "@/config/ministries.json";

export interface SourceConfig {
  name: string;
  url: string;
  type: "rss" | "atom" | "scrape";
}

export interface MinistryConfig {
  ministry: string;
  color: string;
  sources: SourceConfig[];
}

export const MINISTRIES: MinistryConfig[] = ministriesData as MinistryConfig[];

export const MINISTRY_NAMES = MINISTRIES.map((m) => m.ministry);

export const MINISTRY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  MINISTRIES.map((m) => [m.ministry, m.color])
);

// Fetch settings
export const FETCH_TIMEOUT_MS = 15000;
export const FETCH_DELAY_MS = 1000; // Delay between requests to be polite
export const USER_AGENT =
  "GovNewsDashboard/1.0 (+https://github.com/gov-news-dashboard)";
