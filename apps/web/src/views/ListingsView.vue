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
      <v-btn-toggle
        v-model="statusFilter"
        density="compact"
        color="primary"
        mandatory
        variant="outlined"
      >
        <v-btn :value="ListingStatusFilter.ALL" size="small">Toutes</v-btn>
        <v-btn :value="ListingStatusFilter.ACTIVE" size="small">Actives</v-btn>
        <v-btn :value="ListingStatusFilter.SOLD" size="small">Vendues</v-btn>
        <v-btn :value="ListingStatusFilter.UNPUBLISHED" size="small">
          Non publiées
        </v-btn>
      </v-btn-toggle>
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
          <td>
            <div class="d-flex align-center ga-2">
              <span>{{ listing.title }}</span>
              <v-chip
                v-if="listing.sold"
                size="x-small"
                color="success"
                variant="flat"
                prepend-icon="mdi-cash-check"
              >
                Vendue
              </v-chip>
            </div>
          </td>
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
                    :style="{ opacity: entry.state === 'none' ? 0.35 : 1 }"
                  >
                    <v-badge
                      :color="ENTRY_BADGE_COLOR[entry.state]"
                      :icon="entry.state === 'sold' ? 'mdi-currency-eur' : undefined"
                      :dot="entry.state !== 'sold'"
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
      <v-pagination
        v-model="page"
        :length="totalPages"
        :total-visible="7"
        rounded
      />
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
                :disabled="acc.alreadyPublished || acc.needsReconnect"
              >
                <template #prepend="{ isActive }">
                  <v-list-item-action start>
                    <!-- Case purement visuelle : on laisse le clic traverser
                         vers la v-list-item (sinon la checkbox capture le clic
                         et la sélection ne se met pas à jour). -->
                    <v-checkbox-btn
                      :model-value="isActive"
                      :disabled="acc.alreadyPublished || acc.needsReconnect"
                      tabindex="-1"
                      style="pointer-events: none"
                    />
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
                    v-if="acc.needsReconnect"
                    size="x-small"
                    color="warning"
                    variant="tonal"
                  >
                    Reconnexion requise
                  </v-chip>
                  <v-chip
                    v-else-if="acc.alreadyPublished"
                    size="x-small"
                    color="success"
                    variant="tonal"
                  >
                    Déjà publié
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
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
            :disabled="!publishModal.selected.length"
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
                    <!-- Case purement visuelle : on laisse le clic traverser
                         vers la v-list-item (sinon la checkbox capture le clic
                         et la sélection ne se met pas à jour → on supprime des
                         plateformes non sélectionnées). -->
                    <v-checkbox-btn
                      :model-value="isActive"
                      :disabled="deleteModal.crosspost"
                      tabindex="-1"
                      style="pointer-events: none"
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
  ListingStatusFilter,
  Platform,
  PublicationStatus,
  listingSortSchema,
  listingStatusFilterSchema,
  type AccountResponse,
  type ListingResponse,
  type ListingSort,
  type PaginatedListingsResponse,
  type PublicationResponse,
} from '@crosspost/shared';
import apiClient from '@/api/client';
import { useAccounts } from '@/composables/accounts';
import {
  PLATFORM_OPTIONS,
  platformImage,
  platformLabel,
} from '@/utils/platform';

const ALL_PLATFORMS: Platform[] = [Platform.LEBONCOIN, Platform.VINTED];
const PER_PAGE = 20;

const SORT_OPTIONS: { value: ListingSort; label: string }[] = [
  { value: 'createdAt:desc', label: 'Récent d\'abord' },
  { value: 'createdAt:asc', label: 'Ancien d\'abord' },
];

function parseSort(value: unknown): ListingSort {
  const parsed = listingSortSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_LISTING_SORT;
}

function parseStatusFilter(value: unknown): ListingStatusFilter {
  const parsed = listingStatusFilterSchema.safeParse(value);
  return parsed.success ? parsed.data : ListingStatusFilter.ALL;
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

const { accounts, fetchAccounts } = useAccounts();

const listings = ref<ListingResponse[]>([]);
const total = ref(0);
const page = ref(Number.isFinite(initialPage) && initialPage >= 1 ? initialPage : 1);
const search = ref(initialSearch);
const debouncedSearch = ref(initialSearch);
const sort = ref<ListingSort>(initialSort);
const selectedPlatforms = ref<Platform[]>(parsePlatforms(route.query.platforms));
const selectedAccountIds = ref<string[]>(
  parseStringArray(route.query.accountIds),
);
const statusFilter = ref<ListingStatusFilter>(
  parseStatusFilter(route.query.statusFilter),
);

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
    statusFilter.value !== ListingStatusFilter.ALL,
);

