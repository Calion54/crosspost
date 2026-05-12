import { ref, onUnmounted } from 'vue';
import { Platform } from '@crosspost/shared';
import apiClient from '@/api/client';
const platforms = [
    { label: 'Leboncoin', value: Platform.LEBONCOIN },
    { label: 'Vinted', value: Platform.VINTED },
];
const accounts = ref([]);
const isLoading = ref(false);
const connecting = ref(false);
const connectError = ref('');
const checkingId = ref(null);
const removingId = ref(null);
const syncingId = ref(null);
const syncMessage = ref('');
let pollTimer = null;
let syncPollTimer = null;
async function fetchAccounts() {
    isLoading.value = true;
    try {
        const { data } = await apiClient.get('/accounts');
        accounts.value = data;
    }
    finally {
        isLoading.value = false;
    }
}
async function pollConnectStatus(sessionId) {
    pollTimer = setInterval(async () => {
        try {
            const { data } = await apiClient.get(`/accounts/connect/${sessionId}/status`);
            if (data.status === 'success') {
                stopPolling();
                connecting.value = false;
                await fetchAccounts();
            }
            else if (data.status === 'error') {
                stopPolling();
                connecting.value = false;
                connectError.value = data.error || 'La connexion a echoue';
            }
        }
        catch {
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
async function connectAccount(platform) {
    connecting.value = true;
    connectError.value = '';
    try {
        const { data } = await apiClient.post('/accounts/connect', { platform });
        pollConnectStatus(data.sessionId);
    }
    catch {
        connecting.value = false;
        connectError.value = 'Impossible de lancer la connexion';
    }
}
const checkResult = ref(null);
async function checkSession(id) {
    checkingId.value = id;
    checkResult.value = null;
    try {
        const { data } = await apiClient.post(`/accounts/${id}/check-session`);
        checkResult.value = { id, isValid: data.isValid };
        await fetchAccounts();
        setTimeout(() => {
            if (checkResult.value?.id === id)
                checkResult.value = null;
        }, 5000);
    }
    finally {
        checkingId.value = null;
    }
}
async function reconnect(id) {
    connecting.value = true;
    connectError.value = '';
    try {
        const { data } = await apiClient.post(`/accounts/${id}/reconnect`);
        pollConnectStatus(data.sessionId);
    }
    catch {
        connecting.value = false;
        connectError.value = 'Impossible de relancer la connexion';
    }
}
async function removeAccount(id) {
    removingId.value = id;
    try {
        await apiClient.delete(`/accounts/${id}`);
        await fetchAccounts();
    }
    finally {
        removingId.value = null;
    }
}
async function syncAccount(accountId) {
    syncingId.value = accountId;
    syncMessage.value = '';
    try {
        const { data } = await apiClient.post(`/sync/${accountId}`);
        pollSyncStatus(data.sessionId, accountId);
    }
    catch {
        syncingId.value = null;
        syncMessage.value = 'Impossible de lancer la synchronisation';
    }
}
function pollSyncStatus(sessionId, accountId) {
    syncPollTimer = setInterval(async () => {
        try {
            const { data } = await apiClient.get(`/sync/${sessionId}/status`);
            if (data.status === 'success') {
                stopSyncPolling();
                syncingId.value = null;
                syncMessage.value = `${data.found} annonces trouvees, ${data.created} nouvelles importees`;
            }
            else if (data.status === 'error') {
                stopSyncPolling();
                syncingId.value = null;
                syncMessage.value = data.error || 'La synchronisation a echoue';
            }
        }
        catch {
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
const __VLS_4 = {}.VMenu;
/** @type {[typeof __VLS_components.VMenu, typeof __VLS_components.vMenu, typeof __VLS_components.VMenu, typeof __VLS_components.vMenu, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
{
    const { activator: __VLS_thisSlot } = __VLS_7.slots;
    const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
    const __VLS_8 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        color: "primary",
        prependIcon: "mdi-plus",
        ...(props),
        disabled: (__VLS_ctx.connecting),
    }));
    const __VLS_10 = __VLS_9({
        color: "primary",
        prependIcon: "mdi-plus",
        ...(props),
        disabled: (__VLS_ctx.connecting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_11.slots.default;
    var __VLS_11;
}
const __VLS_12 = {}.VList;
/** @type {[typeof __VLS_components.VList, typeof __VLS_components.vList, typeof __VLS_components.VList, typeof __VLS_components.vList, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({}));
const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_15.slots.default;
for (const [p] of __VLS_getVForSourceType((__VLS_ctx.platforms))) {
    const __VLS_16 = {}.VListItem;
    /** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        ...{ 'onClick': {} },
        key: (p.value),
        title: (p.label),
    }));
    const __VLS_18 = __VLS_17({
        ...{ 'onClick': {} },
        key: (p.value),
        title: (p.label),
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    let __VLS_20;
    let __VLS_21;
    let __VLS_22;
    const __VLS_23 = {
        onClick: (...[$event]) => {
            __VLS_ctx.connectAccount(p.value);
        }
    };
    var __VLS_19;
}
var __VLS_15;
var __VLS_7;
if (__VLS_ctx.connecting) {
    const __VLS_24 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        type: "info",
        ...{ class: "mb-4" },
    }));
    const __VLS_26 = __VLS_25({
        type: "info",
        ...{ class: "mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_27.slots.default;
    const __VLS_28 = {}.VProgressLinear;
    /** @type {[typeof __VLS_components.VProgressLinear, typeof __VLS_components.vProgressLinear, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        indeterminate: true,
        ...{ class: "mt-2" },
    }));
    const __VLS_30 = __VLS_29({
        indeterminate: true,
        ...{ class: "mt-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    var __VLS_27;
}
if (__VLS_ctx.connectError) {
    const __VLS_32 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        ...{ 'onClick:close': {} },
        type: "error",
        ...{ class: "mb-4" },
        closable: true,
    }));
    const __VLS_34 = __VLS_33({
        ...{ 'onClick:close': {} },
        type: "error",
        ...{ class: "mb-4" },
        closable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    let __VLS_36;
    let __VLS_37;
    let __VLS_38;
    const __VLS_39 = {
        'onClick:close': (...[$event]) => {
            if (!(__VLS_ctx.connectError))
                return;
            __VLS_ctx.connectError = '';
        }
    };
    __VLS_35.slots.default;
    (__VLS_ctx.connectError);
    var __VLS_35;
}
if (__VLS_ctx.syncMessage) {
    const __VLS_40 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        ...{ 'onClick:close': {} },
        type: "info",
        ...{ class: "mb-4" },
        closable: true,
    }));
    const __VLS_42 = __VLS_41({
        ...{ 'onClick:close': {} },
        type: "info",
        ...{ class: "mb-4" },
        closable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    let __VLS_44;
    let __VLS_45;
    let __VLS_46;
    const __VLS_47 = {
        'onClick:close': (...[$event]) => {
            if (!(__VLS_ctx.syncMessage))
                return;
            __VLS_ctx.syncMessage = '';
        }
    };
    __VLS_43.slots.default;
    (__VLS_ctx.syncMessage);
    var __VLS_43;
}
const __VLS_48 = {}.VTable;
/** @type {[typeof __VLS_components.VTable, typeof __VLS_components.vTable, typeof __VLS_components.VTable, typeof __VLS_components.vTable, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({}));
const __VLS_50 = __VLS_49({}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
if (!__VLS_ctx.accounts.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "5",
        ...{ class: "text-center text-medium-emphasis pa-4" },
    });
}
for (const [account] of __VLS_getVForSourceType((__VLS_ctx.accounts))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (account._id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (account.platform);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (account.username);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    const __VLS_52 = {}.VChip;
    /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        color: (account.isConnected ? 'success' : 'error'),
        size: "small",
    }));
    const __VLS_54 = __VLS_53({
        color: (account.isConnected ? 'success' : 'error'),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    __VLS_55.slots.default;
    (account.isConnected ? 'Connecte' : 'Session expiree');
    var __VLS_55;
    if (__VLS_ctx.checkResult && __VLS_ctx.checkResult.id === account._id) {
        const __VLS_56 = {}.VIcon;
        /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
            icon: (__VLS_ctx.checkResult.isValid ? 'mdi-check-circle' : 'mdi-alert-circle'),
            color: (__VLS_ctx.checkResult.isValid ? 'success' : 'error'),
            size: "small",
            ...{ class: "ml-2" },
        }));
        const __VLS_58 = __VLS_57({
            icon: (__VLS_ctx.checkResult.isValid ? 'mdi-check-circle' : 'mdi-alert-circle'),
            color: (__VLS_ctx.checkResult.isValid ? 'success' : 'error'),
            size: "small",
            ...{ class: "ml-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (account.lastCheckedAt ? new Date(account.lastCheckedAt).toLocaleString('fr-FR') : '-');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    const __VLS_60 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        text: "Verifier la session",
    }));
    const __VLS_62 = __VLS_61({
        text: "Verifier la session",
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
            icon: "mdi-refresh",
            size: "small",
            variant: "text",
            loading: (__VLS_ctx.checkingId === account._id),
        }));
        const __VLS_66 = __VLS_65({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-refresh",
            size: "small",
            variant: "text",
            loading: (__VLS_ctx.checkingId === account._id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        let __VLS_68;
        let __VLS_69;
        let __VLS_70;
        const __VLS_71 = {
            onClick: (...[$event]) => {
                __VLS_ctx.checkSession(account._id);
            }
        };
        var __VLS_67;
    }
    var __VLS_63;
    if (!account.isConnected) {
        const __VLS_72 = {}.VTooltip;
        /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
            text: "Reconnecter",
        }));
        const __VLS_74 = __VLS_73({
            text: "Reconnecter",
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        __VLS_75.slots.default;
        {
            const { activator: __VLS_thisSlot } = __VLS_75.slots;
            const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_76 = {}.VBtn;
            /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
            // @ts-ignore
            const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-link-variant",
                size: "small",
                variant: "text",
                color: "warning",
                disabled: (__VLS_ctx.connecting),
            }));
            const __VLS_78 = __VLS_77({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-link-variant",
                size: "small",
                variant: "text",
                color: "warning",
                disabled: (__VLS_ctx.connecting),
            }, ...__VLS_functionalComponentArgsRest(__VLS_77));
            let __VLS_80;
            let __VLS_81;
            let __VLS_82;
            const __VLS_83 = {
                onClick: (...[$event]) => {
                    if (!(!account.isConnected))
                        return;
                    __VLS_ctx.reconnect(account._id);
                }
            };
            var __VLS_79;
        }
        var __VLS_75;
    }
    if (account.isConnected) {
        const __VLS_84 = {}.VTooltip;
        /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
        // @ts-ignore
        const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
            text: "Synchroniser les annonces",
        }));
        const __VLS_86 = __VLS_85({
            text: "Synchroniser les annonces",
        }, ...__VLS_functionalComponentArgsRest(__VLS_85));
        __VLS_87.slots.default;
        {
            const { activator: __VLS_thisSlot } = __VLS_87.slots;
            const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_88 = {}.VBtn;
            /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
            // @ts-ignore
            const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-sync",
                size: "small",
                variant: "text",
                color: "primary",
                loading: (__VLS_ctx.syncingId === account._id),
            }));
            const __VLS_90 = __VLS_89({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-sync",
                size: "small",
                variant: "text",
                color: "primary",
                loading: (__VLS_ctx.syncingId === account._id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_89));
            let __VLS_92;
            let __VLS_93;
            let __VLS_94;
            const __VLS_95 = {
                onClick: (...[$event]) => {
                    if (!(account.isConnected))
                        return;
                    __VLS_ctx.syncAccount(account._id);
                }
            };
            var __VLS_91;
        }
        var __VLS_87;
    }
    const __VLS_96 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        text: "Supprimer",
    }));
    const __VLS_98 = __VLS_97({
        text: "Supprimer",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_99.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_100 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
            loading: (__VLS_ctx.removingId === account._id),
        }));
        const __VLS_102 = __VLS_101({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
            loading: (__VLS_ctx.removingId === account._id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_101));
        let __VLS_104;
        let __VLS_105;
        let __VLS_106;
        const __VLS_107 = {
            onClick: (...[$event]) => {
                __VLS_ctx.removeAccount(account._id);
            }
        };
        var __VLS_103;
    }
    var __VLS_99;
}
var __VLS_51;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            platforms: platforms,
            accounts: accounts,
            connecting: connecting,
            connectError: connectError,
            checkingId: checkingId,
            removingId: removingId,
            syncingId: syncingId,
            syncMessage: syncMessage,
            connectAccount: connectAccount,
            checkResult: checkResult,
            checkSession: checkSession,
            reconnect: reconnect,
            removeAccount: removeAccount,
            syncAccount: syncAccount,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=AccountsView.vue.js.map