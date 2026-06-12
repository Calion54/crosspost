import type { ListingLocation } from '@crosspost/shared';
import type { AccountDocument } from '../../accounts/schemas/account.schema.js';
import type { ListingDocument } from '../../listings/schemas/listing.schema.js';
import type {
  VintedAttribute,
  VintedBrand,
  VintedColor,
  VintedPackageSize,
} from './vinted-publish.schemas.js';

/**
 * Contexte partagé entre tous les steps de la chaîne de publication Vinted.
 * Chaque step lit ce dont il a besoin (typiquement les outputs des steps
 * précédents) et écrit ses propres outputs ici. Étendre au fur et à mesure
 * de l'ajout des steps.
 */
export interface VintedPublishContext {
  // ─── Inputs ──────────────────────────────────────────────────────────────
  account: AccountDocument;
  listing: ListingDocument;
  /** Location par défaut de l'user (configurée via /settings). */
  defaultLocation?: ListingLocation;

  // ─── Outputs accumulés (remplis par les steps) ───────────────────────────

  /**
   * UUID de session généré au début de `publish()` et réutilisé par tous les
   * calls Vinted du flow (upload-photos en temp_uuid, submit en temp_uuid +
   * upload_session_id).
   */
  uploadSessionId?: string;

  /** Photos uploadées vers Vinted (step 1). Ordre = ordre du listing.media. */
  uploadedPhotos?: Array<{ id: number; tempUuid: string; url: string }>;

  /** Catégorie Vinted retenue (feuille de l'arbre, résolue via cascade LLM). */
  categoryId?: number;

  /**
   * Tailles de colis valides pour la catégorie, triées par capacité croissante.
   * Typiquement 3 entrées (small/medium/large) mais varie par catégorie.
   * Posé par `fetch-package-sizes`, consommé par `submit-item` pour mapper
   * `listing.packageSize` (S/M/L) → id via l'index.
   */
  packageSizes?: VintedPackageSize[];

  /**
   * Schéma dynamique des attributs requis pour cette catégorie (step 3).
   * Certains attributs ont leurs `configuration.options` inline (enum dispo),
   * d'autres ont `configuration: null` et nécessitent un fetch de catalogue
   * (colors, brands, sizes…) au step suivant.
   */
  attributesSchema?: VintedAttribute[];

  /**
   * Marques curatées pour la catégorie (step fetch-brands, conditionnel).
   * Vide si l'attribut `brand` n'est pas requis (ex: video game).
   */
  brandCatalog?: VintedBrand[];
  /** Si false, on peut envoyer une marque en texte libre au submit. */
  disableCustomBrands?: boolean;

  /**
   * Catalogue de couleurs Vinted (step fetch-colors, conditionnel).
   * Vide si l'attribut `color` n'est pas requis pour la catégorie.
   */
  colorCatalog?: VintedColor[];

  /**
   * Valeurs résolues pour chaque attribut (step resolve-attributes).
   * Clé = `attr.code`, valeur = id Vinted choisi (depuis catalogue ou inline).
   * Le step submit s'en sert pour construire le body final.
   */
  resolvedAttrs?: Record<string, number>;

  /**
   * ISBN-13 du livre (champ texte libre, pas un enum d'options). Résolu par
   * `resolve-attributes` uniquement quand la catégorie expose l'attribut `isbn`
   * (`configuration: null`) — extrait du texte de l'annonce ou identifié par le
   * LLM. `undefined` si non résolu. Posé au root `item.isbn` par `submit-item`.
   */
  isbn?: string;

  /** ID de l'annonce Vinted finale (renvoyé à l'orchestrateur). */
  externalId?: string;
  /** URL publique de l'annonce Vinted. */
  externalUrl?: string;
}
