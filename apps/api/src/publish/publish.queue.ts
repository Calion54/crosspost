import type { Platform } from '@crosspost/shared';

/**
 * Queue unique de publication. Comme pour `sync`, l'aiguillage par plateforme
 * se fait dans le processor via `PlatformPublishDispatcher` — pas une queue par
 * marketplace. La concurrency est donc globale (réglée sur le @Processor).
 */
export const PUBLISH_QUEUE = 'publish';

export interface PublishJobData {
  listingId: string;
  accountId: string;
  userId: string;
  /** Dénormalisé depuis le compte au moment de l'enqueue (pour les events SSE). */
  platform: Platform;
  /** Publication upsertée en PENDING au moment de l'enqueue. */
  publicationId: string;
}

export interface PublishEvent {
  /** Type d'event poussé sur le SSE. */
  type: 'queued' | 'started' | 'completed' | 'failed';
  /** Owner — utilisé pour filtrer côté SSE. */
  userId: string;
  /** Pour matcher l'event à un compte côté UI (clé des publishSessions). */
  accountId: string;
  /** Annonce concernée. */
  listingId: string;
  platform: Platform;
  publicationId: string;
  /** Présent uniquement sur 'completed'. */
  result?: { externalId: string; externalUrl: string };
  /** Présent uniquement sur 'failed'. */
  error?: string;
}
