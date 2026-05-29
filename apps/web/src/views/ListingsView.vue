<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h4">Mes annonces</h1>
      <v-spacer />
      <v-text-field
        v-model="search"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        placeholder="Rechercher un titre…"
        prepend-inner-icon="mdi-magnify"
        style="max-width: 320px"
        class="mr-3"
      />
      <v-select
        v-model="sort"
        :items="SORT_OPTIONS"
        item-title="label"
        item-value="value"
        density="compact"
        variant="outlined"
        hide-details
        prepend-inner-icon="mdi-sort"
        style="max-width: 260px"
        class="mr-3"
      />
      <v-btn color="primary" prepend-icon="mdi-plus" to="/listings/new">
        Nouvelle annonce
      </v-btn>
    </div>

    <div class="d-flex align-center mb-4 ga-3 flex-wrap">
      <v-select
        v-model="selectedPlatforms"
        :items="PLATFORM_OPTIONS"
        item-title="label"
        item-value="value"
        density="compact"
        variant="outlined"
        hide-details
        chips
        closable-chips
        multiple
        clearable
        label="Plateformes"
        style="min-width: 240px; max-width: 340px"
      />
      <v-autocomplete
        v-model="selectedAccountIds"
        :items="accountOptions"
        item-title="label"
        item-value="_id"
        density="compact"
        variant="outlined"
        hide-details
        chips
        closable-chips
        multiple
        clearable
        label="Comptes"
        style="min-width: 280px; max-width: 460px"
      />
      <v-switch
        v-model="unpublishedOnly"
        density="compact"
        hide-details
        color="primary"
        label="Non publiées uniquement"
      />
      <v-spacer />
      <v-btn
        v-if="hasActiveFilters"
        size="small"
        variant="text"
        prepend-icon="mdi-filter-remove"
        @click="clearFilters"
      >
        Réinitialiser
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
            <div class="d-flex ga-2 align-center flex-wrap">
              <v-tooltip
                v-for="entry in getPlatformEntries(listing)"
                :key="entry.key"
                :text="entry.tooltip"
              >
                <template #activator="{ props: tooltipProps }">
                  <a
                    v-bind="tooltipProps"
                    :href="entry.url || undefined"
                    :target="entry.url ? '_blank' : undefined"
                    class="d-inline-block"
                    :style="{ opacity: entry.published ? 1 : 0.35 }"
                  >
                    <v-badge
                      :color="entry.published ? 'success' : 'grey'"
                      dot
                      location="bottom end"
                      offset-x="2"
                      offset-y="2"
                    >
                      <v-avatar size="28" rounded="lg">
                        <v-img :src="platformImage(entry.platform)" :alt="platformLabel(entry.platform)" />
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
                  @click="openDeleteModal(listing)"
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
                :disabled="acc.alreadyPublished"
              >
                <template #prepend="{ isActive }">
                  <v-list-item-action start>
                    <v-checkbox-btn :model-value="isActive" :disabled="acc.alreadyPublished" />
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
                <v-list-item-subtitle>{{ acc.email }}</v-list-item-subtitle>
                <template #append>
                  <v-chip
                    v-if="acc.alreadyPublished"
                    size="x-small"
                    color="success"
                    variant="tonal"
                  >
                    Déjà publié
                  </v-chip>
                </template>
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

    <!-- Delete modal — granular per-publication + cascade -->
    <v-dialog v-model="deleteModal.show" max-width="500">
      <v-card>
        <v-card-title>Gérer la suppression</v-card-title>
        <v-card-subtitle v-if="deleteModal.listing" class="pb-0">
          {{ deleteModal.listing.title }}
        </v-card-subtitle>
        <v-card-text>
          <p v-if="!deleteModal.publications.length" class="text-medium-emphasis mb-3">
            Cette annonce n'est publiée nulle part.
          </p>
          <template v-else>
            <p class="text-body-2 mb-2">Publications à supprimer :</p>
            <v-list select-strategy="classic" v-model:selected="deleteModal.selectedPubIds">
              <v-list-item
                v-for="pub in deleteModal.publications"
                :key="pub._id"
                :value="pub._id"
                :disabled="deleteModal.crosspost"
              >
                <template #prepend="{ isActive }">
                  <v-list-item-action start>
                    <v-checkbox-btn
                      :model-value="isActive"
                      :disabled="deleteModal.crosspost"
                    />
                  </v-list-item-action>
                  <img
                    :src="platformImage(pub.platform)"
                    width="28"
                    height="28"
                    class="rounded mr-3"
                  />
                </template>
                <v-list-item-title>{{ platformLabel(pub.platform) }}</v-list-item-title>
                <v-list-item-subtitle>{{ pub.accountId.email }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <v-divider class="my-2" />
          </template>
          <v-checkbox
            v-model="deleteModal.crosspost"
            density="compact"
            hide-details
            color="error"
            label="Supprimer aussi l'annonce de Crosspost (cascade)"
          />
          <p v-if="deleteModal.crosspost" class="text-caption text-medium-emphasis mt-2">
            Toutes les publications restantes seront supprimées des plateformes.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="deleteModal.busy" @click="closeDeleteModal">
            Annuler
          </v-btn>
          <v-btn
            color="error"
            :disabled="!canConfirmDelete || deleteModal.busy"
            :loading="deleteModal.busy"
            @click="onConfirmDelete"
          >
            Supprimer
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
import { useRoute, useRouter } from 'vue-router';
import {
  DEFAULT_LISTING_SORT,
  Platform,
  PublicationStatus,
  listingSortSchema,
  type AccountResponse,
  type ListingResponse,
  type ListingSort,
  type PaginatedListingsResponse,
  type PublicationResponse,
} from '@crosspost/shared';
import apiClient from '@/api/client';
import leboncoinIcon from '@/assets/leboncoin.png';
import vintedIcon from '@/assets/vinted.png';

const ALL_PLATFORMS: Platform[] = [Platform.LEBONCOIN, Platform.VINTED];
const PER_PAGE = 20;

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'createdAt:desc', label: 'Création — récent d\'abord' },
  { value: 'createdAt:asc', label: 'Création — ancien d\'abord' },
  { value: 'publishedAt:asc', label: 'Publication — ancien d\'abord' },
  { value: 'publishedAt:desc', label: 'Publication — récent d\'abord' },
];

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: Platform.LEBONCOIN, label: 'Leboncoin' },
  { value: Platform.VINTED, label: 'Vinted' },
];

