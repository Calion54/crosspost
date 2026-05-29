<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h4">Comptes plateformes</h1>
      <v-spacer />
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        @click="openConnectDialog()"
      >
        Connecter un compte
      </v-btn>
    </div>

    <v-alert
      v-if="error"
      type="error"
      class="mb-4"
      closable
      @click:close="error = ''"
    >
      {{ error }}
    </v-alert>

    <v-alert
      v-if="syncMessage"
      type="success"
      variant="tonal"
      class="mb-4"
      closable
      @click:close="syncMessage = ''"
    >
      {{ syncMessage }}
    </v-alert>

    <v-table>
      <thead>
        <tr>
          <th>Plateforme</th>
          <th>Email</th>
          <th>Statut</th>
          <th>Connecté le</th>
          <th>Token expire</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!accounts.length">
          <td colspan="6" class="text-center text-medium-emphasis pa-4">
            Aucun compte connecté
          </td>
        </tr>
        <tr v-for="account in accounts" :key="account._id">
          <td>{{ account.platform }}</td>
          <td>{{ account.email }}</td>
          <td>
            <v-chip
              :color="statusColor(account)"
              size="small"
            >
              {{ statusLabel(account) }}
            </v-chip>
          </td>
          <td>{{ formatDate(account.connectedAt) }}</td>
          <td>{{ formatDate(account.tokenExpiresAt) }}</td>
          <td>
            <v-tooltip v-if="account.needsReconnect" text="Reconnecter">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-link-variant"
                  size="small"
                  variant="text"
                  color="warning"
                  @click="openConnectDialog(account)"
                />
              </template>
            </v-tooltip>
            <v-tooltip
              v-if="account.isConnected && !account.needsReconnect"
              text="Synchroniser les annonces"
            >
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-sync"
                  size="small"
                  variant="text"
                  color="primary"
                  :loading="isSyncing(account._id)"
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

    <v-dialog v-model="connectDialog" max-width="500" persistent>
      <v-card>
        <v-card-title>Connecter un compte</v-card-title>
        <v-card-text>
          <v-form ref="formRef" @submit.prevent="submitConnect">
            <v-select
              v-model="formPlatform"
              :items="platformItems"
              label="Plateforme"
              variant="outlined"
              density="comfortable"
              :disabled="connecting"
            />
            <v-text-field
              v-model="formEmail"
              label="Email"
              type="email"
              variant="outlined"
              density="comfortable"
              :rules="[v => !!v || 'Email requis']"
              :disabled="connecting"
              autocomplete="email"
            />
            <v-text-field
              v-model="formPassword"
              label="Mot de passe"
              type="password"
              variant="outlined"
              density="comfortable"
              :rules="[v => !!v || 'Mot de passe requis']"
              :disabled="connecting"
              autocomplete="current-password"
            />
            <v-alert
              v-if="connecting"
              type="info"
              variant="tonal"
              class="mt-2"
            >
              Connexion en cours, cela peut prendre 5-10 secondes…
              <v-progress-linear indeterminate class="mt-2" />
            </v-alert>
            <v-alert
              v-if="formError"
              type="error"
              variant="tonal"
              class="mt-2"
            >
              {{ formError }}
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="connecting" @click="closeConnectDialog">Annuler</v-btn>
          <v-btn
            color="primary"
            :loading="connecting"
            :disabled="!canSubmit"
            @click="submitConnect"
          >
            Se connecter
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Platform } from '@crosspost/shared';
import apiClient from '@/api/client';

interface SyncEvent {
  type: 'queued' | 'started' | 'completed' | 'failed';
  accountId: string;
  trigger: 'login' | 'manual';
  result?: {
    found: number;
    created: number;
    skipped: number;
    removed: number;
    errors: number;
  };
  error?: string;
}

interface AccountSummary {
  _id: string;
  platform: Platform;
  email: string;
  externalUserId: string;
  isConnected: boolean;
  needsReconnect: boolean;
  connectedAt: string;
  tokenExpiresAt: string;
  lastRefreshedAt?: string;
}

const platformItems = [
  { title: 'Leboncoin', value: Platform.LEBONCOIN },
  { title: 'Vinted', value: Platform.VINTED },
];

const accounts = ref<AccountSummary[]>([]);
const error = ref('');
const removingId = ref<string | null>(null);
const syncingAccountIds = ref<Set<string>>(new Set());
const syncMessage = ref('');
let syncEventSource: EventSource | null = null;

