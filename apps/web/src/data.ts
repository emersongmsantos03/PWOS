export type Platform = "Google Ads" | "Meta Ads";
export type Health = "Saudável" | "Atenção" | "Em risco";

export interface Campaign {
  id: string; client: string; campaign: string; platform: Platform; status: Health;
  owner: string; budget: number; spend: number; impressions: number; clicks: number;
  ctr: number; cpc: number; conversions: number; cpa: number; change: number;
}
export interface Client {
  name: string; status: Health; channels: string; owner: string; next: string; note: string;
}
export interface TrendPoint { day: string; atual: number; anterior: number }

export const campaigns: Campaign[] = [
];

export const clients: Client[] = [
];

export const trend: TrendPoint[] = [
];
