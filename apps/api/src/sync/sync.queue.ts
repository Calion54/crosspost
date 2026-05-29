export const SYNC_QUEUE = 'sync';

export interface SyncJobData {
  accountId: string;
  userId: string;
  trigger: 'login' | 'manual';
}

export interface SyncEvent {
  /** Type d'event poussé sur le SSE. */
  type: 'queued' | 'started' | 'completed' | 'failed';
  /** Owner — utilisé pour filtrer côté SSE. */
  userId: string;
  /** Pour matcher l'event à un compte côté UI. */
  accountId: string;
  /** Comment le sync a été déclenché (utile pour l'UX : pas de toast sur auto-sync). */
  trigger: 'login' | 'manual';
  /** Présent uniquement sur 'completed'. */
  result?: {
    found: number;
    created: number;
    skipped: number;
    errors: number;
  };
  /** Présent uniquement sur 'failed'. */
  error?: string;
}
