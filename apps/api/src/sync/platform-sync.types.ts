import type { AccountDocument } from '../accounts/schemas/account.schema.js';

export interface SyncResult {
  found: number;
  created: number;
  skipped: number;
  removed: number;
  errors: number;
}

/**
 * Contrat que chaque service de sync platform-specific doit implémenter.
 * Permet à `SyncService` d'aiguiller uniformément quelle que soit la plateforme.
 */
export interface PlatformSyncAdapter {
  sync(account: AccountDocument): Promise<SyncResult>;
}
