import axios from 'axios';
import {
  handleAccountNeedsReconnect,
  isAccountNeedsReconnectPayload,
} from '@/composables/account-reconnect';

const apiClient = axios.create({
  baseURL: '/api',
  // Sérialise les arrays en `key=a&key=b` (répétition) plutôt que `key[]=a`,
  // pour que le parseur de query NestJS récupère bien la clé (sinon les
  // filtres tableau — platforms, accountIds — sont silencieusement ignorés).
  paramsSerializer: { indexes: null },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Surface ACCOUNT_NEEDS_RECONNECT errors anywhere they appear (any endpoint,
// any view). Re-throws so individual callers still see the failure.
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const payload = err?.response?.data;
    if (
      err?.response?.status === 401 &&
      isAccountNeedsReconnectPayload(payload)
    ) {
      handleAccountNeedsReconnect(payload);
    }
    return Promise.reject(err);
  },
);

export default apiClient;