function clearFilters() {
  selectedPlatforms.value = [];
  selectedAccountIds.value = [];
  statusFilter.value = ListingStatusFilter.ALL;
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

let publishEventSource: EventSource | null = null;

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

type PlatformEntryState = 'none' | 'pending' | 'published' | 'sold';

interface PlatformEntry {
  key: string;
  platform: Platform;
  state: PlatformEntryState;
  email: string | null;
  url: string | null;
  tooltip: string;
}

/** Publication "visible" sur une pastille : en ligne ou vendue. */
function isLive(pub: PublicationResponse): boolean {
  return (
    pub.status === PublicationStatus.PUBLISHED ||
    pub.status === PublicationStatus.SOLD
  );
}

function isPublished(pub: PublicationResponse): boolean {
  return pub.status === PublicationStatus.PUBLISHED;
}

const ENTRY_BADGE_COLOR: Record<PlatformEntryState, string> = {
  none: 'grey',
  pending: 'blue',
  published: 'success',
  sold: 'amber-darken-2',
};

function getPlatformEntries(listing: ListingResponse): PlatformEntry[] {
  const entries: PlatformEntry[] = [];
  const liveByPlatform = new Map<Platform, PublicationResponse[]>();
  const pendingByPlatform = new Map<Platform, PublicationResponse[]>();
  for (const pub of listing.publications) {
    if (isLive(pub)) {
      const arr = liveByPlatform.get(pub.platform) ?? [];
      arr.push(pub);
      liveByPlatform.set(pub.platform, arr);
    } else if (pub.status === PublicationStatus.PENDING) {
      const arr = pendingByPlatform.get(pub.platform) ?? [];
      arr.push(pub);
      pendingByPlatform.set(pub.platform, arr);
    }
  }

  for (const platform of ALL_PLATFORMS) {
    const pubs = liveByPlatform.get(platform) ?? [];
    if (!pubs.length) {
      // Aucune annonce en ligne : on signale une publication en cours si elle
      // existe (job BullMQ PENDING), sinon "Non publiée".
      if ((pendingByPlatform.get(platform) ?? []).length) {
        entries.push({
          key: `${listing._id}:${platform}:pending`,
          platform,
          state: 'pending',
          email: null,
          url: null,
          tooltip: `${platformLabel(platform)} — Publication en cours…`,
        });
        continue;
      }
      entries.push({
        key: `${listing._id}:${platform}:empty`,
        platform,
        state: 'none',
        email: null,
        url: null,
        tooltip: `${platformLabel(platform)} — Non publiée`,
      });
      continue;
    }
    for (const pub of pubs) {
      const email = pub.accountId.email;
      const sold = pub.status === PublicationStatus.SOLD;
      entries.push({
        key: `${listing._id}:${platform}:${pub.accountId._id}`,
        platform,
        state: sold ? 'sold' : 'published',
        email,
        url: pub.externalUrl ?? null,
        tooltip: `${platformLabel(platform)} · ${email} — ${sold ? 'Vendue' : 'Publiée'}`,
      });
    }
  }
  return entries;
}

function openPublishModal(listing: ListingResponse) {
  // Déjà publié = par PLATEFORME, pas par compte : si l'annonce est déjà en
  // ligne sur Vinted (ou LBC), on bloque tous les comptes de cette plateforme,
  // même un autre compte. Une annonce ne se publie qu'une fois par plateforme.
  const publishedPlatforms = new Set(
    listing.publications.filter(isPublished).map((p) => p.platform),
  );
  publishModal.listing = listing;
  publishModal.accounts = accounts.value
    .filter((a) => a.isConnected || a.needsReconnect)
    .map((a) => ({
      ...a,
      alreadyPublished: publishedPlatforms.has(a.platform),
    }));
  publishModal.selected = publishModal.accounts
    .filter((a) => !a.alreadyPublished && !a.needsReconnect)
    .map((a) => a._id);
  publishModal.show = true;
}

function onPublish() {
  if (!publishModal.listing) return;
  const listingId = publishModal.listing._id;
  const accountIds = [...publishModal.selected];

  // Full async : on ferme la modale immédiatement et on enqueue en arrière-plan.
  // Le badge "Publication en cours" (PENDING) puis le flux SSE prennent le relais
  // pour faire passer l'annonce en ligne sans bloquer l'UI.
  closePublishModal();

  void (async () => {
    await Promise.all(
      accountIds.map((accountId) =>
        apiClient
          .post('/publish', { listingId, accountId })
          .catch((err: any) => {
            const msg =
              err?.response?.data?.message ?? err?.message ?? 'Erreur';
            snackbar.text = `Échec de la mise en file : ${msg}`;
            snackbar.color = 'error';
            snackbar.show = true;
          }),
      ),
    );
    // Affiche tout de suite l'état PENDING.
    await Promise.all([fetchListings(), fetchAccounts()]);
  })();
}

// ─── Flux SSE des events de publication ──────────────────────────────────────

interface PublishEvent {
  type: 'queued' | 'started' | 'completed' | 'failed';
  accountId: string;
  listingId: string;
  platform: Platform;
  publicationId: string;
  result?: { externalId: string; externalUrl: string };
  error?: string;
}

function openPublishStream() {
  closePublishStream();
  // Cookies de session envoyés automatiquement (withCredentials).
  publishEventSource = new EventSource('/api/publish/events', {
    withCredentials: true,
  });
  publishEventSource.onmessage = (e) => handlePublishEvent(JSON.parse(e.data));
  publishEventSource.onerror = () => {
    // Reconnect automatique géré par EventSource ; on log juste.
    console.warn('[publish] SSE connection lost, attempting reconnect');
  };
}

function closePublishStream() {
  if (publishEventSource) {
    publishEventSource.close();
    publishEventSource = null;
  }
}

function handlePublishEvent(event: PublishEvent) {
  // Full async : on ne gère pas d'UI de progression. À la fin d'un job
  // (succès ou échec), on rafraîchit pour que la pastille passe de "en cours"
  // à "en ligne" (ou disparaisse en cas d'échec). On verra plus tard pour un
  // historique / des toasts détaillés.
  if (event.type === 'completed' || event.type === 'failed') {
    void Promise.all([fetchListings(), fetchAccounts()]);
  }
}

function closePublishModal() {
  publishModal.show = false;
}

async function fetchListings() {
  const params: Record<string, unknown> = {
    page: page.value,
    limit: PER_PAGE,
    sort: sort.value,
  };
  const q = debouncedSearch.value.trim();
  if (q) params.q = q;
  if (selectedPlatforms.value.length) params.platforms = selectedPlatforms.value;
  if (selectedAccountIds.value.length) params.accountIds = selectedAccountIds.value;
  if (statusFilter.value !== ListingStatusFilter.ALL) {
    params.statusFilter = statusFilter.value;
  }
  const { data } = await apiClient.get<PaginatedListingsResponse>('/listings', { params });
  listings.value = data.items;
  total.value = data.total;
}

watch(page, fetchListings);

watch(sort, () => {
  if (page.value !== 1) {
    page.value = 1;
  } else {
    fetchListings();
  }
});

watch(
  [selectedPlatforms, selectedAccountIds, statusFilter],
  () => {
    if (page.value !== 1) {
      page.value = 1;
    } else {
      fetchListings();
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
      fetchListings();
    }
  }, 300);
});

