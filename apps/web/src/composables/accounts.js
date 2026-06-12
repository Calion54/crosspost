import { ref } from 'vue';
import apiClient from '@/api/client';
// Module-level singleton — accounts are loaded once at app start and
// refreshed explicitly by views that mutate them (connect, delete, sync).
const accounts = ref([]);
const loaded = ref(false);
async function fetchAccounts() {
    const { data } = await apiClient.get('/accounts');
    accounts.value = data;
    loaded.value = true;
}
export function useAccounts() {
    return { accounts, loaded, fetchAccounts };
}
//# sourceMappingURL=accounts.js.map