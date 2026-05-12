import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import apiClient from '@/api/client';
const listings = ref([]);
const accounts = ref([]);
const selectedAccountId = ref(null);
const publishing = reactive({});
const snackbar = reactive({ show: false, text: '', color: 'success' });
const publishDialog = reactive({
    show: false,
    status: '',
    platform: '',
    stepLabel: '',
    error: '',
    externalUrl: '',
});
let pollTimer = null;
const STEP_LABELS = {
    starting: 'Demarrage...',
    navigating: 'Navigation vers le formulaire...',
    filling_form: 'Remplissage du formulaire...',
    uploading_images: 'Upload des photos...',
    pre_submit_review: 'Verification avant soumission...',
    submitting: 'Soumission de l\'annonce...',
    verifying: 'Verification de la publication...',
};
const accountOptions = computed(() => accounts.value.map((a) => ({
    title: `${a.platform} — ${a.username}`,
    value: a._id,
})));
const filteredListings = computed(() => {
    if (!selectedAccountId.value)
        return listings.value;
    return listings.value.filter((l) => l.publications.some((p) => p.accountId?._id === selectedAccountId.value ||
        p.accountId === selectedAccountId.value));
});
function platformIcon(platform) {
    if (platform === 'leboncoin')
        return 'mdi-alpha-l-box';
    if (platform === 'vinted')
        return 'mdi-alpha-v-box';
    return 'mdi-web';
}
function platformLabel(platform) {
    if (platform === 'leboncoin')
        return 'Leboncoin';
    if (platform === 'vinted')
        return 'Vinted';
    return platform;
}
function statusColor(status) {
    const colors = {
        published: 'success',
        draft: 'default',
        pending: 'warning',
        failed: 'error',
        removed: 'grey',
    };
    return colors[status] || 'default';
}
/** Platforms where this listing has NOT been published yet */
function missingPlatforms(listing) {
    const published = new Set(listing.publications
        .filter((p) => p.status === 'published')
        .map((p) => p.platform || p.accountId?.platform));
    return ['leboncoin', 'vinted'].filter((p) => !published.has(p));
}
/** Accounts where this listing can still be published */
function publishableAccounts(listing) {
    const publishedPlatforms = new Set(listing.publications
        .filter((p) => ['published', 'pending'].includes(p.status))
        .map((p) => p.platform || p.accountId?.platform));
    return accounts.value.filter((a) => a.isConnected && !publishedPlatforms.has(a.platform));
}
function canPublish(listing) {
    return publishableAccounts(listing).length > 0 && !publishing[listing._id];
}
async function onPublish(listingId, accountId, platform) {
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
                }
                else if (status.status === 'error') {
                    publishDialog.status = 'error';
                    publishDialog.stepLabel = 'Echec de la publication';
                    publishDialog.error = status.error || 'Erreur inconnue';
                    stopPolling();
                    publishing[listingId] = false;
                }
            }
            catch {
                // Polling error, continue
            }
        }, 2000);
    }
    catch (err) {
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
async function removeListing(id) {
    await apiClient.delete(`/listings/${id}`);
    await fetchData();
}
onMounted(fetchData);
onUnmounted(stopPolling);
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
if (__VLS_ctx.accountOptions.length) {
    const __VLS_4 = {}.VSelect;
    /** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        modelValue: (__VLS_ctx.selectedAccountId),
        items: (__VLS_ctx.accountOptions),
        label: "Filtrer par compte",
        clearable: true,
        density: "compact",
        hideDetails: true,
        ...{ class: "mr-4" },
        ...{ style: {} },
    }));
    const __VLS_6 = __VLS_5({
        modelValue: (__VLS_ctx.selectedAccountId),
        items: (__VLS_ctx.accountOptions),
        label: "Filtrer par compte",
        clearable: true,
        density: "compact",
        hideDetails: true,
        ...{ class: "mr-4" },
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
}
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
if (!__VLS_ctx.filteredListings.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "4",
        ...{ class: "text-center text-medium-emphasis pa-4" },
    });
}
for (const [listing] of __VLS_getVForSourceType((__VLS_ctx.filteredListings))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (listing._id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (listing.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (listing.price);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-flex ga-1 align-center" },
    });
    for (const [pub] of __VLS_getVForSourceType((listing.publications))) {
        const __VLS_16 = {}.VChip;
        /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            key: (pub._id),
            color: (__VLS_ctx.statusColor(pub.status)),
            href: (pub.externalUrl || undefined),
            target: (pub.externalUrl ? '_blank' : undefined),
            size: "small",
            prependIcon: (__VLS_ctx.platformIcon(pub.platform)),
        }));
        const __VLS_18 = __VLS_17({
            key: (pub._id),
            color: (__VLS_ctx.statusColor(pub.status)),
            href: (pub.externalUrl || undefined),
            target: (pub.externalUrl ? '_blank' : undefined),
            size: "small",
            prependIcon: (__VLS_ctx.platformIcon(pub.platform)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
        __VLS_19.slots.default;
        (__VLS_ctx.platformLabel(pub.platform));
        {
            const { append: __VLS_thisSlot } = __VLS_19.slots;
            if (pub.status === 'published') {
                const __VLS_20 = {}.VIcon;
                /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
                // @ts-ignore
                const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
                    size: "x-small",
                    ...{ class: "ml-1" },
                }));
                const __VLS_22 = __VLS_21({
                    size: "x-small",
                    ...{ class: "ml-1" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_21));
                __VLS_23.slots.default;
                var __VLS_23;
            }
            else if (pub.status === 'failed') {
                const __VLS_24 = {}.VIcon;
                /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
                // @ts-ignore
                const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
                    size: "x-small",
                    ...{ class: "ml-1" },
                }));
                const __VLS_26 = __VLS_25({
                    size: "x-small",
                    ...{ class: "ml-1" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_25));
                __VLS_27.slots.default;
                var __VLS_27;
            }
        }
        var __VLS_19;
    }
    for (const [platform] of __VLS_getVForSourceType((__VLS_ctx.missingPlatforms(listing)))) {
        const __VLS_28 = {}.VChip;
        /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
            key: (platform),
            size: "small",
            variant: "outlined",
            prependIcon: (__VLS_ctx.platformIcon(platform)),
        }));
        const __VLS_30 = __VLS_29({
            key: (platform),
            size: "small",
            variant: "outlined",
            prependIcon: (__VLS_ctx.platformIcon(platform)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_29));
        __VLS_31.slots.default;
        (__VLS_ctx.platformLabel(platform));
        var __VLS_31;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    const __VLS_32 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        text: "Modifier",
    }));
    const __VLS_34 = __VLS_33({
        text: "Modifier",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_35.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_35.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_36 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            ...(props),
            icon: "mdi-pencil",
            size: "small",
            variant: "text",
            to: (`/listings/${listing._id}`),
        }));
        const __VLS_38 = __VLS_37({
            ...(props),
            icon: "mdi-pencil",
            size: "small",
            variant: "text",
            to: (`/listings/${listing._id}`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    }
    var __VLS_35;
    const __VLS_40 = {}.VMenu;
    /** @type {[typeof __VLS_components.VMenu, typeof __VLS_components.vMenu, typeof __VLS_components.VMenu, typeof __VLS_components.vMenu, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
    const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_43.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_43.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_44 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
            ...(props),
            icon: "mdi-publish",
            size: "small",
            variant: "text",
            color: "primary",
            disabled: (!__VLS_ctx.canPublish(listing)),
        }));
        const __VLS_46 = __VLS_45({
            ...(props),
            icon: "mdi-publish",
            size: "small",
            variant: "text",
            color: "primary",
            disabled: (!__VLS_ctx.canPublish(listing)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    }
    const __VLS_48 = {}.VList;
    /** @type {[typeof __VLS_components.VList, typeof __VLS_components.vList, typeof __VLS_components.VList, typeof __VLS_components.vList, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        density: "compact",
    }));
    const __VLS_50 = __VLS_49({
        density: "compact",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_51.slots.default;
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.publishableAccounts(listing)))) {
        const __VLS_52 = {}.VListItem;
        /** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
        // @ts-ignore
        const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
            ...{ 'onClick': {} },
            key: (acc._id),
            prependIcon: (__VLS_ctx.platformIcon(acc.platform)),
            title: (`Publier sur ${__VLS_ctx.platformLabel(acc.platform)}`),
            subtitle: (acc.username),
            disabled: (__VLS_ctx.publishing[listing._id]),
        }));
        const __VLS_54 = __VLS_53({
            ...{ 'onClick': {} },
            key: (acc._id),
            prependIcon: (__VLS_ctx.platformIcon(acc.platform)),
            title: (`Publier sur ${__VLS_ctx.platformLabel(acc.platform)}`),
            subtitle: (acc.username),
            disabled: (__VLS_ctx.publishing[listing._id]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_53));
        let __VLS_56;
        let __VLS_57;
        let __VLS_58;
        const __VLS_59 = {
            onClick: (...[$event]) => {
                __VLS_ctx.onPublish(listing._id, acc._id, acc.platform);
            }
        };
        var __VLS_55;
    }
    if (__VLS_ctx.publishableAccounts(listing).length === 0) {
        const __VLS_60 = {}.VListItem;
        /** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
            title: "Aucun compte disponible",
            disabled: true,
        }));
        const __VLS_62 = __VLS_61({
            title: "Aucun compte disponible",
            disabled: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    }
    var __VLS_51;
    var __VLS_43;
    const __VLS_64 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        text: "Supprimer",
    }));
    const __VLS_66 = __VLS_65({
        text: "Supprimer",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    __VLS_67.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_67.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_68 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
        }));
        const __VLS_70 = __VLS_69({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
        }, ...__VLS_functionalComponentArgsRest(__VLS_69));
        let __VLS_72;
        let __VLS_73;
        let __VLS_74;
        const __VLS_75 = {
            onClick: (...[$event]) => {
                __VLS_ctx.removeListing(listing._id);
            }
        };
        var __VLS_71;
    }
    var __VLS_67;
}
var __VLS_15;
const __VLS_76 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    modelValue: (__VLS_ctx.publishDialog.show),
    maxWidth: "400",
    persistent: true,
}));
const __VLS_78 = __VLS_77({
    modelValue: (__VLS_ctx.publishDialog.show),
    maxWidth: "400",
    persistent: true,
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
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    ...{ class: "d-flex align-center" },
}));
const __VLS_86 = __VLS_85({
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
const __VLS_88 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    icon: (__VLS_ctx.platformIcon(__VLS_ctx.publishDialog.platform)),
    ...{ class: "mr-2" },
}));
const __VLS_90 = __VLS_89({
    icon: (__VLS_ctx.platformIcon(__VLS_ctx.publishDialog.platform)),
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
var __VLS_87;
const __VLS_92 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({}));
const __VLS_94 = __VLS_93({}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "d-flex align-center mb-2" },
});
if (__VLS_ctx.publishDialog.status === 'publishing') {
    const __VLS_96 = {}.VProgressCircular;
    /** @type {[typeof __VLS_components.VProgressCircular, typeof __VLS_components.vProgressCircular, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        indeterminate: true,
        size: "20",
        width: "2",
        ...{ class: "mr-3" },
    }));
    const __VLS_98 = __VLS_97({
        indeterminate: true,
        size: "20",
        width: "2",
        ...{ class: "mr-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
}
else if (__VLS_ctx.publishDialog.status === 'success') {
    const __VLS_100 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        color: "success",
        ...{ class: "mr-3" },
    }));
    const __VLS_102 = __VLS_101({
        color: "success",
        ...{ class: "mr-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    __VLS_103.slots.default;
    var __VLS_103;
}
else if (__VLS_ctx.publishDialog.status === 'error') {
    const __VLS_104 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        color: "error",
        ...{ class: "mr-3" },
    }));
    const __VLS_106 = __VLS_105({
        color: "error",
        ...{ class: "mr-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_107.slots.default;
    var __VLS_107;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.publishDialog.stepLabel);
if (__VLS_ctx.publishDialog.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-error text-caption mt-2" },
    });
    (__VLS_ctx.publishDialog.error);
}
if (__VLS_ctx.publishDialog.externalUrl) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "mt-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        href: (__VLS_ctx.publishDialog.externalUrl),
        target: "_blank",
    });
}
var __VLS_95;
if (__VLS_ctx.publishDialog.status !== 'publishing') {
    const __VLS_108 = {}.VCardActions;
    /** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({}));
    const __VLS_110 = __VLS_109({}, ...__VLS_functionalComponentArgsRest(__VLS_109));
    __VLS_111.slots.default;
    const __VLS_112 = {}.VSpacer;
    /** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({}));
    const __VLS_114 = __VLS_113({}, ...__VLS_functionalComponentArgsRest(__VLS_113));
    const __VLS_116 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        ...{ 'onClick': {} },
    }));
    const __VLS_118 = __VLS_117({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    let __VLS_120;
    let __VLS_121;
    let __VLS_122;
    const __VLS_123 = {
        onClick: (__VLS_ctx.closePublishDialog)
    };
    __VLS_119.slots.default;
    var __VLS_119;
    var __VLS_111;
}
var __VLS_83;
var __VLS_79;
const __VLS_124 = {}.VSnackbar;
/** @type {[typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, ]} */ ;
// @ts-ignore
const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}));
const __VLS_126 = __VLS_125({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}, ...__VLS_functionalComponentArgsRest(__VLS_125));
__VLS_127.slots.default;
(__VLS_ctx.snackbar.text);
var __VLS_127;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['ga-1']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            selectedAccountId: selectedAccountId,
            publishing: publishing,
            snackbar: snackbar,
            publishDialog: publishDialog,
            accountOptions: accountOptions,
            filteredListings: filteredListings,
            platformIcon: platformIcon,
            platformLabel: platformLabel,
            statusColor: statusColor,
            missingPlatforms: missingPlatforms,
            publishableAccounts: publishableAccounts,
            canPublish: canPublish,
            onPublish: onPublish,
            closePublishDialog: closePublishDialog,
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