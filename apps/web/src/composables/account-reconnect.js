import { reactive } from 'vue';
import { ACCOUNT_NEEDS_RECONNECT_CODE, accountNeedsReconnectBodySchema, } from '@crosspost/shared';
// Module-level singleton — same alert state shared across the whole app.
const state = reactive({ body: null });
/** Surface a "needs reconnect" alert. Called from both axios interceptor and (future) job watcher. */
export function handleAccountNeedsReconnect(body) {
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
export function isAccountNeedsReconnectPayload(payload) {
    if (!payload || typeof payload !== 'object')
        return false;
    if (payload.code !== ACCOUNT_NEEDS_RECONNECT_CODE) {
        return false;
    }
    return accountNeedsReconnectBodySchema.safeParse(payload).success;
}
//# sourceMappingURL=account-reconnect.js.map