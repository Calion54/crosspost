<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h4">Mes annonces</h1>
      <v-spacer />
      <v-select
        v-if="accountOptions.length"
        v-model="selectedAccountId"
        :items="accountOptions"
        label="Filtrer par compte"
        clearable
        density="compact"
        hide-details
        class="mr-4"
        style="max-width: 250px"
      />
      <v-btn color="primary" prepend-icon="mdi-plus" to="/listings/new">
        Nouvelle annonce
      </v-btn>
    </div>

    <v-table>
      <thead>
        <tr>
          <th>Titre</th>
          <th>Prix</th>
          <th>Publication</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!filteredListings.length">
          <td colspan="4" class="text-center text-medium-emphasis pa-4">
            Aucune annonce pour le moment
          </td>
        </tr>
        <tr v-for="listing in filteredListings" :key="listing._id">
          <td>{{ listing.title }}</td>
          <td>{{ listing.price }} EUR</td>
          <td>
            <!-- Platform publication status chips -->
            <div class="d-flex ga-1 align-center">
              <v-chip
                v-for="pub in listing.publications"
                :key="pub._id"
                :color="statusColor(pub.status)"
                :href="pub.externalUrl || undefined"
                :target="pub.externalUrl ? '_blank' : undefined"
                size="small"
                :prepend-icon="platformIcon(pub.platform)"
              >
                {{ platformLabel(pub.platform) }}
                <template #append>
                  <v-icon
                    v-if="pub.status === 'published'"
                    size="x-small"
                    class="ml-1"
                  >mdi-check-circle</v-icon>
                  <v-icon
                    v-else-if="pub.status === 'failed'"
                    size="x-small"
                    class="ml-1"
                  >mdi-alert-circle</v-icon>
                </template>
              </v-chip>

              <!-- Show missing platforms as "not published" -->
              <v-chip
                v-for="platform in missingPlatforms(listing)"
                :key="platform"
                size="small"
                variant="outlined"
                :prepend-icon="platformIcon(platform)"
              >
                {{ platformLabel(platform) }}
              </v-chip>
            </div>
          </td>
          <td>
            <v-tooltip text="Modifier">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  :to="`/listings/${listing._id}`"
                />
              </template>
            </v-tooltip>

            <!-- Publish menu -->
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-publish"
                  size="small"
                  variant="text"
                  color="primary"
                  :disabled="!canPublish(listing)"
                />
              </template>
              <v-list density="compact">
                <v-list-item
                  v-for="acc in publishableAccounts(listing)"
                  :key="acc._id"
                  :prepend-icon="platformIcon(acc.platform)"
                  :title="`Publier sur ${platformLabel(acc.platform)}`"
                  :subtitle="acc.username"
                  :disabled="publishing[listing._id]"
                  @click="onPublish(listing._id, acc._id, acc.platform)"
                />
                <v-list-item
                  v-if="publishableAccounts(listing).length === 0"
                  title="Aucun compte disponible"
                  disabled
                />
              </v-list>
            </v-menu>

            <v-tooltip text="Supprimer">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click="removeListing(listing._id)"
                />
              </template>
            </v-tooltip>
          </td>
        </tr>
      </tbody>
    </v-table>

    <!-- Publish progress dialog -->
    <v-dialog v-model="publishDialog.show" max-width="400" persistent>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon :icon="platformIcon(publishDialog.platform)" class="mr-2" />
          Publication en cours
        </v-card-title>
        <v-card-text>
          <div class="d-flex align-center mb-2">
            <v-progress-circular
              v-if="publishDialog.status === 'publishing'"
              indeterminate
              size="20"
              width="2"
              class="mr-3"
            />
            <v-icon
              v-else-if="publishDialog.status === 'success'"
              color="success"
              class="mr-3"
            >mdi-check-circle</v-icon>
            <v-icon
              v-else-if="publishDialog.status === 'error'"
              color="error"
              class="mr-3"
            >mdi-alert-circle</v-icon>
            <span>{{ publishDialog.stepLabel }}</span>
          </div>
          <p v-if="publishDialog.error" class="text-error text-caption mt-2">
            {{ publishDialog.error }}
          </p>
          <p v-if="publishDialog.externalUrl" class="mt-2">
            <a :href="publishDialog.externalUrl" target="_blank">
              Voir l'annonce publiee
            </a>
          </p>
        </v-card-text>
        <v-card-actions v-if="publishDialog.status !== 'publishing'">
          <v-spacer />
          <v-btn @click="closePublishDialog">Fermer</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import apiClient from '@/api/client';

const listings = ref<any[]>([]);
const accounts = ref<any[]>([]);
const selectedAccountId = ref<string | null>(null);
const publishing = reactive<Record<string, boolean>>({});
const snackbar = reactive({ show: false, text: '', color: 'success' });

