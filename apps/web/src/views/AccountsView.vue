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

    <v-alert v-if="connecting && !showVnc" type="info" class="mb-4">
      {{ connectLocalMode
        ? 'Un navigateur s\'est ouvert. Connecte-toi manuellement puis reviens ici.'
        : 'Demarrage du navigateur distant...' }}
      <v-progress-linear indeterminate class="mt-2" />
    </v-alert>

    <v-alert v-if="connectError" type="error" class="mb-4" closable @click:close="connectError = ''">
      {{ connectError }}
    </v-alert>

    <v-alert v-if="syncMessage" type="info" class="mb-4" closable @click:close="syncMessage = ''">
      {{ syncMessage }}
    </v-alert>

    <!-- VNC Dialog -->
    <v-dialog v-model="showVnc" width="1320" persistent>
      <v-card>
        <v-card-title class="d-flex align-center">
          Connexion au compte
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="cancelConnect" />
        </v-card-title>
        <v-card-text class="pa-0">
          <VncViewer
            v-if="vncWsUrl"
            :url="vncWsUrl"
            @disconnect="onVncDisconnect"
          />
        </v-card-text>
      </v-card>
    </v-dialog>

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
import { ref, computed, onUnmounted } from 'vue';
import { Platform } from '@crosspost/shared';
import apiClient from '@/api/client';
import VncViewer from '@/components/VncViewer.vue';

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
const vncUrl = ref<string | null>(null);
const showVnc = ref(false);
const connectLocalMode = ref(false);
let eventSource: EventSource | null = null;
let syncPollTimer: ReturnType<typeof setInterval> | null = null;

const vncWsUrl = computed(() => {
  if (!vncUrl.value) return null;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${vncUrl.value}`;
});

async function fetchAccounts() {
  isLoading.value = true;
  try {
    const { data } = await apiClient.get('/accounts');
    accounts.value = data;
  } finally {
    isLoading.value = false;
  }
}

function listenToConnectEvents(sessionId: string) {
  closeEventSource();

  eventSource = new EventSource(`/api/accounts/connect/${sessionId}/events`);

  eventSource.onmessage = (event) => {
    try {
      const session = JSON.parse(event.data);

      if (session.status === 'browser_ready') {
        if (session.vncUrl) {
          vncUrl.value = session.vncUrl;
          showVnc.value = true;
        } else {
          connectLocalMode.value = true;
        }
      }

      if (session.status === 'success') {
        closeEventSource();
        connecting.value = false;
        showVnc.value = false;
        vncUrl.value = null;
        connectLocalMode.value = false;
        fetchAccounts();
      } else if (session.status === 'error') {
        closeEventSource();
        connecting.value = false;
        showVnc.value = false;
        vncUrl.value = null;
        connectLocalMode.value = false;
        connectError.value = session.error || 'La connexion a echoue';
      }
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = () => {
    closeEventSource();
    if (connecting.value) {
      connecting.value = false;
      showVnc.value = false;
      vncUrl.value = null;
      connectError.value = 'Connexion au serveur perdue';
    }
  };
}

function closeEventSource() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function cancelConnect() {
  closeEventSource();
  connecting.value = false;
  showVnc.value = false;
  vncUrl.value = null;
  connectLocalMode.value = false;
}

function onVncDisconnect() {
  // VNC disconnected — the session may still be running,
  // SSE will handle the final status update
}

onUnmounted(() => {
  closeEventSource();
  stopSyncPolling();
});

async function connectAccount(platform: string) {
  connecting.value = true;
  connectError.value = '';
  vncUrl.value = null;
  connectLocalMode.value = false;
  try {
    const { data } = await apiClient.post('/accounts/connect', { platform });
    listenToConnectEvents(data.sessionId);
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
  vncUrl.value = null;
  connectLocalMode.value = false;
  try {
    const { data } = await apiClient.post(`/accounts/${id}/reconnect`);
    listenToConnectEvents(data.sessionId);
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
