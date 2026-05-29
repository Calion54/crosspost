import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import apiClient from '@/api/client';
import leboncoinIcon from '@/assets/leboncoin.png';
import vintedIcon from '@/assets/vinted.png';
const ALL_PLATFORMS = ['leboncoin', 'vinted'];
const PER_PAGE = 20;
const listings = ref([]);
const accounts = ref([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
const debouncedSearch = ref('');
let searchTimer = null;
const snackbar = reactive({ show: false, text: '', color: 'success' });
const publishModal = reactive({
    show: false,
    listing: null,
    accounts: [],
    selected: [],
});
const publishSessions = reactive({});
const isPublishing = computed(() => Object.values(publishSessions).some((s) => s.status === 'publishing'));
const totalPages = computed(() => Math.ceil(total.value / PER_PAGE));
const PLATFORM_IMAGES = {
    leboncoin: leboncoinIcon,
    vinted: vintedIcon,
};
function platformImage(platform) {
    return PLATFORM_IMAGES[platform] || '';
}
function platformLabel(platform) {
    if (platform === 'leboncoin')
        return 'Leboncoin';
    if (platform === 'vinted')
        return 'Vinted';
    return platform;
}
function getPublicationStatus(listing, platform) {
    if (!listing)
        return null;
    const pub = listing.publications?.find((p) => p.platform === platform);
    return pub?.status || null;
}
function getPublicationUrl(listing, platform) {
    if (!listing)
        return null;
    const pub = listing.publications?.find((p) => p.platform === platform && p.status === 'published');
    return pub?.externalUrl || null;
}
function platformBadgeColor(listing, platform) {
    const status = getPublicationStatus(listing, platform);
    if (status === 'published')
        return 'success';
    if (status === 'failed')
        return 'error';
    return 'grey';
}
function platformTooltip(listing, platform) {
    const status = getPublicationStatus(listing, platform);
    const label = platformLabel(platform);
    if (status === 'published')
        return `${label} — Publiee`;
    if (status === 'failed')
        return `${label} — Echec`;
    if (status === 'pending')
        return `${label} — En cours`;
    return `${label} — Non publiee`;
}
function openPublishModal(listing) {
    const publishedPlatforms = new Set(listing.publications
        ?.filter((p) => ['published', 'pending'].includes(p.status))
        .map((p) => p.platform) || []);
    const available = accounts.value.filter((a) => a.isConnected && !publishedPlatforms.has(a.platform));
    publishModal.listing = listing;
    publishModal.accounts = available;
    publishModal.selected = available.map((a) => a._id);
    // Clear previous sessions
    for (const key of Object.keys(publishSessions))
        delete publishSessions[key];
    publishModal.show = true;
}
async function onPublish() {
    const listingId = publishModal.listing._id;
    const selectedAccounts = publishModal.accounts.filter((a) => publishModal.selected.includes(a._id));
    // Publish synchrone (Étape 4) — ~10-30s par compte. Étape 5 passera en BullMQ + SSE.
    // On lance en parallèle (Promise.all) mais chaque compte attend sa réponse.
    await Promise.all(selectedAccounts.map(async (acc) => {
        publishSessions[acc._id] = {
            accountId: acc._id,
            platform: acc.platform,
            status: 'publishing',
            stepLabel: 'Publication en cours…',
        };
        try {
            const { data } = await apiClient.post('/publish', { listingId, accountId: acc._id });
            publishSessions[acc._id].status = 'success';
            publishSessions[acc._id].stepLabel = `Publiée → ${data.externalUrl}`;
        }
        catch (err) {
            publishSessions[acc._id].status = 'error';
            publishSessions[acc._id].stepLabel =
                err?.response?.data?.message ?? err?.message ?? 'Erreur';
        }
    }));
    await fetchData();
}
function closePublishModal() {
    publishModal.show = false;
}
async function fetchData() {
    const params = { page: page.value, limit: PER_PAGE };
    const q = debouncedSearch.value.trim();
    if (q)
        params.q = q;
    const [listingsRes, accountsRes] = await Promise.all([
        apiClient.get('/listings', { params }),
        apiClient.get('/accounts'),
    ]);
    listings.value = listingsRes.data.items;
    total.value = listingsRes.data.total;
    accounts.value = accountsRes.data;
}
watch(page, fetchData);
watch(search, (val) => {
    if (searchTimer)
        clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        debouncedSearch.value = val ?? '';
        if (page.value !== 1) {
            page.value = 1;
        }
        else {
            fetchData();
        }
    }, 300);
});
async function removeListing(id) {
    if (!confirm('Supprimer cette annonce sur toutes les plateformes ?'))
        return;
    try {
        const { data } = await apiClient.delete(`/listings/${id}`);
        // eslint-disable-next-line no-console
        console.log('[delete] API response:', data);
        const lines = [];
        let allOk = true;
        for (const r of data.results) {
            const label = platformLabel(r.platform);
            const status = r.result?.status;
            if (status === 'deleted') {
                lines.push(`${label} : annonce supprimée ✓`);
            }
            else if (status === 'already_gone') {
                lines.push(`${label} : déjà absente côté plateforme (${r.result.message ?? 'HTTP 4xx'})`);
            }
            else {
                allOk = false;
                lines.push(`${label} : échec (${r.result?.message ?? status ?? '—'})`);
            }
        }
        if (!data.results.length) {
            lines.push('Aucune publication à supprimer.');
        }
        snackbar.text = lines.join(' · ');
        snackbar.color = allOk ? 'success' : 'warning';
        snackbar.show = true;
        await fetchData();
    }
    catch (err) {
        snackbar.text = err?.response?.data?.message ?? 'Suppression échouée';
        snackbar.color = 'error';
        snackbar.show = true;
    }
}
onMounted(fetchData);
onUnmounted(() => {
    // rien à nettoyer (la publication est synchrone via await)
});
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
const __VLS_8 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    color: "primary",
    prependIcon: "mdi-plus",
    to: "/listings/new",
}));
const __VLS_10 = __VLS_9({
    color: "primary",
    prependIcon: "mdi-plus",
    to: "/listings/new",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_11.slots.default;
var __VLS_11;
const __VLS_12 = {}.VTable;
/** @type {[typeof __VLS_components.VTable, typeof __VLS_components.vTable, typeof __VLS_components.VTable, typeof __VLS_components.vTable, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
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
        const __VLS_16 = {}.VImg;
        /** @type {[typeof __VLS_components.VImg, typeof __VLS_components.vImg, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            src: (listing.mediaUrls[0]),
            width: "60",
            height: "60",
            cover: true,
            ...{ class: "rounded my-1" },
        }));
        const __VLS_18 = __VLS_17({
            src: (listing.mediaUrls[0]),
            width: "60",
            height: "60",
            cover: true,
            ...{ class: "rounded my-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "d-flex align-center justify-center rounded bg-grey-lighten-3 my-1" },
            ...{ style: {} },
        });
        const __VLS_20 = {}.VIcon;
        /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            color: "grey",
            size: "24",
        }));
        const __VLS_22 = __VLS_21({
            color: "grey",
            size: "24",
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        __VLS_23.slots.default;
        var __VLS_23;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (listing.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (listing.price);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-flex ga-3 align-center" },
    });
    for (const [platform] of __VLS_getVForSourceType((__VLS_ctx.ALL_PLATFORMS))) {
        const __VLS_24 = {}.VTooltip;
        /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
            key: (platform),
            text: (__VLS_ctx.platformTooltip(listing, platform)),
        }));
        const __VLS_26 = __VLS_25({
            key: (platform),
            text: (__VLS_ctx.platformTooltip(listing, platform)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_25));
        __VLS_27.slots.default;
        {
            const { activator: __VLS_thisSlot } = __VLS_27.slots;
            const { props: tooltipProps } = __VLS_getSlotParam(__VLS_thisSlot);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
                ...(tooltipProps),
                href: (__VLS_ctx.getPublicationUrl(listing, platform) || undefined),
                target: (__VLS_ctx.getPublicationUrl(listing, platform) ? '_blank' : undefined),
                ...{ class: "d-inline-block" },
                ...{ style: ({ opacity: __VLS_ctx.getPublicationStatus(listing, platform) ? 1 : 0.35 }) },
            });
            const __VLS_28 = {}.VBadge;
            /** @type {[typeof __VLS_components.VBadge, typeof __VLS_components.vBadge, typeof __VLS_components.VBadge, typeof __VLS_components.vBadge, ]} */ ;
            // @ts-ignore
            const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
                color: (__VLS_ctx.platformBadgeColor(listing, platform)),
                dot: true,
                location: "bottom end",
                offsetX: "2",
                offsetY: "2",
            }));
            const __VLS_30 = __VLS_29({
                color: (__VLS_ctx.platformBadgeColor(listing, platform)),
                dot: true,
                location: "bottom end",
                offsetX: "2",
                offsetY: "2",
            }, ...__VLS_functionalComponentArgsRest(__VLS_29));
            __VLS_31.slots.default;
            const __VLS_32 = {}.VAvatar;
            /** @type {[typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, typeof __VLS_components.VAvatar, typeof __VLS_components.vAvatar, ]} */ ;
            // @ts-ignore
            const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
                size: "28",
                rounded: "lg",
            }));
            const __VLS_34 = __VLS_33({
                size: "28",
                rounded: "lg",
            }, ...__VLS_functionalComponentArgsRest(__VLS_33));
            __VLS_35.slots.default;
            const __VLS_36 = {}.VImg;
            /** @type {[typeof __VLS_components.VImg, typeof __VLS_components.vImg, ]} */ ;
            // @ts-ignore
            const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
                src: (__VLS_ctx.platformImage(platform)),
                alt: (__VLS_ctx.platformLabel(platform)),
            }));
            const __VLS_38 = __VLS_37({
                src: (__VLS_ctx.platformImage(platform)),
                alt: (__VLS_ctx.platformLabel(platform)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_37));
            var __VLS_35;
            var __VLS_31;
        }
        var __VLS_27;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    const __VLS_40 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        text: "Publier",
    }));
    const __VLS_42 = __VLS_41({
        text: "Publier",
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_43.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_43.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_44 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-publish",
            size: "small",
            variant: "text",
            color: "primary",
        }));
        const __VLS_46 = __VLS_45({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-publish",
            size: "small",
            variant: "text",
            color: "primary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
        let __VLS_48;
        let __VLS_49;
        let __VLS_50;
        const __VLS_51 = {
            onClick: (...[$event]) => {
                __VLS_ctx.openPublishModal(listing);
            }
        };
        var __VLS_47;
    }
    var __VLS_43;
    const __VLS_52 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        text: "Modifier",
    }));
    const __VLS_54 = __VLS_53({
        text: "Modifier",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    __VLS_55.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_55.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_56 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
            ...(props),
            icon: "mdi-pencil",
            size: "small",
            variant: "text",
            to: (`/listings/${listing._id}`),
        }));
        const __VLS_58 = __VLS_57({
            ...(props),
            icon: "mdi-pencil",
            size: "small",
            variant: "text",
            to: (`/listings/${listing._id}`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    }
    var __VLS_55;
    const __VLS_60 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        text: "Supprimer",
    }));
    const __VLS_62 = __VLS_61({
        text: "Supprimer",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_63.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_63.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_64 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
        }));
        const __VLS_66 = __VLS_65({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        let __VLS_68;
        let __VLS_69;
        let __VLS_70;
        const __VLS_71 = {
            onClick: (...[$event]) => {
                __VLS_ctx.removeListing(listing._id);
            }
        };
        var __VLS_67;
    }
    var __VLS_63;
}
var __VLS_15;
if (__VLS_ctx.totalPages > 1) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-flex justify-center mt-4" },
    });
    const __VLS_72 = {}.VPagination;
    /** @type {[typeof __VLS_components.VPagination, typeof __VLS_components.vPagination, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        modelValue: (__VLS_ctx.page),
        length: (__VLS_ctx.totalPages),
        rounded: true,
    }));
    const __VLS_74 = __VLS_73({
        modelValue: (__VLS_ctx.page),
        length: (__VLS_ctx.totalPages),
        rounded: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
}
const __VLS_76 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    modelValue: (__VLS_ctx.publishModal.show),
    maxWidth: "450",
}));
const __VLS_78 = __VLS_77({
    modelValue: (__VLS_ctx.publishModal.show),
    maxWidth: "450",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
const __VLS_80 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({}));
const __VLS_82 = __VLS_81({}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
const __VLS_84 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({}));
const __VLS_86 = __VLS_85({}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
var __VLS_87;
if (__VLS_ctx.publishModal.listing) {
    const __VLS_88 = {}.VCardSubtitle;
    /** @type {[typeof __VLS_components.VCardSubtitle, typeof __VLS_components.vCardSubtitle, typeof __VLS_components.VCardSubtitle, typeof __VLS_components.vCardSubtitle, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        ...{ class: "pb-0" },
    }));
    const __VLS_90 = __VLS_89({
        ...{ class: "pb-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    __VLS_91.slots.default;
    (__VLS_ctx.publishModal.listing.title);
    var __VLS_91;
}
const __VLS_92 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({}));
const __VLS_94 = __VLS_93({}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
if (__VLS_ctx.publishModal.accounts.length) {
    const __VLS_96 = {}.VList;
    /** @type {[typeof __VLS_components.VList, typeof __VLS_components.vList, typeof __VLS_components.VList, typeof __VLS_components.vList, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        selectStrategy: "classic",
        selected: (__VLS_ctx.publishModal.selected),
    }));
    const __VLS_98 = __VLS_97({
        selectStrategy: "classic",
        selected: (__VLS_ctx.publishModal.selected),
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.publishModal.accounts))) {
        const __VLS_100 = {}.VListItem;
        /** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            key: (acc._id),
            value: (acc._id),
        }));
        const __VLS_102 = __VLS_101({
            key: (acc._id),
            value: (acc._id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        __VLS_103.slots.default;
        {
            const { prepend: __VLS_thisSlot } = __VLS_103.slots;
            const [{ isActive }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_104 = {}.VListItemAction;
            /** @type {[typeof __VLS_components.VListItemAction, typeof __VLS_components.vListItemAction, typeof __VLS_components.VListItemAction, typeof __VLS_components.vListItemAction, ]} */ ;
            // @ts-ignore
            const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
                start: true,
            }));
            const __VLS_106 = __VLS_105({
                start: true,
            }, ...__VLS_functionalComponentArgsRest(__VLS_105));
            __VLS_107.slots.default;
            const __VLS_108 = {}.VCheckboxBtn;
            /** @type {[typeof __VLS_components.VCheckboxBtn, typeof __VLS_components.vCheckboxBtn, ]} */ ;
            // @ts-ignore
            const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
                modelValue: (isActive),
            }));
            const __VLS_110 = __VLS_109({
                modelValue: (isActive),
            }, ...__VLS_functionalComponentArgsRest(__VLS_109));
            var __VLS_107;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                src: (__VLS_ctx.platformImage(acc.platform)),
                alt: (__VLS_ctx.platformLabel(acc.platform)),
                width: "28",
                height: "28",
                ...{ class: "rounded mr-3" },
            });
        }
        const __VLS_112 = {}.VListItemTitle;
        /** @type {[typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, typeof __VLS_components.VListItemTitle, typeof __VLS_components.vListItemTitle, ]} */ ;
        // @ts-ignore
        const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({}));
        const __VLS_114 = __VLS_113({}, ...__VLS_functionalComponentArgsRest(__VLS_113));
        __VLS_115.slots.default;
        (__VLS_ctx.platformLabel(acc.platform));
        var __VLS_115;
        const __VLS_116 = {}.VListItemSubtitle;
        /** @type {[typeof __VLS_components.VListItemSubtitle, typeof __VLS_components.vListItemSubtitle, typeof __VLS_components.VListItemSubtitle, typeof __VLS_components.vListItemSubtitle, ]} */ ;
        // @ts-ignore
        const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({}));
        const __VLS_118 = __VLS_117({}, ...__VLS_functionalComponentArgsRest(__VLS_117));
        __VLS_119.slots.default;
        (acc.username);
        var __VLS_119;
        var __VLS_103;
    }
    var __VLS_99;
    if (Object.keys(__VLS_ctx.publishSessions).length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mt-2" },
        });
        for (const [session] of __VLS_getVForSourceType((Object.values(__VLS_ctx.publishSessions)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (session.accountId),
                ...{ class: "d-flex align-center mb-2" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
                src: (__VLS_ctx.platformImage(session.platform)),
                width: "20",
                height: "20",
                ...{ class: "rounded mr-2" },
            });
            if (session.status === 'publishing') {
                const __VLS_120 = {}.VProgressCircular;
                /** @type {[typeof __VLS_components.VProgressCircular, typeof __VLS_components.vProgressCircular, ]} */ ;
                // @ts-ignore
                const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
                    indeterminate: true,
                    size: "16",
                    width: "2",
                    ...{ class: "mr-2" },
                }));
                const __VLS_122 = __VLS_121({
                    indeterminate: true,
                    size: "16",
                    width: "2",
                    ...{ class: "mr-2" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_121));
            }
            else if (session.status === 'success') {
                const __VLS_124 = {}.VIcon;
                /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
                // @ts-ignore
                const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
                    color: "success",
                    size: "16",
                    ...{ class: "mr-2" },
                }));
                const __VLS_126 = __VLS_125({
                    color: "success",
                    size: "16",
                    ...{ class: "mr-2" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_125));
                __VLS_127.slots.default;
                var __VLS_127;
            }
            else if (session.status === 'error') {
                const __VLS_128 = {}.VIcon;
                /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
                // @ts-ignore
                const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
                    color: "error",
                    size: "16",
                    ...{ class: "mr-2" },
                }));
                const __VLS_130 = __VLS_129({
                    color: "error",
                    size: "16",
                    ...{ class: "mr-2" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_129));
                __VLS_131.slots.default;
                var __VLS_131;
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-body-2" },
            });
            (session.stepLabel);
        }
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-medium-emphasis text-center pa-4" },
    });
    const __VLS_132 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
    // @ts-ignore
    const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
        to: "/accounts",
    }));
    const __VLS_134 = __VLS_133({
        to: "/accounts",
    }, ...__VLS_functionalComponentArgsRest(__VLS_133));
    __VLS_135.slots.default;
    var __VLS_135;
}
var __VLS_95;
const __VLS_136 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({}));
const __VLS_138 = __VLS_137({}, ...__VLS_functionalComponentArgsRest(__VLS_137));
__VLS_139.slots.default;
const __VLS_140 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
const __VLS_141 = __VLS_asFunctionalComponent(__VLS_140, new __VLS_140({}));
const __VLS_142 = __VLS_141({}, ...__VLS_functionalComponentArgsRest(__VLS_141));
const __VLS_144 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
    ...{ 'onClick': {} },
    variant: "text",
}));
const __VLS_146 = __VLS_145({
    ...{ 'onClick': {} },
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_145));
let __VLS_148;
let __VLS_149;
let __VLS_150;
const __VLS_151 = {
    onClick: (__VLS_ctx.closePublishModal)
};
__VLS_147.slots.default;
var __VLS_147;
if (__VLS_ctx.publishModal.accounts.length) {
    const __VLS_152 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
        ...{ 'onClick': {} },
        color: "primary",
        disabled: (!__VLS_ctx.publishModal.selected.length || __VLS_ctx.isPublishing),
        loading: (__VLS_ctx.isPublishing),
    }));
    const __VLS_154 = __VLS_153({
        ...{ 'onClick': {} },
        color: "primary",
        disabled: (!__VLS_ctx.publishModal.selected.length || __VLS_ctx.isPublishing),
        loading: (__VLS_ctx.isPublishing),
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    let __VLS_156;
    let __VLS_157;
    let __VLS_158;
    const __VLS_159 = {
        onClick: (__VLS_ctx.onPublish)
    };
    __VLS_155.slots.default;
    (__VLS_ctx.publishModal.selected.length);
    var __VLS_155;
}
var __VLS_139;
var __VLS_83;
var __VLS_79;
const __VLS_160 = {}.VSnackbar;
/** @type {[typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}));
const __VLS_162 = __VLS_161({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
__VLS_163.slots.default;
(__VLS_ctx.snackbar.text);
var __VLS_163;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
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
/** @type {__VLS_StyleScopedClasses['ga-3']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['d-inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ALL_PLATFORMS: ALL_PLATFORMS,
            listings: listings,
            page: page,
            search: search,
            snackbar: snackbar,
            publishModal: publishModal,
            publishSessions: publishSessions,
            isPublishing: isPublishing,
            totalPages: totalPages,
            platformImage: platformImage,
            platformLabel: platformLabel,
            getPublicationStatus: getPublicationStatus,
            getPublicationUrl: getPublicationUrl,
            platformBadgeColor: platformBadgeColor,
            platformTooltip: platformTooltip,
            openPublishModal: openPublishModal,
            onPublish: onPublish,
            closePublishModal: closePublishModal,
            removeListing: removeListing,
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