function parseSort(value: unknown): ListingSort {
  const parsed = listingSortSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_LISTING_SORT;
}

function parsePlatforms(value: unknown): Platform[] {
  const arr = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  return arr.filter((p): p is Platform =>
    Object.values(Platform).includes(p as Platform),
  );
}

function parseStringArray(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  return arr.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

const route = useRoute();
const router = useRouter();

const initialPage = Number(route.query.page);
const initialSearch =
  typeof route.query.q === 'string' ? route.query.q : '';
const initialSort = parseSort(route.query.sort);

const listings = ref<ListingResponse[]>([]);
const accounts = ref<AccountResponse[]>([]);
const total = ref(0);
const page = ref(Number.isFinite(initialPage) && initialPage >= 1 ? initialPage : 1);
const search = ref(initialSearch);
const debouncedSearch = ref(initialSearch);
const sort = ref<ListingSort>(initialSort);
const selectedPlatforms = ref<Platform[]>(parsePlatforms(route.query.platforms));
const selectedAccountIds = ref<string[]>(
  parseStringArray(route.query.accountIds),
);
const unpublishedOnly = ref<boolean>(route.query.unpublishedOnly === 'true');

const accountOptions = computed(() =>
  accounts.value.map((a) => ({
    _id: a._id,
    label: `${platformLabel(a.platform)} · ${a.email}`,
  })),
);

const hasActiveFilters = computed(
  () =>
    selectedPlatforms.value.length > 0 ||
    selectedAccountIds.value.length > 0 ||
    unpublishedOnly.value,
);

function clearFilters() {
  selectedPlatforms.value = [];
  selectedAccountIds.value = [];
  unpublishedOnly.value = false;
}
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const snackbar = reactive({ show: false, text: '', color: 'success' });

interface PublishModalAccount extends AccountResponse {
  alreadyPublished: boolean;
}

interface PublishModalState {
  show: boolean;
  listing: ListingResponse | null;
  accounts: PublishModalAccount[];
  selected: string[];
}

const publishModal = reactive<PublishModalState>({
  show: false,
  listing: null,
  accounts: [],
  selected: [],
});

interface PublishSessionState {
  accountId: string;
  platform: Platform;
  status: 'publishing' | 'success' | 'error';
  stepLabel: string;
}

const publishSessions = reactive<Record<string, PublishSessionState>>({});

const isPublishing = computed(() =>
  Object.values(publishSessions).some((s) => s.status === 'publishing'),
);

interface DeleteModalState {
  show: boolean;
  busy: boolean;
  listing: ListingResponse | null;
  publications: PublicationResponse[];
  selectedPubIds: string[];
  crosspost: boolean;
}

const deleteModal = reactive<DeleteModalState>({
  show: false,
  busy: false,
  listing: null,
  publications: [],
  selectedPubIds: [],
  crosspost: false,
});

const canConfirmDelete = computed(
  () => deleteModal.crosspost || deleteModal.selectedPubIds.length > 0,
);

const totalPages = computed(() => Math.ceil(total.value / PER_PAGE));

const PLATFORM_IMAGES: Record<Platform, string> = {
  [Platform.LEBONCOIN]: leboncoinIcon,
  [Platform.VINTED]: vintedIcon,
};

function platformImage(platform: Platform): string {
  return PLATFORM_IMAGES[platform] || '';
}

function platformLabel(platform: Platform): string {
  if (platform === Platform.LEBONCOIN) return 'Leboncoin';
  if (platform === Platform.VINTED) return 'Vinted';
  return platform;
}

interface PlatformEntry {
  key: string;
  platform: Platform;
  published: boolean;
  email: string | null;
  url: string | null;
  tooltip: string;
}

function isPublished(pub: PublicationResponse): boolean {
  return pub.status === PublicationStatus.PUBLISHED;
}

function getPlatformEntries(listing: ListingResponse): PlatformEntry[] {
  const entries: PlatformEntry[] = [];
  const publishedByPlatform = new Map<Platform, PublicationResponse[]>();
  for (const pub of listing.publications) {
    if (!isPublished(pub)) continue;
    const arr = publishedByPlatform.get(pub.platform) ?? [];
    arr.push(pub);
    publishedByPlatform.set(pub.platform, arr);
  }

  for (const platform of ALL_PLATFORMS) {
    const pubs = publishedByPlatform.get(platform) ?? [];
    if (!pubs.length) {
      entries.push({
        key: `${listing._id}:${platform}:empty`,
        platform,
        published: false,
        email: null,
        url: null,
        tooltip: `${platformLabel(platform)} — Non publiée`,
      });
      continue;
    }
    for (const pub of pubs) {
      const email = pub.accountId.email;
      entries.push({
        key: `${listing._id}:${platform}:${pub.accountId._id}`,
        platform,
        published: true,
        email,
        url: pub.externalUrl ?? null,
        tooltip: `${platformLabel(platform)} · ${email} — Publiée`,
      });
    }
  }
  return entries;
}

function openPublishModal(listing: ListingResponse) {
  const publishedAccountIds = new Set(
    listing.publications.filter(isPublished).map((p) => p.accountId._id),
  );
  publishModal.listing = listing;
  publishModal.accounts = accounts.value
    .filter((a) => a.isConnected)
    .map((a) => ({ ...a, alreadyPublished: publishedAccountIds.has(a._id) }));
  publishModal.selected = publishModal.accounts
    .filter((a) => !a.alreadyPublished)
    .map((a) => a._id);
  for (const key of Object.keys(publishSessions)) delete publishSessions[key];
  publishModal.show = true;
}

async function onPublish() {
  if (!publishModal.listing) return;
  const listingId = publishModal.listing._id;
  const selectedAccounts = publishModal.accounts.filter((a) =>
    publishModal.selected.includes(a._id),
  );

  // Publish synchrone (Étape 4) — ~10-30s par compte. Étape 5 passera en BullMQ + SSE.
  // On lance en parallèle (Promise.all) mais chaque compte attend sa réponse.
  await Promise.all(
    selectedAccounts.map(async (acc) => {
      publishSessions[acc._id] = {
        accountId: acc._id,
        platform: acc.platform,
        status: 'publishing',
        stepLabel: 'Publication en cours…',
      };
      try {
        const { data } = await apiClient.post<{
          externalId: string;
          externalUrl: string;
        }>('/publish', { listingId, accountId: acc._id });
        publishSessions[acc._id].status = 'success';
        publishSessions[acc._id].stepLabel = `Publiée → ${data.externalUrl}`;
      } catch (err: any) {
        publishSessions[acc._id].status = 'error';
        publishSessions[acc._id].stepLabel =
          err?.response?.data?.message ?? err?.message ?? 'Erreur';
      }
    }),
  );
  await fetchData();
}

function closePublishModal() {
  publishModal.show = false;
}

async function fetchData() {
  const params: Record<string, unknown> = {
    page: page.value,
    limit: PER_PAGE,
    sort: sort.value,
  };
  const q = debouncedSearch.value.trim();
  if (q) params.q = q;
  if (selectedPlatforms.value.length) params.platforms = selectedPlatforms.value;
  if (selectedAccountIds.value.length) params.accountIds = selectedAccountIds.value;
  if (unpublishedOnly.value) params.unpublishedOnly = true;
  const [listingsRes, accountsRes] = await Promise.all([
    apiClient.get<PaginatedListingsResponse>('/listings', { params }),
    apiClient.get<AccountResponse[]>('/accounts'),
  ]);
  listings.value = listingsRes.data.items;
  total.value = listingsRes.data.total;
  accounts.value = accountsRes.data;
}

watch(page, fetchData);

watch(sort, () => {
  if (page.value !== 1) {
    page.value = 1;
  } else {
    fetchData();
  }
});

watch(
  [selectedPlatforms, selectedAccountIds, unpublishedOnly],
  () => {
    if (page.value !== 1) {
      page.value = 1;
    } else {
      fetchData();
    }
  },
  { deep: true },
);

watch(search, (val) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedSearch.value = val ?? '';
    if (page.value !== 1) {
      page.value = 1;
    } else {
      fetchData();
    }
  }, 300);
});

