import type { ListingLocation } from '@crosspost/shared';
import type { AccountDocument } from '../../accounts/schemas/account.schema.js';
import type { ListingDocument } from '../../listings/schemas/listing.schema.js';
import type { LbcDepositConfigResponse } from './leboncoin-deposit-schema.schemas.js';

/**
 * Contexte partagé entre tous les steps de la chaîne de publication LBC.
 * Chaque step lit ce qu'il a besoin (typiquement les outputs des steps précédents)
 * et écrit ses propres outputs ici. Étendre au fur et à mesure de l'ajout des steps.
 */
export interface LbcPublishContext {
  // ─── Inputs (read-only en pratique) ─────────────────────────────────────
  account: AccountDocument;
  listing: ListingDocument;
  /** Location par défaut de l'user (configurée via /settings) — fournie par l'orchestrateur. */
  defaultLocation?: ListingLocation;

  // ─── Outputs accumulés (chaque step ajoute le sien) ─────────────────────

  /** Catégorie LBC choisie (top du classifier — step 1). */
  category?: {
    id: string;
    topId: string;
    name: string;
    /** Tracking ID à renvoyer aux steps suivants. */
    predictionId?: string;
  };

  /** Schéma dynamique du form de dépôt pour cette catégorie (step 2). */
  depositSchema?: LbcDepositConfigResponse;

  /** Images uploadées vers LBC (référence renvoyée par LBC pour chaque image). */
  uploadedImages?: Array<{ filename: string; url: string }>;

  /**
   * Valeurs résolues pour chaque `associated_key` du schéma (step 4).
   * Le step submit s'en sert pour construire le body final en respectant
   * `codec_type` (root / attributes / extended_attributes).
   */
  resolvedAttrs?: Record<string, unknown>;

  /** ID de l'annonce LBC finale (renvoyé à l'orchestrateur). */
  externalId?: string;
  /** URL publique de l'annonce LBC. */
  externalUrl?: string;

  /** action_id renvoyé par le submit — repris dans le step confirm. */
  actionId?: number;
  /** pricing_id renvoyé par le submit — requis par le step confirm. */
  pricingId?: string;
}
