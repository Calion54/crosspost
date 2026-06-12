export enum PublicationStatus {
  /** Pas encore publiée. */
  DRAFT = 'draft',
  /** En file d'attente ou en cours de publication (job BullMQ). */
  PENDING = 'pending',
  /** En ligne sur la plateforme. */
  PUBLISHED = 'published',
  /** Vendue (Vinted: `item_closing_action === 'sold'`). */
  SOLD = 'sold',
  /** La dernière tentative de publication a échoué. */
  ERROR = 'error',
}
