<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h4">Mes annonces</h1>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" to="/listings/new">
        Nouvelle annonce
      </v-btn>
    </div>

    <v-table>
      <thead>
        <tr>
          <th style="width: 80px"></th>
          <th>Titre</th>
          <th>Prix</th>
          <th>Plateformes</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!listings.length">
          <td colspan="5" class="text-center text-medium-emphasis pa-4">
            Aucune annonce pour le moment
          </td>
        </tr>
        <tr v-for="listing in listings" :key="listing._id">
          <td>
            <v-img
              v-if="listing.mediaUrls?.length"
              :src="listing.mediaUrls[0]"
              width="60"
              height="60"
              cover
              class="rounded my-1"
            />
            <div
              v-else
              class="d-flex align-center justify-center rounded bg-grey-lighten-3 my-1"
              style="width: 60px; height: 60px"
            >
              <v-icon color="grey" size="24">mdi-image-off</v-icon>
            </div>
          </td>
          <td>{{ listing.title }}</td>
          <td>{{ listing.price }} &euro;</td>
          <td>
            <div class="d-flex ga-3 align-center">
              <v-tooltip
                v-for="platform in ALL_PLATFORMS"
                :key="platform"
                :text="platformTooltip(listing, platform)"
              >
                <template #activator="{ props: tooltipProps }">
                  <a
                    v-bind="tooltipProps"
                    :href="getPublicationUrl(listing, platform) || undefined"
                    :target="getPublicationUrl(listing, platform) ? '_blank' : undefined"
                    class="d-inline-block"
                    :style="{ opacity: getPublicationStatus(listing, platform) ? 1 : 0.35 }"
                  >
                    <v-badge
                      :color="platformBadgeColor(listing, platform)"
                      dot
                      location="bottom end"
                      offset-x="2"
                      offset-y="2"
                    >
                      <v-avatar size="28" rounded="lg">
                        <v-img :src="platformImage(platform)" :alt="platformLabel(platform)" />
                      </v-avatar>
                    </v-badge>
                  </a>
                </template>
              </v-tooltip>
            </div>
          </td>
          <td>
            <v-tooltip text="Publier">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  icon="mdi-publish"
                  size="small"
                  variant="text"
                  color="primary"
                  @click="openPublishModal(listing)"
                />
              </template>
            </v-tooltip>
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

    <div v-if="totalPages > 1" class="d-flex justify-center mt-4">
      <v-pagination v-model="page" :length="totalPages" rounded />
    </div>

    <!-- Publish modal — select accounts with checkboxes -->
    <v-dialog v-model="publishModal.show" max-width="450">
      <v-card>
        <v-card-title>Publier l'annonce</v-card-title>
        <v-card-subtitle v-if="publishModal.listing" class="pb-0">
          {{ publishModal.listing.title }}
        </v-card-subtitle>
        <v-card-text>
          <template v-if="publishModal.accounts.length">
            <v-list select-strategy="classic" v-model:selected="publishModal.selected">
              <v-list-item
                v-for="acc in publishModal.accounts"
                :key="acc._id"
                :value="acc._id"
              >
                <template #prepend="{ isActive }">
                  <v-list-item-action start>
                    <v-checkbox-btn :model-value="isActive" />
                  </v-list-item-action>
                  <img
                    :src="platformImage(acc.platform)"
                    :alt="platformLabel(acc.platform)"
                    width="28"
                    height="28"
                    class="rounded mr-3"
                  />
                </template>
                <v-list-item-title>{{ platformLabel(acc.platform) }}</v-list-item-title>
                <v-list-item-subtitle>{{ acc.username }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>

            <!-- Progress per account -->
            <div v-if="Object.keys(publishSessions).length" class="mt-2">
              <div
                v-for="session in Object.values(publishSessions)"
                :key="session.accountId"
                class="d-flex align-center mb-2"
              >
                <img
                  :src="platformImage(session.platform)"
                  width="20"
                  height="20"
                  class="rounded mr-2"
                />
                <v-progress-circular
                  v-if="session.status === 'publishing'"
                  indeterminate
                  size="16"
                  width="2"
                  class="mr-2"
                />
                <v-icon v-else-if="session.status === 'success'" color="success" size="16" class="mr-2">mdi-check-circle</v-icon>
                <v-icon v-else-if="session.status === 'error'" color="error" size="16" class="mr-2">mdi-alert-circle</v-icon>
                <span class="text-body-2">{{ session.stepLabel }}</span>
              </div>
            </div>
          </template>
          <p v-else class="text-medium-emphasis text-center pa-4">
            Aucun compte connecte. <router-link to="/accounts">Ajouter un compte</router-link>
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="closePublishModal">Fermer</v-btn>
          <v-btn
            v-if="publishModal.accounts.length"
            color="primary"
            :disabled="!publishModal.selected.length || isPublishing"
            :loading="isPublishing"
            @click="onPublish"
          >
            Publier ({{ publishModal.selected.length }})
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import apiClient from '@/api/client';
import leboncoinIcon from '@/assets/leboncoin.png';
import vintedIcon from '@/assets/vinted.png';

const ALL_PLATFORMS = ['leboncoin', 'vinted'];
const PER_PAGE = 20;

const listings = ref<any[]>([]);
const accounts = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const snackbar = reactive({ show: false, text: '', color: 'success' });

const publishModal = reactive({
  show: false,
  listing: null as any,
  accounts: [] as any[],
  selected: [] as string[],
});

interface PublishSessionState {
  accountId: string;
  platform: string;
  sessionId: string;
  status: 'publishing' | 'success' | 'error';
  stepLabel: string;
}

const publishSessions = reactive<Record<string, PublishSessionState>>({});
const pollTimers = new Map<string, ReturnType<typeof setInterval>>();

const isPublishing = computed(() =>
  Object.values(publishSessions).some((s) => s.status === 'publishing'),
);

const STEP_LABELS: Record<string, string> = {
  starting: 'Demarrage...',
  navigating: 'Navigation vers le formulaire...',
  filling_form: 'Remplissage du formulaire...',
  uploading_images: 'Upload des photos...',
  pre_submit_review: 'Verification avant soumission...',
  submitting: 'Soumission de l\'annonce...',
  verifying: 'Verification de la publication...',
};

const totalPages = computed(() => Math.ceil(total.value / PER_PAGE));

const PLATFORM_IMAGES: Record<string, string> = {
  leboncoin: leboncoinIcon,
  vinted: vintedIcon,
};

function platformImage(platform: string): string {
  return PLATFORM_IMAGES[platform] || '';
}

function platformLabel(platform: string) {
  if (platform === 'leboncoin') return 'Leboncoin';
  if (platform === 'vinted') return 'Vinted';
  return platform;
}

function getPublicationStatus(listing: any, platform: string): string | null {
  if (!listing) return null;
  const pub = listing.publications?.find((p: any) => p.platform === platform);
  return pub?.status || null;
}

function getPublicationUrl(listing: any, platform: string): string | null {
  if (!listing) return null;
  const pub = listing.publications?.find(
    (p: any) => p.platform === platform && p.status === 'published',
  );
  return pub?.externalUrl || null;
}

function platformBadgeColor(listing: any, platform: string): string {
  const status = getPublicationStatus(listing, platform);
  if (status === 'published') return 'success';
  if (status === 'failed') return 'error';
  return 'grey';
}

function platformTooltip(listing: any, platform: string): string {
  const status = getPublicationStatus(listing, platform);
  const label = platformLabel(platform);
  if (status === 'published') return `${label} — Publiee`;
  if (status === 'failed') return `${label} — Echec`;
  if (status === 'pending') return `${label} — En cours`;
  return `${label} — Non publiee`;
}

function openPublishModal(listing: any) {
  const publishedPlatforms = new Set(
    listing.publications
      ?.filter((p: any) => ['published', 'pending'].includes(p.status))
      .map((p: any) => p.platform) || [],
  );
  const available = accounts.value.filter(
    (a) => a.isConnected && !publishedPlatforms.has(a.platform),
  );
  publishModal.listing = listing;
  publishModal.accounts = available;
  publishModal.selected = available.map((a) => a._id);
  // Clear previous sessions
  for (const key of Object.keys(publishSessions)) delete publishSessions[key];
  publishModal.show = true;
}

async function onPublish() {
  const listingId = publishModal.listing._id;
  const selectedAccounts = publishModal.accounts.filter((a) =>
    publishModal.selected.includes(a._id),
  );

  for (const acc of selectedAccounts) {
    try {
      const session: PublishSessionState = {
        accountId: acc._id,
        platform: acc.platform,
        sessionId: '',
        status: 'publishing',
        stepLabel: STEP_LABELS['starting'],
      };
      publishSessions[acc._id] = session;

      const { data } = await apiClient.post('/publish', { listingId, accountId: acc._id });
      session.sessionId = data.sessionId;

      const timer = setInterval(async () => {
        try {
          const { data: status } = await apiClient.get(`/publish/${session.sessionId}/status`);
          session.stepLabel = STEP_LABELS[status.step] || status.step || '';

          if (status.status === 'success') {
            session.status = 'success';
            session.stepLabel = 'Publiee !';
            clearInterval(timer);
            pollTimers.delete(acc._id);
            await fetchData();
          } else if (status.status === 'error') {
            session.status = 'error';
            session.stepLabel = status.error || 'Erreur';
            clearInterval(timer);
            pollTimers.delete(acc._id);
          }
        } catch {
          // Polling error, continue
        }
      }, 2000);
      pollTimers.set(acc._id, timer);
    } catch (err: any) {
      publishSessions[acc._id] = {
        accountId: acc._id,
        platform: acc.platform,
        sessionId: '',
        status: 'error',
        stepLabel: err.response?.data?.message || err.message,
      };
    }
  }
}

function stopAllPolling() {
  for (const [key, timer] of pollTimers) {
    clearInterval(timer);
    pollTimers.delete(key);
  }
}

function closePublishModal() {
  publishModal.show = false;
  stopAllPolling();
}

async function fetchData() {
  const [listingsRes, accountsRes] = await Promise.all([
    apiClient.get('/listings', { params: { page: page.value, limit: PER_PAGE } }),
    apiClient.get('/accounts'),
  ]);
  listings.value = listingsRes.data.items;
  total.value = listingsRes.data.total;
  accounts.value = accountsRes.data;
}

watch(page, fetchData);

async function removeListing(id: string) {
  await apiClient.delete(`/listings/${id}`);
  await fetchData();
}

onMounted(fetchData);
onUnmounted(stopAllPolling);
</script>

