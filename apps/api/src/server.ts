/**
 * Contrato inicial da API Fastify. A implementação real deve injetar repositórios
 * com escopo organizacional obrigatório em todas as consultas.
 */
export interface RequestContext {
  userId: string;
  organizationId: string;
  technicalProfile: "MASTER" | "ADMIN" | "COLLABORATOR" | "CLIENT";
  linkedClientIds: string[];
}

export interface FileStorage {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export const MASTER_EMAIL = "herodronecwb@gmail.com";
export const MASTER_PASSWORD_ENV = "PW_OS_MASTER_INITIAL_PASSWORD";

export function assertMasterBootstrapEnvironment(env: Record<string, string | undefined>) {
  if (!env[MASTER_PASSWORD_ENV]) throw new Error(`Variável obrigatória ausente: ${MASTER_PASSWORD_ENV}`);
}
