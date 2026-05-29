export const VINTED_WEB_HOST = 'https://www.vinted.fr';
export const VINTED_API_HOST = 'https://www.vinted.fr';

export const VINTED_HOME_URL = `${VINTED_WEB_HOST}/`;
export const VINTED_OAUTH_URL = `${VINTED_WEB_HOST}/web/api/auth/oauth`;
/** Refresh des tokens via cookie refresh_token_web. */
export const VINTED_TOKEN_REFRESH_URL = `${VINTED_WEB_HOST}/web/api/auth/token_refresh`;
/** Liste des annonces d'un membre (wardrobe). `{userId}` = sub du JWT. */
export const VINTED_WARDROBE_ITEMS_URL = (userId: string) =>
  `${VINTED_API_HOST}/api/v2/wardrobe/${userId}/items`;

/** Upload d'une image vers Vinted (multipart). Appelé une fois par photo. */
export const VINTED_PHOTOS_URL = `${VINTED_API_HOST}/api/v2/photos`;

/**
 * Schéma dynamique des attributs pour une catégorie (brand, condition, color,
 * size selon la catégorie). Réponse récursive — `configuration` peut être
 * inline (enum dispo) ou `null` (catalogue à fetch séparément).
 */
export const VINTED_ATTRIBUTES_URL = `${VINTED_API_HOST}/api/v2/item_upload/attributes`;

/**
 * Catalogue de marques curaté pour une catégorie (typiquement 40-60 entrées,
 * pas le catalogue Vinted complet). Réponse inclut `disable_custom_brands` —
 * si false, on peut envoyer une marque en texte libre au submit.
 */
export const VINTED_BRANDS_URL = `${VINTED_API_HOST}/api/v2/item_upload/brands`;

/**
 * Catalogue de couleurs Vinted (~29 entrées). Pas de query param — c'est un
 * catalogue global, indépendant de la catégorie.
 */
export const VINTED_COLORS_URL = `${VINTED_API_HOST}/api/v2/item_upload/colors`;

/** Submit final de l'annonce (création). */
export const VINTED_ITEMS_URL = `${VINTED_API_HOST}/api/v2/item_upload/items`;

/**
 * Suppression d'une annonce. **POST** (pas DELETE) sans body. Idempotent :
 * Vinted renvoie 404 si l'item n'existe plus.
 */
export const VINTED_DELETE_ITEM_URL = (itemId: string | number) =>
  `${VINTED_API_HOST}/api/v2/items/${itemId}/delete`;

/**
 * Tailles de colis disponibles pour une catégorie. Endpoint sur le sous-domaine
 * `api.vinted.fr` (différent de `www.vinted.fr`). Retourne typiquement 3 tailles
 * triées par capacité croissante (small → medium → large).
 */
export const VINTED_PACKAGE_SIZES_URL = (catalogId: number) =>
  `https://api.vinted.fr/shipping-estimation/external/catalogs/${catalogId}/package_sizes`;

/**
 * Catalogue complet des catégories Vinted (ontologie publique). Arbre récursif,
 * payload ~500 Ko. Mis en cache au démarrage et rafraîchi par TTL — pas besoin
 * de le re-fetch à chaque publish.
 */
export const VINTED_CATALOGS_URL = `${VINTED_API_HOST}/api/v2/item_upload/catalogs`;

/** Page de dépôt — utilisée comme Referer/Origin sur tous les calls du flow publish. */
export const VINTED_NEW_ITEM_PAGE = `${VINTED_WEB_HOST}/items/new`;

/** Marge avant expiration de l'access token pour déclencher un refresh. */
export const VINTED_TOKEN_REFRESH_SKEW_MS = 60_000;

/**
 * UA Chrome récent — doit matcher entre login et API calls (DataDome/Cloudflare
 * bindent leurs cookies aux signaux device).
 */
export const VINTED_DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
