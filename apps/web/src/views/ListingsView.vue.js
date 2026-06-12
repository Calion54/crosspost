import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DEFAULT_LISTING_SORT, ListingStatusFilter, Platform, PublicationStatus, listingSortSchema, listingStatusFilterSchema, } from '@crosspost/shared';
import apiClient from '@/api/client';
import { useAccounts } from '@/composables/accounts';
import { PLATFORM_OPTIONS, platformImage, platformLabel, } from '@/utils/platform';
const ALL_PLATFORMS = [Platform.LEBONCOIN, Platform.VINTED];
const PER_PAGE = 20;
const SORT_OPTIONS = [
    { value: 'createdAt:desc', label: 'Récent d\'abord' },
    { value: 'createdAt:asc', label: 'Ancien d\'abord' },
];
function parseSort(value) {
    const parsed = listingSortSchema.safeParse(value);
    return parsed.success ? parsed.data : DEFAULT_LISTING_SORT;
}
function parseStatusFilter(value) {
    const parsed = listingStatusFilterSchema.safeParse(value);
    return parsed.success ? parsed.data : ListingStatusFilter.ALL;
}
function parsePlatforms(value) {
    const arr = Array.isArray(value) ? value : value !== undefined ? [value] : [];
    return arr.filter((p) => Object.values(Platform).includes(p));
}
function parseStringArray(value) {
    const arr = Array.isArray(value) ? value : value !== undefined ? [value] : [];
    return arr.filter((v) => typeof v === 'string' && v.length > 0);
}
const route = useRoute();
const router = useRouter();
const initialPage = Number(route.query.page);
const initialSearch = typeof route.query.q === 'string' ? route.query.q : '';
const initialSort = parseSort(route.query.sort);
const { accounts, fetchAccounts } = useAccounts();
const listings = ref([]);
const total = ref(0);
const page = ref(Number.isFinite(initialPage) && initialPage >= 1 ? initialPage : 1);
const search = ref(initialSearch);
const debouncedSearch = ref(initialSearch);
const sort = ref(initialSort);
const selectedPlatforms = ref(parsePlatforms(route.query.platforms));
const selectedAccountIds = ref(parseStringArray(route.query.accountIds));
const statusFilter = ref(parseStatusFilter(route.query.statusFilter));
const accountOptions = computed(() => accounts.value.map((a) => ({
    _id: a._id,
    label: `${platformLabel(a.platform)} · ${a.email}`,
})));
const hasActiveFilters = computed(() => selectedPlatforms.value.length > 0 ||
    selectedAccountIds.value.length > 0 ||
    statusFilter.value !== ListingStatusFilter.ALL);
