import { reactive } from 'vue';
import {
  ACCOUNT_NEEDS_RECONNECT_CODE,
  accountNeedsReconnectBodySchema,
  type AccountNeedsReconnectBody,
} from '@crosspost/shared';

interface ReconnectAlertState {
  body: AccountNeedsReconnectBody | null;
}

// Module-level singleton — same alert state shared across the whole app.
const state = reactive<ReconnectAlertState>({ body: null });

/** Surface a "needs reconnect" alert. Called from both axios interceptor and (future) job watcher. */
export function handleAccountNeedsReconnect(body: AccountNeedsReconnectBody) {
  state.body = body;
}

export function dismissReconnectAlert() {
  state.body = null;
}

export function useAccountReconnect() {
  return state;
}

/**
 * Type-guard for an unknown payload — used by interceptors and job watchers
 * to detect the structured error without coupling to a specific transport.
 */
export function isAccountNeedsReconnectPayload(
  payload: unknown,
): payload is AccountNeedsReconnectBody {
  if (!payload || typeof payload !== 'object') return false;
  if ((payload as { code?: unknown }).code !== ACCOUNT_NEEDS_RECONNECT_CODE) {
    return false;
  }
  return accountNeedsReconnectBodySchema.safeParse(payload).success;
}
