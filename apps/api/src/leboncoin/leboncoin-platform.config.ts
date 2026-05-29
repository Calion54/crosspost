export const LBC_AUTH_HOST = 'https://auth.leboncoin.fr';
export const LBC_API_HOST = 'https://api.leboncoin.fr';
export const LBC_WEB_HOST = 'https://www.leboncoin.fr';

export const LBC_CLIENT_ID = 'lbc-front-web';
export const LBC_OAUTH_REDIRECT_URI = `${LBC_WEB_HOST}/oauth2callback`;
export const LBC_OAUTH_SCOPE = '* offline';

export const LBC_LOGIN_PAGE = `${LBC_AUTH_HOST}/login/`;
export const LBC_TOKEN_ENDPOINT = `${LBC_AUTH_HOST}/api/authorizer/v2/token`;
export const LBC_AUTHORIZE_ENDPOINT = `${LBC_AUTH_HOST}/api/authorizer/v2/authorize`;
export const LBC_LOGOUT_ENDPOINT = `${LBC_AUTH_HOST}/api/authenticator/v1/users/logout`;

export const LBC_DASHBOARD_SEARCH_URL = `${LBC_API_HOST}/api/dashboard/v1/search`;
export const LBC_ME_ACCOUNT_URL = `${LBC_API_HOST}/api/account/v2/members/me/account`;
export const LBC_DELETE_ADS_URL = `${LBC_API_HOST}/api/pintad/v1/public/manual/delete/ads`;
export const LBC_CLASSIFY_URL = `${LBC_API_HOST}/api/ad-classifier/v2/classify`;
export const LBC_UPLOAD_IMAGE_URL = `${LBC_API_HOST}/api/pintad/v1/public/upload/image`;
export const LBC_SUBMIT_AD_URL = `${LBC_API_HOST}/api/adsubmit/v2/classifieds?with_variation=true`;
export const LBC_PRICING_URL = `${LBC_API_HOST}/api/options/v5/pricing/classifieds`;
export const LBC_CONFIRM_SUBMIT_URL = `${LBC_API_HOST}/api/services/v4/submit`;
export const LBC_DEPOSIT_CONFIG_URL = `${LBC_API_HOST}/api/adsubmit/dynamic-deposit/config`;
export const LBC_SHIPPING_PREDICT_URL = `${LBC_API_HOST}/api/consumergoods/proxy/v2/pages/ad-submit`;
export const LBC_DEPOSIT_PAGE = `${LBC_WEB_HOST}/deposer-une-annonce`;

/**
 * Clé hardcoded du front LBC (lbc-front-web), partagée par tous les users.
 * Présente dans les calls de modification d'annonces (delete, etc.).
 * Si LBC change cette clé un jour, à mettre à jour ici.
 */
export const LBC_INTERNAL_API_KEY = 'ba0c2dad52b3ec';

// Marge avant expiration JWT pour déclencher un refresh
export const LBC_JWT_REFRESH_SKEW_MS = 60_000;