const publishDialog = reactive({
  show: false,
  status: '' as string,
  platform: '' as string,
  stepLabel: '',
  error: '',
  externalUrl: '',
});

let pollTimer: ReturnType<typeof setInterval> | null = null;

const STEP_LABELS: Record<string, string> = {
  starting: 'Demarrage...',
  navigating: 'Navigation vers le formulaire...',
  filling_form: 'Remplissage du formulaire...',
  uploading_images: 'Upload des photos...',
  pre_submit_review: 'Verification avant soumission...',
  submitting: 'Soumission de l\'annonce...',
  verifying: 'Verification de la publication...',
};

const accountOptions = computed(() =>
  accounts.value.map((a) => ({
    title: `${a.platform} — ${a.username}`,
    value: a._id,
  })),
);

const filteredListings = computed(() => {
  if (!selectedAccountId.value) return listings.value;
  return listings.value.filter((l) =>
    l.publications.some(
      (p: any) =>
        p.accountId?._id === selectedAccountId.value ||
        p.accountId === selectedAccountId.value,
    ),
  );
});

function platformIcon(platform: string) {
  if (platform === 'leboncoin') return 'mdi-alpha-l-box';
  if (platform === 'vinted') return 'mdi-alpha-v-box';
  return 'mdi-web';
}

function platformLabel(platform: string) {
  if (platform === 'leboncoin') return 'Leboncoin';
  if (platform === 'vinted') return 'Vinted';
  return platform;
}

function statusColor(status: string) {
  const colors: Record<string, string> = {
    published: 'success',
    draft: 'default',
    pending: 'warning',
    failed: 'error',
    removed: 'grey',
  };
  return colors[status] || 'default';
}

/** Platforms where this listing has NOT been published yet */
function missingPlatforms(listing: any): string[] {
  const published = new Set(
    listing.publications
      .filter((p: any) => p.status === 'published')
      .map((p: any) => p.platform || p.accountId?.platform),
  );
  return ['leboncoin', 'vinted'].filter((p) => !published.has(p));
}

/** Accounts where this listing can still be published */
function publishableAccounts(listing: any): any[] {
  const publishedPlatforms = new Set(
    listing.publications
      .filter((p: any) => ['published', 'pending'].includes(p.status))
      .map((p: any) => p.platform || p.accountId?.platform),
  );
  return accounts.value.filter(
    (a) => a.isConnected && !publishedPlatforms.has(a.platform),
  );
}

function canPublish(listing: any): boolean {
  return publishableAccounts(listing).length > 0 && !publishing[listing._id];
}

async function onPublish(listingId: string, accountId: string, platform: string) {
  publishing[listingId] = true;
  publishDialog.show = true;
  publishDialog.status = 'publishing';
  publishDialog.platform = platform;
  publishDialog.stepLabel = STEP_LABELS['starting'];
  publishDialog.error = '';
  publishDialog.externalUrl = '';

  try {
    const { data } = await apiClient.post('/publish', { listingId, accountId });
    const sessionId = data.sessionId;

    // Poll for status
    pollTimer = setInterval(async () => {
      try {
        const { data: status } = await apiClient.get(`/publish/${sessionId}/status`);
        publishDialog.stepLabel = STEP_LABELS[status.step] || status.step || '';

        if (status.status === 'success') {
          publishDialog.status = 'success';
          publishDialog.stepLabel = 'Annonce publiee avec succes !';
          publishDialog.externalUrl = status.externalUrl || '';
          stopPolling();
          publishing[listingId] = false;
          await fetchData();
        } else if (status.status === 'error') {
          publishDialog.status = 'error';
          publishDialog.stepLabel = 'Echec de la publication';
          publishDialog.error = status.error || 'Erreur inconnue';
          stopPolling();
          publishing[listingId] = false;
        }
      } catch {
        // Polling error, continue
      }
    }, 2000);
  } catch (err: any) {
    publishDialog.status = 'error';
    publishDialog.stepLabel = 'Echec de la publication';
    publishDialog.error = err.response?.data?.message || err.message;
    publishing[listingId] = false;
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function closePublishDialog() {
  publishDialog.show = false;
  stopPolling();
}

async function fetchData() {
  const [listingsRes, accountsRes] = await Promise.all([
    apiClient.get('/listings'),
    apiClient.get('/accounts'),
  ]);
  listings.value = listingsRes.data;
  accounts.value = accountsRes.data;
}

async function removeListing(id: string) {
  await apiClient.delete(`/listings/${id}`);
  await fetchData();
}

onMounted(fetchData);
onUnmounted(stopPolling);
</script>
