declare function fetchAccounts(): Promise<void>;
export declare function useAccounts(): {
    accounts: import("vue").Ref<{
        _id: string;
        platform: import("@crosspost/shared").Platform;
        email: string;
        isConnected: boolean;
        needsReconnect: boolean;
        externalUserId?: string | undefined | undefined;
        connectedAt?: Date | undefined;
        tokenExpiresAt?: Date | undefined;
        lastRefreshedAt?: Date | undefined;
    }[], {
        _id: string;
        platform: import("@crosspost/shared").Platform;
        email: string;
        isConnected: boolean;
        needsReconnect: boolean;
        externalUserId?: string | undefined;
        connectedAt?: Date | undefined;
        tokenExpiresAt?: Date | undefined;
        lastRefreshedAt?: Date | undefined;
    }[] | {
        _id: string;
        platform: import("@crosspost/shared").Platform;
        email: string;
        isConnected: boolean;
        needsReconnect: boolean;
        externalUserId?: string | undefined | undefined;
        connectedAt?: Date | undefined;
        tokenExpiresAt?: Date | undefined;
        lastRefreshedAt?: Date | undefined;
    }[]>;
    loaded: import("vue").Ref<boolean, boolean>;
    fetchAccounts: typeof fetchAccounts;
};
export {};
