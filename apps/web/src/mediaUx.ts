export type MediaMetricFocus = "ALL" | "SPEND" | "LEADS" | "CPL";

export const matchesMediaMetric = (focus: MediaMetricFocus, campaign: { spend: number; leads: number; cpl: number | null }) =>
  focus === "ALL" || focus === "SPEND" && campaign.spend > 0 || focus === "LEADS" && campaign.leads > 0 || focus === "CPL" && campaign.cpl !== null;

export const mediaPercentChange = (current: number, previous: number, inverse = false) =>
  previous ? ((current - previous) / previous * 100) * (inverse ? -1 : 1) : null;

export const mediaTrendCacheKey = (granularity: string, since: string, until: string, signature: string) =>
  `pw-os-media-trend:${granularity}:${since}:${until}:${signature}`;