const connectDialog = ref(false);
const formPlatform = ref<Platform>(Platform.LEBONCOIN);
const formEmail = ref('');
const formPassword = ref('');
const connecting = ref(false);
const formError = ref('');

const canSubmit = computed(
  () => !!formEmail.value && !!formPassword.value && !connecting.value,
);

async function fetchAccounts() {
  try {
    const { data } = await apiClient.get<AccountSummary[]>('/accounts');
    accounts.value = data;
  } catch {
    error.value = 'Impossible de récupérer les comptes';
  }
}

function openConnectDialog(account?: AccountSummary) {
  formError.value = '';
  formPlatform.value = account?.platform ?? Platform.LEBONCOIN;
  formEmail.value = account?.email ?? '';
  formPassword.value = '';
  connectDialog.value = true;
}

function closeConnectDialog() {
  if (connecting.value) return;
  connectDialog.value = false;
  formError.value = '';
  formPassword.value = '';
}

async function submitConnect() {
  if (!canSubmit.value) return;
  connecting.value = true;
  formError.value = '';
  try {
    await apiClient.post('/accounts/connect', {
      platform: formPlatform.value,
      email: formEmail.value,
      password: formPassword.value,
    });
    connectDialog.value = false;
    formPassword.value = '';
    await fetchAccounts();
  } catch (err: any) {
    const message =
      err?.response?.data?.message ??
      err?.message ??
      'La connexion a échoué';
    formError.value = Array.isArray(message) ? message.join(', ') : message;
  } finally {
    connecting.value = false;
  }
}

async function removeAccount(id: string) {
  removingId.value = id;
  try {
    await apiClient.delete(`/accounts/${id}`);
    await fetchAccounts();
  } catch {
    error.value = 'Suppression échouée';
  } finally {
    removingId.value = null;
  }
}

async function syncAccount(accountId: string) {
  syncMessage.value = '';
  error.value = '';
  try {
    await apiClient.post(`/sync/${accountId}`);
    // L'event 'queued' arrivera via SSE et activera le spinner.
  } catch {
    error.value = 'Impossible de lancer la synchronisation';
  }
}

function isSyncing(accountId: string): boolean {
  return syncingAccountIds.value.has(accountId);
}

function openSyncStream() {
  closeSyncStream();
  // Cookies de session envoyés automatiquement avec EventSource (withCredentials).
  syncEventSource = new EventSource('/api/sync/events', {
    withCredentials: true,
  });
  syncEventSource.onmessage = (e) => handleSyncEvent(JSON.parse(e.data));
  syncEventSource.onerror = () => {
    // Reconnect automatique géré par EventSource ; on log juste
    // eslint-disable-next-line no-console
    console.warn('[sync] SSE connection lost, attempting reconnect');
  };
}

function closeSyncStream() {
  if (syncEventSource) {
    syncEventSource.close();
    syncEventSource = null;
  }
}

function handleSyncEvent(event: SyncEvent) {
  const next = new Set(syncingAccountIds.value);
  if (event.type === 'queued' || event.type === 'started') {
    next.add(event.accountId);
  } else {
    next.delete(event.accountId);
  }
  syncingAccountIds.value = next;

  if (event.type === 'completed' && event.result) {
    const { found, created, skipped, removed, errors } = event.result;
    const trig = event.trigger === 'login' ? 'auto' : 'manuel';
    syncMessage.value = `Sync ${trig} : ${found} annonces, ${created} nouvelles${skipped ? `, ${skipped} déjà présentes` : ''}${removed ? `, ${removed} supprimées` : ''}${errors ? ` (${errors} erreurs)` : ''}.`;
    void fetchAccounts();
  } else if (event.type === 'failed') {
    error.value = event.error ?? 'La synchronisation a échoué';
  }
}

function statusColor(account: AccountSummary): string {
  if (account.needsReconnect) return 'warning';
  return account.isConnected ? 'success' : 'error';
}

function statusLabel(account: AccountSummary): string {
  if (account.needsReconnect) return 'Reconnexion nécessaire';
  return account.isConnected ? 'Connecté' : 'Déconnecté';
}

function formatDate(value?: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('fr-FR');
}

onMounted(() => {
  void fetchAccounts();
  openSyncStream();
});

onUnmounted(closeSyncStream);
</script>