function queryEqualsArray(a: unknown, b: string[]): boolean {
  const cur = Array.isArray(a) ? a : a !== undefined ? [a] : [];
  return cur.length === b.length && cur.every((v, i) => v === b[i]);
}

// Persist page + filters in URL (back/forward restores the view)
watch(
  [page, debouncedSearch, sort, selectedPlatforms, selectedAccountIds, statusFilter],
  ([p, q, s, plats, accs, status]) => {
    const next: Record<string, string | string[]> = {};
    if (p > 1) next.page = String(p);
    if (q.trim()) next.q = q.trim();
    if (s !== DEFAULT_LISTING_SORT) next.sort = s;
    if (plats.length) next.platforms = [...plats];
    if (accs.length) next.accountIds = [...accs];
    if (status !== ListingStatusFilter.ALL) next.statusFilter = status;

    const current = route.query;
    const same =
      String(current.page ?? '') === String(next.page ?? '') &&
      String(current.q ?? '') === String(next.q ?? '') &&
      String(current.sort ?? '') === String(next.sort ?? '') &&
      String(current.statusFilter ?? '') === String(next.statusFilter ?? '') &&
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
    const newStatusFilter = parseStatusFilter(query.statusFilter);

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
    if (newStatusFilter !== statusFilter.value) {
      statusFilter.value = newStatusFilter;
      return;
    }
    if (needsFetch) fetchListings();
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
    await fetchListings();
  } catch (err: any) {
    snackbar.text = err?.response?.data?.message ?? 'Suppression échouée';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    deleteModal.busy = false;
  }
}

onMounted(() => {
  void fetchListings();
  openPublishStream();
});
onUnmounted(closePublishStream);
</script>

