export type AdPlatform = "GOOGLE_ADS" | "META_ADS";

export interface AuthorizationInput { organizationId: string; userId: string; redirectUri: string }
export interface AuthorizationCallbackInput { code: string; state: string; redirectUri: string }
export interface Connection { id: string; platform: AdPlatform; status: string }
export interface ConnectionTestResult { ok: boolean; message: string; checkedAt: string }
export interface ManagerEntity { externalId: string; name: string; kind: "MANAGER_ACCOUNT" | "BUSINESS_PORTFOLIO" }
export interface ExternalAdAccount { externalId: string; name: string; currency: string; timezone: string; status: string }
export interface ExternalCampaign { externalId: string; name: string; status: string; objective: string; budget?: number }
export interface SyncAccountInput { connectionId: string; accountId: string; organizationId: string }
export interface SyncResult { ok: boolean; received: number; updated: number; completedAt: string }

export interface AdPlatformConnector {
  getAuthorizationUrl(input: AuthorizationInput): Promise<string>;
  completeAuthorization(input: AuthorizationCallbackInput): Promise<Connection>;
  testConnection(connectionId: string): Promise<ConnectionTestResult>;
  listManagerEntities(connectionId: string): Promise<ManagerEntity[]>;
  listAdAccounts(connectionId: string): Promise<ExternalAdAccount[]>;
  listCampaigns(connectionId: string, accountId: string): Promise<ExternalCampaign[]>;
  syncAccount(input: SyncAccountInput): Promise<SyncResult>;
  refreshAuthorization(connectionId: string): Promise<void>;
  revokeAuthorization(connectionId: string): Promise<void>;
}

export class GoogleAdsConnector implements AdPlatformConnector {
  async getAuthorizationUrl(): Promise<string> { throw new Error("GOOGLE_ADS_NOT_CONFIGURED"); }
  async completeAuthorization(): Promise<Connection> { throw new Error("GOOGLE_ADS_NOT_CONFIGURED"); }
  async testConnection(): Promise<ConnectionTestResult> { return { ok: false, message: "Credenciais oficiais do Google Ads ainda não configuradas.", checkedAt: new Date().toISOString() }; }
  async listManagerEntities(): Promise<ManagerEntity[]> { return []; }
  async listAdAccounts(): Promise<ExternalAdAccount[]> { return []; }
  async listCampaigns(): Promise<ExternalCampaign[]> { return []; }
  async syncAccount(): Promise<SyncResult> { return { ok: false, received: 0, updated: 0, completedAt: new Date().toISOString() }; }
  async refreshAuthorization(): Promise<void> { throw new Error("GOOGLE_ADS_NOT_CONFIGURED"); }
  async revokeAuthorization(): Promise<void> {}
}

export class MetaAdsConnector extends GoogleAdsConnector {
  override async getAuthorizationUrl(): Promise<string> { throw new Error("META_ADS_NOT_CONFIGURED"); }
}
