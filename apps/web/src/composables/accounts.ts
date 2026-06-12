import { ref } from 'vue';
import apiClient from '@/api/client';
import type { AccountResponse } from '@crosspost/shared';

// Module-level singleton — accounts are loaded once at app start and
// refreshed explicitly by views that mutate them (connect, delete, sync).
const accounts = ref<AccountResponse[]>([]);
const loaded = ref(false);

async function fetchAccounts(): Promise<void> {
  const { data } = await apiClient.get<AccountResponse[]>('/accounts');
  accounts.value = data;
  loaded.value = true;
}

export function useAccounts() {
  return { accounts, loaded, fetchAccounts };
}