function clearFilters() {
    selectedPlatforms.value = [];
    selectedAccountIds.value = [];
    statusFilter.value = ListingStatusFilter.ALL;
}
let searchTimer = null;
const snackbar = reactive({ show: false, text: '', color: 'success' });
const publishModal = reactive({
    show: false,
    listing: null,
    accounts: [],
    selected: [],
});
let publishEventSource = null;
const deleteModal = reactive({
    show: false,
    busy: false,
    listing: null,
    publications: [],
    selectedPubIds: [],
    crosspost: false,
});
const canConfirmDelete = computed(() => deleteModal.crosspost || deleteModal.selectedPubIds.length > 0);
const totalPages = computed(() => Math.ceil(total.value / PER_PAGE));
/** Publication "visible" sur une pastille : en ligne ou vendue. */
function isLive(pub) {
    return (pub.status === PublicationStatus.PUBLISHED ||
        pub.status === PublicationStatus.SOLD);
}
function isPublished(pub) {
    return pub.status === PublicationStatus.PUBLISHED;
}
const ENTRY_BADGE_COLOR = {
    none: 'grey',
    pending: 'blue',
    published: 'success',
    sold: 'amber-darken-2',
};
function getPlatformEntries(listing) {
    const entries = [];
    const liveByPlatform = new Map();
    const pendingByPlatform = new Map();
    for (const pub of listing.publications) {
        if (isLive(pub)) {
            const arr = liveByPlatform.get(pub.platform) ?? [];
            arr.push(pub);
            liveByPlatform.set(pub.platform, arr);
        }
        else if (pub.status === PublicationStatus.PENDING) {
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
function openPublishModal(listing) {
    // Déjà publié = par PLATEFORME, pas par compte : si l'annonce est déjà en
    // ligne sur Vinted (ou LBC), on bloque tous les comptes de cette plateforme,
    // même un autre compte. Une annonce ne se publie qu'une fois par plateforme.
    const publishedPlatforms = new Set(listing.publications.filter(isPublished).map((p) => p.platform));
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
    if (!publishModal.listing)
        return;
    const listingId = publishModal.listing._id;
    const accountIds = [...publishModal.selected];
    // Full async : on ferme la modale immédiatement et on enqueue en arrière-plan.
    // Le badge "Publication en cours" (PENDING) puis le flux SSE prennent le relais
    // pour faire passer l'annonce en ligne sans bloquer l'UI.
    closePublishModal();
    void (async () => {
        await Promise.all(accountIds.map((accountId) => apiClient
            .post('/publish', { listingId, accountId })
            .catch((err) => {
            const msg = err?.response?.data?.message ?? err?.message ?? 'Erreur';
            snackbar.text = `Échec de la mise en file : ${msg}`;
            snackbar.color = 'error';
            snackbar.show = true;
        })));
        // Affiche tout de suite l'état PENDING.
        await Promise.all([fetchListings(), fetchAccounts()]);
    })();
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
function handlePublishEvent(event) {
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
    const params = {
        page: page.value,
        limit: PER_PAGE,
        sort: sort.value,
    };
    const q = debouncedSearch.value.trim();
    if (q)
        params.q = q;
    if (selectedPlatforms.value.length)
        params.platforms = selectedPlatforms.value;
    if (selectedAccountIds.value.length)
        params.accountIds = selectedAccountIds.value;
    if (statusFilter.value !== ListingStatusFilter.ALL) {
        params.statusFilter = statusFilter.value;
    }
    const { data } = await apiClient.get('/listings', { params });
    listings.value = data.items;
    total.value = data.total;
}
watch(page, fetchListings);
watch(sort, () => {
    if (page.value !== 1) {
        page.value = 1;
    }
    else {
        fetchListings();
    }
});
watch([selectedPlatforms, selectedAccountIds, statusFilter], () => {
    if (page.value !== 1) {
        page.value = 1;
    }
    else {
        fetchListings();
    }
}, { deep: true });
watch(search, (val) => {
    if (searchTimer)
        clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        debouncedSearch.value = val ?? '';
        if (page.value !== 1) {
            page.value = 1;
        }
        else {
            fetchListings();
        }
    }, 300);
});
function queryEqualsArray(a, b) {
    const cur = Array.isArray(a) ? a : a !== undefined ? [a] : [];
    return cur.length === b.length && cur.every((v, i) => v === b[i]);
}
// Persist page + filters in URL (back/forward restores the view)
watch([page, debouncedSearch, sort, selectedPlatforms, selectedAccountIds, statusFilter], ([p, q, s, plats, accs, status]) => {
    const next = {};
    if (p > 1)
        next.page = String(p);
    if (q.trim())
        next.q = q.trim();
    if (s !== DEFAULT_LISTING_SORT)
        next.sort = s;
    if (plats.length)
        next.platforms = [...plats];
    if (accs.length)
        next.accountIds = [...accs];
    if (status !== ListingStatusFilter.ALL)
        next.statusFilter = status;
    const current = route.query;
    const same = String(current.page ?? '') === String(next.page ?? '') &&
        String(current.q ?? '') === String(next.q ?? '') &&
        String(current.sort ?? '') === String(next.sort ?? '') &&
        String(current.statusFilter ?? '') === String(next.statusFilter ?? '') &&
        queryEqualsArray(current.platforms, plats) &&
        queryEqualsArray(current.accountIds, accs);
    if (same)
        return;
    router.replace({ query: next });
}, { deep: true });
// React to back/forward navigation
watch(() => route.query, (query) => {
    const p = Number(query.page);
    const newPage = Number.isFinite(p) && p >= 1 ? p : 1;
    const newSearch = typeof query.q === 'string' ? query.q : '';
    const newSort = parseSort(query.sort);
    const newPlatforms = parsePlatforms(query.platforms);
    const newAccountIds = parseStringArray(query.accountIds);
    const newStatusFilter = parseStatusFilter(query.statusFilter);
    let needsFetch = false;
    if (newPage !== page.value)
        page.value = newPage;
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
    if (needsFetch)
        fetchListings();
});
function describeDeleteResult(r) {
    const label = platformLabel(r.platform);
    const status = r.result?.status;
    if (status === 'deleted')
        return { line: `${label} : supprimée ✓`, ok: true };
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
function openDeleteModal(listing) {
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
    if (!deleteModal.listing)
        return;
    deleteModal.busy = true;
    try {
        const lines = [];
        let allOk = true;
        if (deleteModal.crosspost) {
            // Cascade : backend supprime tout côté plateformes + Crosspost.
            const { data } = await apiClient.delete(`/listings/${deleteModal.listing._id}`);
            for (const r of data.results) {
                const { line, ok } = describeDeleteResult(r);
                lines.push(line);
                if (!ok)
                    allOk = false;
            }
            if (data.deleted)
                lines.push('Annonce supprimée de Crosspost ✓');
            else if (!allOk)
                lines.push('Crosspost : annonce conservée (échec plateforme).');
        }
        else {
            // Partial : un appel par publication sélectionnée.
            const results = await Promise.all(deleteModal.selectedPubIds.map(async (pubId) => {
                try {
                    const { data } = await apiClient.delete(`/publications/${pubId}`);
                    return data;
                }
                catch (err) {
                    const pub = deleteModal.publications.find((p) => p._id === pubId);
                    return {
                        platform: pub?.platform ?? Platform.LEBONCOIN,
                        result: {
                            status: 'failed',
                            message: err?.response?.data?.message ?? err?.message ?? 'Erreur',
                        },
                    };
                }
            }));
            for (const r of results) {
                const { line, ok } = describeDeleteResult(r);
                lines.push(line);
                if (!ok)
                    allOk = false;
            }
        }
        snackbar.text = lines.length ? lines.join(' · ') : 'Rien à supprimer';
        snackbar.color = allOk ? 'success' : 'warning';
        snackbar.show = true;
        closeDeleteModal();
        await fetchListings();
    }
    catch (err) {
        snackbar.text = err?.response?.data?.message ?? 'Suppression échouée';
        snackbar.color = 'error';
        snackbar.show = true;
    }
    finally {
        deleteModal.busy = false;
    }
}
onMounted(() => {
    void fetchListings();
    openPublishStream();
});
onUnmounted(closePublishStream);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "d-flex align-center mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-h4" },
});
const __VLS_0 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_4 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    modelValue: (__VLS_ctx.search),
    density: "compact",
    variant: "outlined",
    hideDetails: true,
    clearable: true,
    placeholder: "Rechercher un titre…",
    prependInnerIcon: "mdi-magnify",
    ...{ style: {} },
    ...{ class: "mr-3" },
}));
const __VLS_6 = __VLS_5({
    modelValue: (__VLS_ctx.search),
    density: "compact",
    variant: "outlined",
    hideDetails: true,
    clearable: true,
    placeholder: "Rechercher un titre…",
    prependInnerIcon: "mdi-magnify",
    ...{ style: {} },
    ...{ class: "mr-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
const __VLS_8 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    modelValue: (__VLS_ctx.sort),
    items: (__VLS_ctx.SORT_OPTIONS),
    itemTitle: "label",
    itemValue: "value",
    density: "compact",
    variant: "outlined",
    hideDetails: true,
    prependInnerIcon: "mdi-sort",
    ...{ style: {} },
    ...{ class: "mr-3" },
}));
const __VLS_10 = __VLS_9({
    modelValue: (__VLS_ctx.sort),
    items: (__VLS_ctx.SORT_OPTIONS),
    itemTitle: "label",
    itemValue: "value",
    density: "compact",
    variant: "outlined",
    hideDetails: true,
    prependInnerIcon: "mdi-sort",
    ...{ style: {} },
    ...{ class: "mr-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
const __VLS_12 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    color: "primary",
    prependIcon: "mdi-plus",
    to: "/listings/new",
}));
const __VLS_14 = __VLS_13({
    color: "primary",
    prependIcon: "mdi-plus",
    to: "/listings/new",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
var __VLS_15;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "d-flex align-center mb-4 ga-3 flex-wrap" },
});
const __VLS_16 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    modelValue: (__VLS_ctx.selectedPlatforms),
    items: (__VLS_ctx.PLATFORM_OPTIONS),
    density: "compact",
    variant: "outlined",
    hideDetails: true,
    chips: true,
    closableChips: true,
    multiple: true,
    clearable: true,
    label: "Plateformes",
    ...{ style: {} },
}));
const __VLS_18 = __VLS_17({
    modelValue: (__VLS_ctx.selectedPlatforms),
    items: (__VLS_ctx.PLATFORM_OPTIONS),
    density: "compact",
    variant: "outlined",
    hideDetails: true,
    chips: true,
    closableChips: true,
    multiple: true,
    clearable: true,
    label: "Plateformes",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const __VLS_20 = {}.VAutocomplete;
/** @type {[typeof __VLS_components.VAutocomplete, typeof __VLS_components.vAutocomplete, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.selectedAccountIds),
    items: (__VLS_ctx.accountOptions),
    itemTitle: "label",
    itemValue: "_id",
    density: "compact",
    variant: "outlined",
    hideDetails: true,
    chips: true,
    closableChips: true,
    multiple: true,
    clearable: true,
    label: "Comptes",
    ...{ style: {} },
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.selectedAccountIds),
    items: (__VLS_ctx.accountOptions),
    itemTitle: "label",
    itemValue: "_id",
    density: "compact",
    variant: "outlined",
    hideDetails: true,
    chips: true,
    closableChips: true,
    multiple: true,
    clearable: true,
    label: "Comptes",
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_24 = {}.VBtnToggle;
/** @type {[typeof __VLS_components.VBtnToggle, typeof __VLS_components.vBtnToggle, typeof __VLS_components.VBtnToggle, typeof __VLS_components.vBtnToggle, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    modelValue: (__VLS_ctx.statusFilter),
    density: "compact",
    color: "primary",
    mandatory: true,
    variant: "outlined",
}));
const __VLS_26 = __VLS_25({
    modelValue: (__VLS_ctx.statusFilter),
    density: "compact",
    color: "primary",
    mandatory: true,
    variant: "outlined",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
const __VLS_28 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    value: (__VLS_ctx.ListingStatusFilter.ALL),
    size: "small",
}));
const __VLS_30 = __VLS_29({
    value: (__VLS_ctx.ListingStatusFilter.ALL),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
var __VLS_31;
const __VLS_32 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    value: (__VLS_ctx.ListingStatusFilter.ACTIVE),
    size: "small",
}));
const __VLS_34 = __VLS_33({
    value: (__VLS_ctx.ListingStatusFilter.ACTIVE),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
var __VLS_35;
const __VLS_36 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    value: (__VLS_ctx.ListingStatusFilter.SOLD),
    size: "small",
}));
const __VLS_38 = __VLS_37({
    value: (__VLS_ctx.ListingStatusFilter.SOLD),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_39.slots.default;
var __VLS_39;
const __VLS_40 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    value: (__VLS_ctx.ListingStatusFilter.UNPUBLISHED),
    size: "small",
}));
const __VLS_42 = __VLS_41({
    value: (__VLS_ctx.ListingStatusFilter.UNPUBLISHED),
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
var __VLS_43;
var __VLS_27;
const __VLS_44 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({}));
const __VLS_46 = __VLS_45({}, ...__VLS_functionalComponentArgsRest(__VLS_45));
if (__VLS_ctx.hasActiveFilters) {
    const __VLS_48 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        ...{ 'onClick': {} },
        size: "small",
        variant: "text",
        prependIcon: "mdi-filter-remove",
    }));
    const __VLS_50 = __VLS_49({
        ...{ 'onClick': {} },
        size: "small",
        variant: "text",
        prependIcon: "mdi-filter-remove",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    let __VLS_52;
    let __VLS_53;
    let __VLS_54;
    const __VLS_55 = {
        onClick: (__VLS_ctx.clearFilters)
    };
    __VLS_51.slots.default;
    var __VLS_51;
}
const __VLS_56 = {}.VTable;
/** @type {[typeof __VLS_components.VTable, typeof __VLS_components.vTable, typeof __VLS_components.VTable, typeof __VLS_components.vTable, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({}));
const __VLS_58 = __VLS_57({}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
if (!__VLS_ctx.listings.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "5",
        ...{ class: "text-center text-medium-emphasis pa-4" },
    });
}
for (const [listing] of __VLS_getVForSourceType((__VLS_ctx.listings))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (listing._id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    if (listing.mediaUrls?.length) {
        const __VLS_60 = {}.VImg;
        /** @type {[typeof __VLS_components.VImg, typeof __VLS_components.vImg, ]} */ ;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
            src: (listing.mediaUrls[0]),
            width: "60",
            height: "60",
            cover: true,
            ...{ class: "rounded my-1" },
        }));
        const __VLS_62 = __VLS_61({
            src: (listing.mediaUrls[0]),
            width: "60",
            height: "60",
            cover: true,
            ...{ class: "rounded my-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "d-flex align-center justify-center rounded bg-grey-lighten-3 my-1" },
            ...{ style: {} },
        });
        const __VLS_64 = {}.VIcon;
        /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
        // @ts-ignore
        const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
            color: "grey",
            size: "24",
        }));
        const __VLS_66 = __VLS_65({
            color: "grey",
            size: "24",
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        __VLS_67.slots.default;
        var __VLS_67;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-flex align-center ga-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (listing.title);
    if (listing.sold) {
        const __VLS_68 = {}.VChip;
        /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
        // @ts-ignore
        const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
            size: "x-small",
            color: "success",
            variant: "flat",
            prependIcon: "mdi-cash-check",
        }));
        const __VLS_70 = __VLS_69({
            size: "x-small",
            color: "success",
            variant: "flat",
            prependIcon: "mdi-cash-check",
        }, ...__VLS_functionalComponentArgsRest(__VLS_69));
        __VLS_71.slots.default;
        var __VLS_71;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (listing.price);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-flex ga-2 align-center flex-wrap" },
    });
    for (const [entry] of __VLS_getVForSourceType((__VLS_ctx.getPlatformEntries(listing)))) {
        const __VLS_72 = {}.VTooltip;
        /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
            key: (entry.key),
            text: (entry.tooltip),
        }));
        const __VLS_74 = __VLS_73({
            key: (entry.key),
            text: (entry.tooltip),
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        __VLS_75.slots.default;
        {
            const { activator: __VLS_thisSlot } = __VLS_75.slots;
            const { props: tooltipProps } = __VLS_getSlotParam(__VLS_thisSlot);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                ...(tooltipProps),
                href: (entry.url || undefined),
                target: (entry.url ? '_blank' : undefined),
                ...{ class: "d-inline-block" },
                ...{ style: ({ opacity: entry.state === 'none' ? 0.35 : 1 }) },
            });
            const __VLS_76 = {}.VBadge;
            /** @type {[typeof __VLS_components.VBadge, typeof __VLS_components.vBadge, typeof __VLS_components.VBadge, typeof __VLS_components.vBadge, ]} */ ;
            // @ts-ignore
            const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
                color: (__VLS_ctx.ENTRY_BADGE_COLOR[entry.state]),
                icon: (entry.state === 'sold' ? 'mdi-currency-eur' : undefined),
                dot: (entry.state !== 'sold'),
                location: "bottom end",
                offsetX: "2",
                offsetY: "2",
            }));
            const __VLS_78 = __VLS_77({
                color: (__VLS_ctx.ENTRY_BADGE_COLOR[entry.state]),
                icon: (entry.state === 'sold' ? 'mdi-currency-eur' : undefined),
                dot: (entry.state !== 'sold'),
                location: "bottom end",
                offsetX: "2",
                offsetY: "2",
            }, ...__VLS_functionalComponentArgsRest(__VLS_77));
            __VLS_79.slots.default;
            const __VLS_80 = {}.VAvatar;
            /** @type {[typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, ]} */ ;
            // @ts-ignore
            const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
                size: "28",
                rounded: "lg",
            }));
            const __VLS_82 = __VLS_81({
                size: "28",
                rounded: "lg",
            }, ...__VLS_functionalComponentArgsRest(__VLS_81));
            __VLS_83.slots.default;
            const __VLS_84 = {}.VImg;
            /** @type {[typeof __VLS_components.VImg, typeof __VLS_components.vImg, ]} */ ;
            // @ts-ignore
            const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
                src: (__VLS_ctx.platformImage(entry.platform)),
                alt: (__VLS_ctx.platformLabel(entry.platform)),
            }));
            const __VLS_86 = __VLS_85({
                src: (__VLS_ctx.platformImage(entry.platform)),
                alt: (__VLS_ctx.platformLabel(entry.platform)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_85));
            var __VLS_83;
            var __VLS_79;
        }
        var __VLS_75;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    const __VLS_88 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        text: "Publier",
    }));
    const __VLS_90 = __VLS_89({
        text: "Publier",
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    __VLS_91.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_91.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_92 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-publish",
            size: "small",
            variant: "text",
            color: "primary",
        }));
        const __VLS_94 = __VLS_93({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-publish",
            size: "small",
            variant: "text",
            color: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
        let __VLS_96;
        let __VLS_97;
        let __VLS_98;
        const __VLS_99 = {
            onClick: (...[$event]) => {
                __VLS_ctx.openPublishModal(listing);
            }
        };
        var __VLS_95;
    }
    var __VLS_91;
    const __VLS_100 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        text: "Modifier",
    }));
    const __VLS_102 = __VLS_101({
        text: "Modifier",
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    __VLS_103.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_103.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_104 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
            ...(props),
            icon: "mdi-pencil",
            size: "small",
            variant: "text",
            to: (`/listings/${listing._id}`),
        }));
        const __VLS_106 = __VLS_105({
            ...(props),
            icon: "mdi-pencil",
            size: "small",
            variant: "text",
            to: (`/listings/${listing._id}`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    }
    var __VLS_103;
    const __VLS_108 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        text: "Supprimer",
    }));
    const __VLS_110 = __VLS_109({
        text: "Supprimer",
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    __VLS_111.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_111.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_112 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
        }));
        const __VLS_114 = __VLS_113({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
        }, ...__VLS_functionalComponentArgsRest(__VLS_113));
        let __VLS_116;
        let __VLS_117;
        let __VLS_118;
        const __VLS_119 = {
            onClick: (...[$event]) => {
                __VLS_ctx.openDeleteModal(listing);
            }
        };
        var __VLS_115;
    }
    var __VLS_111;
}
var __VLS_59;
if (__VLS_ctx.totalPages > 1) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-flex justify-center mt-4" },
    });
    const __VLS_120 = {}.VPagination;
    /** @type {[typeof __VLS_components.VPagination, typeof __VLS_components.vPagination, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        modelValue: (__VLS_ctx.page),
        length: (__VLS_ctx.totalPages),
        totalVisible: (7),
        rounded: true,
    }));
    const __VLS_122 = __VLS_121({
        modelValue: (__VLS_ctx.page),
        length: (__VLS_ctx.totalPages),
        totalVisible: (7),
        rounded: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
}
const __VLS_124 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    modelValue: (__VLS_ctx.publishModal.show),
    maxWidth: "450",
}));
const __VLS_126 = __VLS_125({
    modelValue: (__VLS_ctx.publishModal.show),
    maxWidth: "450",
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
const __VLS_128 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({}));
const __VLS_130 = __VLS_129({}, ...__VLS_functionalComponentArgsRest(__VLS_129));
__VLS_131.slots.default;
const __VLS_132 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({}));
const __VLS_134 = __VLS_133({}, ...__VLS_functionalComponentArgsRest(__VLS_133));
__VLS_135.slots.default;
var __VLS_135;
if (__VLS_ctx.publishModal.listing) {
    const __VLS_136 = {}.VCardSubtitle;
    /** @type {[typeof __VLS_components.VCardSubtitle, typeof __VLS_components.vCardSubtitle, typeof __VLS_components.VCardSubtitle, typeof __VLS_components.vCardSubtitle, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
        ...{ class: "pb-0" },
    }));
    const __VLS_138 = __VLS_137({
        ...{ class: "pb-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    __VLS_139.slots.default;
    (__VLS_ctx.publishModal.listing.title);
    var __VLS_139;
}
const __VLS_140 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({}));
const __VLS_142 = __VLS_141({}, ...__VLS_functionalComponentArgsRest(__VLS_141));
__VLS_143.slots.default;
if (__VLS_ctx.publishModal.accounts.length) {
    const __VLS_144 = {}.VList;
    /** @type {[typeof __VLS_components.VList, typeof __VLS_components.vList, typeof __VLS_components.VList, typeof __VLS_components.vList, ]} */ ;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
        selectStrategy: "classic",
        selected: (__VLS_ctx.publishModal.selected),
    }));
    const __VLS_146 = __VLS_145({
        selectStrategy: "classic",
        selected: (__VLS_ctx.publishModal.selected),
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    __VLS_147.slots.default;
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.publishModal.accounts))) {
        const __VLS_148 = {}.VListItem;
        /** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
        // @ts-ignore
        const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
            key: (acc._id),
            value: (acc._id),
            disabled: (acc.alreadyPublished || acc.needsReconnect),
        }));
        const __VLS_150 = __VLS_149({
            key: (acc._id),
            value: (acc._id),
            disabled: (acc.alreadyPublished || acc.needsReconnect),
        }, ...__VLS_functionalComponentArgsRest(__VLS_149));
        __VLS_151.slots.default;
        {
            const { prepend: __VLS_thisSlot } = __VLS_151.slots;
            const [{ isActive }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_152 = {}.VListItemAction;
            /** @type {[typeof __VLS_components.VListItemAction, typeof __VLS_components.vListItemAction, typeof __VLS_components.VListItemAction, typeof __VLS_components.vListItemAction, ]} */ ;
            // @ts-ignore
            const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
                start: true,
            }));
            const __VLS_154 = __VLS_153({
                start: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_153));
            __VLS_155.slots.default;
            const __VLS_156 = {}.VCheckboxBtn;
            /** @type {[typeof __VLS_components.VCheckboxBtn, typeof __VLS_components.vCheckboxBtn, ]} */ ;
            // @ts-ignore
            const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
                modelValue: (isActive),
                disabled: (acc.alreadyPublished || acc.needsReconnect),
                tabindex: "-1",
                ...{ style: {} },
            }));
            const __VLS_158 = __VLS_157({
                modelValue: (isActive),
                disabled: (acc.alreadyPublished || acc.needsReconnect),
                tabindex: "-1",
                ...{ style: {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_157));
            var __VLS_155;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                src: (__VLS_ctx.platformImage(acc.platform)),
                alt: (__VLS_ctx.platformLabel(acc.platform)),
                width: "28",
                height: "28",
                ...{ class: "rounded mr-3" },
            });
        }
        const __VLS_160 = {}.VListItemTitle;
        /** @type {[typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, ]} */ ;
        // @ts-ignore
        const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({}));
        const __VLS_162 = __VLS_161({}, ...__VLS_functionalComponentArgsRest(__VLS_161));
        __VLS_163.slots.default;
        (__VLS_ctx.platformLabel(acc.platform));
        var __VLS_163;
        const __VLS_164 = {}.VListItemSubtitle;
        /** @type {[typeof __VLS_components.VListItemSubtitle, typeof __VLS_components.vListItemSubtitle, typeof __VLS_components.VListItemSubtitle, typeof __VLS_components.vListItemSubtitle, ]} */ ;
        // @ts-ignore
        const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({}));
        const __VLS_166 = __VLS_165({}, ...__VLS_functionalComponentArgsRest(__VLS_165));
        __VLS_167.slots.default;
        (acc.email);
        var __VLS_167;
        {
            const { append: __VLS_thisSlot } = __VLS_151.slots;
            if (acc.needsReconnect) {
                const __VLS_168 = {}.VChip;
                /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
                // @ts-ignore
                const __VLS_169 = __VLS_asFunctionalComponent(__VLS_168, new __VLS_168({
                    size: "x-small",
                    color: "warning",
                    variant: "tonal",
                }));
                const __VLS_170 = __VLS_169({
                    size: "x-small",
                    color: "warning",
                    variant: "tonal",
                }, ...__VLS_functionalComponentArgsRest(__VLS_169));
                __VLS_171.slots.default;
                var __VLS_171;
            }
            else if (acc.alreadyPublished) {
                const __VLS_172 = {}.VChip;
                /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
                // @ts-ignore
                const __VLS_173 = __VLS_asFunctionalComponent(__VLS_172, new __VLS_172({
                    size: "x-small",
                    color: "success",
                    variant: "tonal",
                }));
                const __VLS_174 = __VLS_173({
                    size: "x-small",
                    color: "success",
                    variant: "tonal",
                }, ...__VLS_functionalComponentArgsRest(__VLS_173));
                __VLS_175.slots.default;
                var __VLS_175;
            }
        }
        var __VLS_151;
    }
    var __VLS_147;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-medium-emphasis text-center pa-4" },
    });
    const __VLS_176 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    const __VLS_177 = __VLS_asFunctionalComponent(__VLS_176, new __VLS_176({
        to: "/accounts",
    }));
    const __VLS_178 = __VLS_177({
        to: "/accounts",
    }, ...__VLS_functionalComponentArgsRest(__VLS_177));
    __VLS_179.slots.default;
    var __VLS_179;
}
var __VLS_143;
const __VLS_180 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
const __VLS_181 = __VLS_asFunctionalComponent(__VLS_180, new __VLS_180({}));
const __VLS_182 = __VLS_181({}, ...__VLS_functionalComponentArgsRest(__VLS_181));
__VLS_183.slots.default;
const __VLS_184 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
const __VLS_185 = __VLS_asFunctionalComponent(__VLS_184, new __VLS_184({}));
const __VLS_186 = __VLS_185({}, ...__VLS_functionalComponentArgsRest(__VLS_185));
const __VLS_188 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_190 = __VLS_189({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_189));
let __VLS_192;
let __VLS_193;
let __VLS_194;
const __VLS_195 = {
    onClick: (__VLS_ctx.closePublishModal)
};
__VLS_191.slots.default;
var __VLS_191;
if (__VLS_ctx.publishModal.accounts.length) {
    const __VLS_196 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_197 = __VLS_asFunctionalComponent(__VLS_196, new __VLS_196({
        ...{ 'onClick': {} },
        color: "primary",
        disabled: (!__VLS_ctx.publishModal.selected.length),
    }));
    const __VLS_198 = __VLS_197({
        ...{ 'onClick': {} },
        color: "primary",
        disabled: (!__VLS_ctx.publishModal.selected.length),
    }, ...__VLS_functionalComponentArgsRest(__VLS_197));
    let __VLS_200;
    let __VLS_201;
    let __VLS_202;
    const __VLS_203 = {
        onClick: (__VLS_ctx.onPublish)
    };
    __VLS_199.slots.default;
    (__VLS_ctx.publishModal.selected.length);
    var __VLS_199;
}
var __VLS_183;
var __VLS_131;
var __VLS_127;
const __VLS_204 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
const __VLS_205 = __VLS_asFunctionalComponent(__VLS_204, new __VLS_204({
    modelValue: (__VLS_ctx.deleteModal.show),
    maxWidth: "500",
}));
const __VLS_206 = __VLS_205({
    modelValue: (__VLS_ctx.deleteModal.show),
    maxWidth: "500",
}, ...__VLS_functionalComponentArgsRest(__VLS_205));
__VLS_207.slots.default;
const __VLS_208 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({}));
const __VLS_210 = __VLS_209({}, ...__VLS_functionalComponentArgsRest(__VLS_209));
__VLS_211.slots.default;
const __VLS_212 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
const __VLS_213 = __VLS_asFunctionalComponent(__VLS_212, new __VLS_212({}));
const __VLS_214 = __VLS_213({}, ...__VLS_functionalComponentArgsRest(__VLS_213));
__VLS_215.slots.default;
var __VLS_215;
if (__VLS_ctx.deleteModal.listing) {
    const __VLS_216 = {}.VCardSubtitle;
    /** @type {[typeof __VLS_components.VCardSubtitle, typeof __VLS_components.vCardSubtitle, typeof __VLS_components.VCardSubtitle, typeof __VLS_components.vCardSubtitle, ]} */ ;
    // @ts-ignore
    const __VLS_217 = __VLS_asFunctionalComponent(__VLS_216, new __VLS_216({
        ...{ class: "pb-0" },
    }));
    const __VLS_218 = __VLS_217({
        ...{ class: "pb-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_217));
    __VLS_219.slots.default;
    (__VLS_ctx.deleteModal.listing.title);
    var __VLS_219;
}
const __VLS_220 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
const __VLS_221 = __VLS_asFunctionalComponent(__VLS_220, new __VLS_220({}));
const __VLS_222 = __VLS_221({}, ...__VLS_functionalComponentArgsRest(__VLS_221));
__VLS_223.slots.default;
if (!__VLS_ctx.deleteModal.publications.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-medium-emphasis mb-3" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-body-2 mb-2" },
    });
    const __VLS_224 = {}.VList;
    /** @type {[typeof __VLS_components.VList, typeof __VLS_components.vList, typeof __VLS_components.VList, typeof __VLS_components.vList, ]} */ ;
    // @ts-ignore
    const __VLS_225 = __VLS_asFunctionalComponent(__VLS_224, new __VLS_224({
        selectStrategy: "classic",
        selected: (__VLS_ctx.deleteModal.selectedPubIds),
    }));
    const __VLS_226 = __VLS_225({
        selectStrategy: "classic",
        selected: (__VLS_ctx.deleteModal.selectedPubIds),
    }, ...__VLS_functionalComponentArgsRest(__VLS_225));
    __VLS_227.slots.default;
    for (const [pub] of __VLS_getVForSourceType((__VLS_ctx.deleteModal.publications))) {
        const __VLS_228 = {}.VListItem;
        /** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
        // @ts-ignore
        const __VLS_229 = __VLS_asFunctionalComponent(__VLS_228, new __VLS_228({
            key: (pub._id),
            value: (pub._id),
            disabled: (__VLS_ctx.deleteModal.crosspost),
        }));
        const __VLS_230 = __VLS_229({
            key: (pub._id),
            value: (pub._id),
            disabled: (__VLS_ctx.deleteModal.crosspost),
        }, ...__VLS_functionalComponentArgsRest(__VLS_229));
        __VLS_231.slots.default;
        {
            const { prepend: __VLS_thisSlot } = __VLS_231.slots;
            const [{ isActive }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_232 = {}.VListItemAction;
            /** @type {[typeof __VLS_components.VListItemAction, typeof __VLS_components.vListItemAction, typeof __VLS_components.VListItemAction, typeof __VLS_components.vListItemAction, ]} */ ;
            // @ts-ignore
            const __VLS_233 = __VLS_asFunctionalComponent(__VLS_232, new __VLS_232({
                start: true,
            }));
            const __VLS_234 = __VLS_233({
                start: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_233));
            __VLS_235.slots.default;
            const __VLS_236 = {}.VCheckboxBtn;
            /** @type {[typeof __VLS_components.VCheckboxBtn, typeof __VLS_components.vCheckboxBtn, ]} */ ;
            // @ts-ignore
            const __VLS_237 = __VLS_asFunctionalComponent(__VLS_236, new __VLS_236({
                modelValue: (isActive),
                disabled: (__VLS_ctx.deleteModal.crosspost),
                tabindex: "-1",
                ...{ style: {} },
            }));
            const __VLS_238 = __VLS_237({
                modelValue: (isActive),
                disabled: (__VLS_ctx.deleteModal.crosspost),
                tabindex: "-1",
                ...{ style: {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_237));
            var __VLS_235;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                src: (__VLS_ctx.platformImage(pub.platform)),
                width: "28",
                height: "28",
                ...{ class: "rounded mr-3" },
            });
        }
        const __VLS_240 = {}.VListItemTitle;
        /** @type {[typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, ]} */ ;
        // @ts-ignore
        const __VLS_241 = __VLS_asFunctionalComponent(__VLS_240, new __VLS_240({}));
        const __VLS_242 = __VLS_241({}, ...__VLS_functionalComponentArgsRest(__VLS_241));
        __VLS_243.slots.default;
        (__VLS_ctx.platformLabel(pub.platform));
        var __VLS_243;
        const __VLS_244 = {}.VListItemSubtitle;
        /** @type {[typeof __VLS_components.VListItemSubtitle, typeof __VLS_components.vListItemSubtitle, typeof __VLS_components.VListItemSubtitle, typeof __VLS_components.vListItemSubtitle, ]} */ ;
        // @ts-ignore
        const __VLS_245 = __VLS_asFunctionalComponent(__VLS_244, new __VLS_244({}));
        const __VLS_246 = __VLS_245({}, ...__VLS_functionalComponentArgsRest(__VLS_245));
        __VLS_247.slots.default;
        (pub.accountId.email);
        var __VLS_247;
        var __VLS_231;
    }
    var __VLS_227;
    const __VLS_248 = {}.VDivider;
    /** @type {[typeof __VLS_components.VDivider, typeof __VLS_components.vDivider, ]} */ ;
    // @ts-ignore
    const __VLS_249 = __VLS_asFunctionalComponent(__VLS_248, new __VLS_248({
        ...{ class: "my-2" },
    }));
    const __VLS_250 = __VLS_249({
        ...{ class: "my-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_249));
}
const __VLS_252 = {}.VCheckbox;
/** @type {[typeof __VLS_components.VCheckbox, typeof __VLS_components.vCheckbox, ]} */ ;
// @ts-ignore
const __VLS_253 = __VLS_asFunctionalComponent(__VLS_252, new __VLS_252({
    modelValue: (__VLS_ctx.deleteModal.crosspost),
    density: "compact",
    hideDetails: true,
    color: "error",
    label: "Supprimer aussi l'annonce de Crosspost (cascade)",
}));
const __VLS_254 = __VLS_253({
    modelValue: (__VLS_ctx.deleteModal.crosspost),
    density: "compact",
    hideDetails: true,
    color: "error",
    label: "Supprimer aussi l'annonce de Crosspost (cascade)",
}, ...__VLS_functionalComponentArgsRest(__VLS_253));
if (__VLS_ctx.deleteModal.crosspost) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-caption text-medium-emphasis mt-2" },
    });
}
var __VLS_223;
const __VLS_256 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
const __VLS_257 = __VLS_asFunctionalComponent(__VLS_256, new __VLS_256({}));
const __VLS_258 = __VLS_257({}, ...__VLS_functionalComponentArgsRest(__VLS_257));
__VLS_259.slots.default;
const __VLS_260 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
const __VLS_261 = __VLS_asFunctionalComponent(__VLS_260, new __VLS_260({}));
const __VLS_262 = __VLS_261({}, ...__VLS_functionalComponentArgsRest(__VLS_261));
const __VLS_264 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_265 = __VLS_asFunctionalComponent(__VLS_264, new __VLS_264({
    ...{ 'onClick': {} },
    variant: "text",
    disabled: (__VLS_ctx.deleteModal.busy),
}));
const __VLS_266 = __VLS_265({
    ...{ 'onClick': {} },
    variant: "text",
    disabled: (__VLS_ctx.deleteModal.busy),
}, ...__VLS_functionalComponentArgsRest(__VLS_265));
let __VLS_268;
let __VLS_269;
let __VLS_270;
const __VLS_271 = {
    onClick: (__VLS_ctx.closeDeleteModal)
};
__VLS_267.slots.default;
var __VLS_267;
const __VLS_272 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_273 = __VLS_asFunctionalComponent(__VLS_272, new __VLS_272({
    ...{ 'onClick': {} },
    color: "error",
    disabled: (!__VLS_ctx.canConfirmDelete || __VLS_ctx.deleteModal.busy),
    loading: (__VLS_ctx.deleteModal.busy),
}));
const __VLS_274 = __VLS_273({
    ...{ 'onClick': {} },
    color: "error",
    disabled: (!__VLS_ctx.canConfirmDelete || __VLS_ctx.deleteModal.busy),
    loading: (__VLS_ctx.deleteModal.busy),
}, ...__VLS_functionalComponentArgsRest(__VLS_273));
let __VLS_276;
let __VLS_277;
let __VLS_278;
const __VLS_279 = {
    onClick: (__VLS_ctx.onConfirmDelete)
};
__VLS_275.slots.default;
var __VLS_275;
var __VLS_259;
var __VLS_211;
var __VLS_207;
const __VLS_280 = {}.VSnackbar;
/** @type {[typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, ]} */ ;
// @ts-ignore
const __VLS_281 = __VLS_asFunctionalComponent(__VLS_280, new __VLS_280({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}));
const __VLS_282 = __VLS_281({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}, ...__VLS_functionalComponentArgsRest(__VLS_281));
__VLS_283.slots.default;
(__VLS_ctx.snackbar.text);
var __VLS_283;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ga-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['my-1']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-grey-lighten-3']} */ ;
/** @type {__VLS_StyleScopedClasses['my-1']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['ga-2']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['ga-2']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['d-inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['my-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ListingStatusFilter: ListingStatusFilter,
            PLATFORM_OPTIONS: PLATFORM_OPTIONS,
            platformImage: platformImage,
            platformLabel: platformLabel,
            SORT_OPTIONS: SORT_OPTIONS,
            listings: listings,
            page: page,
            search: search,
            sort: sort,
            selectedPlatforms: selectedPlatforms,
            selectedAccountIds: selectedAccountIds,
            statusFilter: statusFilter,
            accountOptions: accountOptions,
            hasActiveFilters: hasActiveFilters,
            clearFilters: clearFilters,
            snackbar: snackbar,
            publishModal: publishModal,
            deleteModal: deleteModal,
            canConfirmDelete: canConfirmDelete,
            totalPages: totalPages,
            ENTRY_BADGE_COLOR: ENTRY_BADGE_COLOR,
            getPlatformEntries: getPlatformEntries,
            openPublishModal: openPublishModal,
            onPublish: onPublish,
            closePublishModal: closePublishModal,
            openDeleteModal: openDeleteModal,
            closeDeleteModal: closeDeleteModal,
            onConfirmDelete: onConfirmDelete,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=ListingsView.vue.js.map