import { type AccountNeedsReconnectBody } from '@crosspost/shared';
/** Surface a "needs reconnect" alert. Called from both axios interceptor and (future) job watcher. */
export declare function handleAccountNeedsReconnect(body: AccountNeedsReconnectBody): void;
export declare function dismissReconnectAlert(): void;
export declare function useAccountReconnect(): {
    body: {
        code: "ACCOUNT_NEEDS_RECONNECT";
        message: string;
        platform: import("@crosspost/shared").Platform;
        email: string;
        accountId: string;
    } | null;
};
/**
 * Type-guard for an unknown payload — used by interceptors and job watchers
 * to detect the structured error without coupling to a specific transport.
 */
export declare function isAccountNeedsReconnectPayload(payload: unknown): payload is AccountNeedsReconnectBody;