function queryEqualsArray(a: unknown, b: string[]): boolean {
  const cur = Array.isArray(a) ? a : a !== undefined ? [a] : [];
  return cur.length === b.length && cur.every((v, i) => v === b[i]);
}

// Persist page + filters in URL (back/forward restores the view)
watch(
  [page, debouncedSearch, sort, selectedPlatforms, selectedAccountIds, unpublishedOnly],
  ([p, q, s, plats, accs, unpub]) => {
    const next: Record<string, string | string[]> = {};
    if (p > 1) next.page = String(p);
    if (q.trim()) next.q = q.trim();
    if (s !== DEFAULT_LISTING_SORT) next.sort = s;
    if (plats.length) next.platforms = [...plats];
    if (accs.length) next.accountIds = [...accs];
    if (unpub) next.unpublishedOnly = 'true';

    const current = route.query;
    const same =
      String(current.page ?? '') === String(next.page ?? '') &&
      String(current.q ?? '') === String(next.q ?? '') &&
      String(current.sort ?? '') === String(next.sort ?? '') &&
      String(current.unpublishedOnly ?? '') === String(next.unpublishedOnly ?? '') &&
      queryEqualsArray(current.platforms, plats) &&
      queryEqualsArray(current.accountIds, accs);
    if (same) return;
    router.replace({ query: next });
  },
  { deep: true },
);

