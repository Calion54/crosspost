/**
 * Queue du scheduler de remontée auto. Un seul job répétable ("tick") tourne
 * toutes les heures : il SÉLECTIONNE les annonces dues et délègue la remontée à
 * la queue `publish` (mode='bump'). Le tick ne publie jamais lui-même.
 */
export const BUMP_SCHEDULER_QUEUE = 'bump-scheduler';

/** Résumé renvoyé par le tick (visible dans BullBoard). */
export interface BumpTickResult {
  usersScanned: number;
  listingsDue: number;
  jobsEnqueued: number;
}
