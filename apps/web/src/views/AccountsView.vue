<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h4">Comptes plateformes</h1>
      <v-spacer />
      <v-menu>
        <template #activator="{ props }">
          <v-btn color="primary" prepend-icon="mdi-plus" v-bind="props" :disabled="connecting">
            Connecter un compte
          </v-btn>
        </template>
        <v-list>
          <v-list-item
            v-for="p in platforms"
            :key="p.value"
            :title="p.label"
            @click="connectAccount(p.value)"
          />
        </v-list>
      </v-menu>
    </div>

    <v-alert v-if="connecting" type="info" class="mb-4">
      Un navigateur s'est ouvert. Connecte-toi manuellement puis reviens ici.
      <v-progress-linear indeterminate class="mt-2" />
    </v-alert>

    <v-alert v-if="connectError" type="error" class="mb-4" closable @click:close="connectError = ''">
      {{ connectError }}
    </v-alert>

    <v-alert v-if="syncMessage" type="info" class="mb-4" closable @click:close="syncMessage = ''">
      {{ syncMessage }}
    </v-alert>

    <v-table>
      <thead>
        <tr>
          <th>Plateforme</th>
          <th>Identifiant</th>
          <th>Statut</th>
          <th>Derniere verification</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!accounts.length">
          <td colspan="5" class="text-center text-medium-emphasis pa-4">
            Aucun compte connecte
          </td>
        </tr>
        <tr v-for="account in accounts" :key="account._id">
          <td>{{ account.platform }}</td>
          <td>{{ account.username }}</td>
          <td>
            <v-chip :color="account.isConnected ? 'success' : 'error'" size="small">
              {{ account.isConnected ? 'Connecte' : 'Session expiree' }}
            </v-chip>
            <v-icon
              v-if="checkResult && checkResult.id === account._id"
              :icon="checkResult.isValid ? 'mdi-check-circle' : 'mdi-alert-circle'"
              :color="checkResult.isValid ? 'success' : 'error'"
              size="small"
              class="ml-2"
            />
          </td>
          <td>
            {{ account.lastCheckedAt ? new Date(account.lastCheckedAt).toLocaleString('fr-FR') : '-' }}
          </td>
          <td>
            <v-tooltip text="Verifier la session">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-refresh"
                  size="small"
                  variant="text"
                  :loading="checkingId === account._id"
                  @click="checkSession(account._id)"
                />
              </template>
            </v-tooltip>
            <v-tooltip v-if="!account.isConnected" text="Reconnecter">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-link-variant"
                  size="small"
                  variant="text"
                  color="warning"
                  :disabled="connecting"
                  @click="reconnect(account._id)"
                />
              </template>
            </v-tooltip>
            <v-tooltip v-if="account.isConnected" text="Synchroniser les annonces">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-sync"
                  size="small"
                  variant="text"
                  color="primary"
                  :loading="syncingId === account._id"
                  @click="syncAccount(account._id)"
                />
              </template>
            </v-tooltip>
            <v-tooltip text="Supprimer">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  :loading="removingId === account._id"
                  @click="removeAccount(account._id)"
                />
              </template>
            </v-tooltip>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { Platform } from '@crosspost/shared';
import apiClient from '@/api/client';

const platforms = [
  { label: 'Leboncoin', value: Platform.LEBONCOIN },
  { label: 'Vinted', value: Platform.VINTED },
];

const accounts = ref<any[]>([]);
const isLoading = ref(false);
const connecting = ref(false);
const connectError = ref('');
const checkingId = ref<string | null>(null);
const removingId = ref<string | null>(null);
const syncingId = ref<string | null>(null);
const syncMessage = ref('');
let pollTimer: ReturnType<typeof setInterval> | null = null;
let syncPollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchAccounts() {
  isLoading.value = true;
  try {
    const { data } = await apiClient.get('/accounts');
    accounts.value = data;
  } finally {
    isLoading.value = false;
  }
}

async function pollConnectStatus(sessionId: string) {
  pollTimer = setInterval(async () => {
    try {
      const { data } = await apiClient.get(`/accounts/connect/${sessionId}/status`);
      if (data.status === 'success') {
        stopPolling();
        connecting.value = false;
        await fetchAccounts();
      } else if (data.status === 'error') {
        stopPolling();
        connecting.value = false;
        connectError.value = data.error || 'La connexion a echoue';
      }
    } catch {
      stopPolling();
      connecting.value = false;
      connectError.value = 'Erreur lors de la verification du statut';
    }
  }, 2000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onUnmounted(() => {
  stopPolling();
  stopSyncPolling();
});

async function connectAccount(platform: string) {
  connecting.value = true;
  connectError.value = '';
  try {
    const { data } = await apiClient.post('/accounts/connect', { platform });
    pollConnectStatus(data.sessionId);
  } catch {
    connecting.value = false;
    connectError.value = 'Impossible de lancer la connexion';
  }
}

const checkResult = ref<{ id: string; isValid: boolean } | null>(null);

async function checkSession(id: string) {
  checkingId.value = id;
  checkResult.value = null;
  try {
    const { data } = await apiClient.post(`/accounts/${id}/check-session`);
    checkResult.value = { id, isValid: data.isValid };
    await fetchAccounts();
    setTimeout(() => {
      if (checkResult.value?.id === id) checkResult.value = null;
    }, 5000);
  } finally {
    checkingId.value = null;
  }
}

async function reconnect(id: string) {
  connecting.value = true;
  connectError.value = '';
  try {
    const { data } = await apiClient.post(`/accounts/${id}/reconnect`);
    pollConnectStatus(data.sessionId);
  } catch {
    connecting.value = false;
    connectError.value = 'Impossible de relancer la connexion';
  }
}

async function removeAccount(id: string) {
  removingId.value = id;
  try {
    await apiClient.delete(`/accounts/${id}`);
    await fetchAccounts();
  } finally {
    removingId.value = null;
  }
}

async function syncAccount(accountId: string) {
  syncingId.value = accountId;
  syncMessage.value = '';
  try {
    const { data } = await apiClient.post(`/sync/${accountId}`);
    pollSyncStatus(data.sessionId, accountId);
  } catch {
    syncingId.value = null;
    syncMessage.value = 'Impossible de lancer la synchronisation';
  }
}

function pollSyncStatus(sessionId: string, accountId: string) {
  syncPollTimer = setInterval(async () => {
    try {
      const { data } = await apiClient.get(`/sync/${sessionId}/status`);
      if (data.status === 'success') {
        stopSyncPolling();
        syncingId.value = null;
        syncMessage.value = `${data.found} annonces trouvees, ${data.created} nouvelles importees`;
      } else if (data.status === 'error') {
        stopSyncPolling();
        syncingId.value = null;
        syncMessage.value = data.error || 'La synchronisation a echoue';
      }
    } catch {
      stopSyncPolling();
      syncingId.value = null;
      syncMessage.value = 'Erreur lors de la synchronisation';
    }
  }, 2000);
}

function stopSyncPolling() {
  if (syncPollTimer) {
    clearInterval(syncPollTimer);
    syncPollTimer = null;
  }
}

fetchAccounts();
</script>