// React to back/forward navigation
watch(
  () => route.query,
  (query) => {
    const p = Number(query.page);
    const newPage = Number.isFinite(p) && p >= 1 ? p : 1;
    const newSearch = typeof query.q === 'string' ? query.q : '';
    const newSort = parseSort(query.sort);
    const newPlatforms = parsePlatforms(query.platforms);
    const newAccountIds = parseStringArray(query.accountIds);
    const newUnpublishedOnly = query.unpublishedOnly === 'true';

    let needsFetch = false;
    if (newPage !== page.value) page.value = newPage;
    if (newSearch !== debouncedSearch.value) {
      search.value = newSearch;
      debouncedSearch.value = newSearch;
      needsFetch = true;
    }
    if (newSort !== sort.value) {
      sort.value = newSort;
      return; // sort watcher triggers fetch
    }
    if (!queryEqualsArray(newPlatforms, selectedPlatforms.value)) {
      selectedPlatforms.value = newPlatforms;
      return; // filter watcher triggers fetch
    }
    if (!queryEqualsArray(newAccountIds, selectedAccountIds.value)) {
      selectedAccountIds.value = newAccountIds;
      return;
    }
    if (newUnpublishedOnly !== unpublishedOnly.value) {
      unpublishedOnly.value = newUnpublishedOnly;
      return;
    }
    if (needsFetch) fetchData();
  },
);

