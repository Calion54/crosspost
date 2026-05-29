import type { ListingLocation } from '@crosspost/shared';
import type { AccountDocument } from '../accounts/schemas/account.schema.js';
import type { ListingDocument } from '../listings/schemas/listing.schema.js';
import type { PublicationDocument } from '../publications/schemas/publication.schema.js';

/** Options génériques pour publish() — info contextuelle au-delà du listing/account. */
export interface PublishOptions {
  /** Location par défaut du user (configurée via /settings). Obligatoire pour les plateformes qui exigent une location. */
  defaultLocation?: ListingLocation;
}

/**
 * Résultat d'une tentative de suppression d'une annonce côté plateforme.
 *  - 'deleted'      : LBC a accepté le DELETE
 *  - 'already_gone' : LBC a renvoyé 404/410 → l'annonce était déjà absente, idempotent
 *  - 'failed'       : Erreur (auth, réseau, DataDome, etc.)
 */
export type DeletePublicationStatus = 'deleted' | 'already_gone' | 'failed';

export interface DeletePublicationResult {
  status: DeletePublicationStatus;
  message?: string;
}

/** Résultat retourné par `publish()` : référence à l'annonce créée côté plateforme. */
export interface PublishResult {
  externalId: string;
  externalUrl: string;
}

/**
 * Contrat que chaque service publish platform-specific doit implémenter.
 */
export interface PlatformPublishAdapter {
  /** Publie une annonce sur la plateforme. Orchestre une chaîne de steps en interne. */
  publish(
    account: AccountDocument,
    listing: ListingDocument,
    options?: PublishOptions,
  ): Promise<PublishResult>;

  /** Supprime une annonce sur la plateforme. Idempotent (already_gone = OK). */
  deletePublication(
    account: AccountDocument,
    publication: PublicationDocument,
  ): Promise<DeletePublicationResult>;
}