interface DeleteResult {
  platform: Platform;
  externalId?: string;
  result: {
    status: 'deleted' | 'already_gone' | 'failed';
    message?: string;
  };
}

function describeDeleteResult(r: DeleteResult): { line: string; ok: boolean } {
  const label = platformLabel(r.platform);
  const status = r.result?.status;
  if (status === 'deleted') return { line: `${label} : supprimée ✓`, ok: true };
  if (status === 'already_gone') {
    return {
      line: `${label} : déjà absente (${r.result.message ?? 'HTTP 4xx'})`,
      ok: true,
    };
  }
  return {
    line: `${label} : échec (${r.result?.message ?? status ?? '—'})`,
    ok: false,
  };
}

function openDeleteModal(listing: ListingResponse) {
  const pubs = listing.publications;
  deleteModal.listing = listing;
  deleteModal.publications = pubs;
  deleteModal.selectedPubIds = pubs.map((p) => p._id);
  deleteModal.crosspost = false;
  deleteModal.busy = false;
  deleteModal.show = true;
}

function closeDeleteModal() {
  deleteModal.show = false;
}

async function onConfirmDelete() {
  if (!deleteModal.listing) return;
  deleteModal.busy = true;
  try {
    const lines: string[] = [];
    let allOk = true;

    if (deleteModal.crosspost) {
      // Cascade : backend supprime tout côté plateformes + Crosspost.
      const { data } = await apiClient.delete<{
        listingId: string;
        deleted: boolean;
        results: DeleteResult[];
      }>(`/listings/${deleteModal.listing._id}`);
      for (const r of data.results) {
        const { line, ok } = describeDeleteResult(r);
        lines.push(line);
        if (!ok) allOk = false;
      }
      if (data.deleted) lines.push('Annonce supprimée de Crosspost ✓');
      else if (!allOk) lines.push('Crosspost : annonce conservée (échec plateforme).');
    } else {
      // Partial : un appel par publication sélectionnée.
      const results = await Promise.all(
        deleteModal.selectedPubIds.map(async (pubId) => {
          try {
            const { data } = await apiClient.delete<DeleteResult>(
              `/publications/${pubId}`,
            );
            return data;
          } catch (err: any) {
            const pub = deleteModal.publications.find((p) => p._id === pubId);
            return {
              platform: pub?.platform ?? Platform.LEBONCOIN,
              result: {
                status: 'failed' as const,
                message: err?.response?.data?.message ?? err?.message ?? 'Erreur',
              },
            };
          }
        }),
      );
      for (const r of results) {
        const { line, ok } = describeDeleteResult(r);
        lines.push(line);
        if (!ok) allOk = false;
      }
    }

    snackbar.text = lines.length ? lines.join(' · ') : 'Rien à supprimer';
    snackbar.color = allOk ? 'success' : 'warning';
    snackbar.show = true;
    closeDeleteModal();
    await fetchData();
  } catch (err: any) {
    snackbar.text = err?.response?.data?.message ?? 'Suppression échouée';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    deleteModal.busy = false;
  }
}

onMounted(fetchData);
onUnmounted(() => {
  // rien à nettoyer (la publication est synchrone via await)
});
</script>

