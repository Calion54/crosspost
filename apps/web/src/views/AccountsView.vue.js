import { ref, computed, onUnmounted } from 'vue';
import { Platform } from '@crosspost/shared';
import apiClient from '@/api/client';
import VncViewer from '@/components/VncViewer.vue';
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
const vncUrl = ref(null);
const showVnc = ref(false);
const connectLocalMode = ref(false);
let eventSource = null;
let syncPollTimer = null;
const vncWsUrl = computed(() => {
    if (!vncUrl.value)
        return null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${vncUrl.value}`;
});
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
function listenToConnectEvents(sessionId) {
    closeEventSource();
    eventSource = new EventSource(`/api/accounts/connect/${sessionId}/events`);
    eventSource.onmessage = (event) => {
        try {
            const session = JSON.parse(event.data);
            if (session.status === 'browser_ready') {
                if (session.vncUrl) {
                    vncUrl.value = session.vncUrl;
                    showVnc.value = true;
                }
                else {
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
            }
            else if (session.status === 'error') {
                closeEventSource();
                connecting.value = false;
                showVnc.value = false;
                vncUrl.value = null;
                connectLocalMode.value = false;
                connectError.value = session.error || 'La connexion a echoue';
            }
        }
        catch {
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
async function connectAccount(platform) {
    connecting.value = true;
    connectError.value = '';
    vncUrl.value = null;
    connectLocalMode.value = false;
    try {
        const { data } = await apiClient.post('/accounts/connect', { platform });
        listenToConnectEvents(data.sessionId);
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
    vncUrl.value = null;
    connectLocalMode.value = false;
    try {
        const { data } = await apiClient.post(`/accounts/${id}/reconnect`);
        listenToConnectEvents(data.sessionId);
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
if (__VLS_ctx.connecting && !__VLS_ctx.showVnc) {
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
    (__VLS_ctx.connectLocalMode
        ? 'Un navigateur s\'est ouvert. Connecte-toi manuellement puis reviens ici.'
        : 'Demarrage du navigateur distant...');
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
const __VLS_48 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    modelValue: (__VLS_ctx.showVnc),
    width: "1320",
    persistent: true,
}));
const __VLS_50 = __VLS_49({
    modelValue: (__VLS_ctx.showVnc),
    width: "1320",
    persistent: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
const __VLS_52 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({}));
const __VLS_54 = __VLS_53({}, ...__VLS_functionalComponentArgsRest(__VLS_53));
__VLS_55.slots.default;
const __VLS_56 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    ...{ class: "d-flex align-center" },
}));
const __VLS_58 = __VLS_57({
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
__VLS_59.slots.default;
const __VLS_60 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({}));
const __VLS_62 = __VLS_61({}, ...__VLS_functionalComponentArgsRest(__VLS_61));
const __VLS_64 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    ...{ 'onClick': {} },
    icon: "mdi-close",
    variant: "text",
}));
const __VLS_66 = __VLS_65({
    ...{ 'onClick': {} },
    icon: "mdi-close",
    variant: "text",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
let __VLS_68;
let __VLS_69;
let __VLS_70;
const __VLS_71 = {
    onClick: (__VLS_ctx.cancelConnect)
};
var __VLS_67;
var __VLS_59;
const __VLS_72 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    ...{ class: "pa-0" },
}));
const __VLS_74 = __VLS_73({
    ...{ class: "pa-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
if (__VLS_ctx.vncWsUrl) {
    /** @type {[typeof VncViewer, ]} */ ;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent(VncViewer, new VncViewer({
        ...{ 'onDisconnect': {} },
        url: (__VLS_ctx.vncWsUrl),
    }));
    const __VLS_77 = __VLS_76({
        ...{ 'onDisconnect': {} },
        url: (__VLS_ctx.vncWsUrl),
    }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    let __VLS_79;
    let __VLS_80;
    let __VLS_81;
    const __VLS_82 = {
        onDisconnect: (__VLS_ctx.onVncDisconnect)
    };
    var __VLS_78;
}
var __VLS_75;
var __VLS_55;
var __VLS_51;
const __VLS_83 = {}.VTable;
/** @type {[typeof __VLS_components.VTable, typeof __VLS_components.vTable, typeof __VLS_components.VTable, typeof __VLS_components.vTable, ]} */ ;
// @ts-ignore
const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({}));
const __VLS_85 = __VLS_84({}, ...__VLS_functionalComponentArgsRest(__VLS_84));
__VLS_86.slots.default;
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
    const __VLS_87 = {}.VChip;
    /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
    // @ts-ignore
    const __VLS_88 = __VLS_asFunctionalComponent(__VLS_87, new __VLS_87({
        color: (account.isConnected ? 'success' : 'error'),
        size: "small",
    }));
    const __VLS_89 = __VLS_88({
        color: (account.isConnected ? 'success' : 'error'),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_88));
    __VLS_90.slots.default;
    (account.isConnected ? 'Connecte' : 'Session expiree');
    var __VLS_90;
    if (__VLS_ctx.checkResult && __VLS_ctx.checkResult.id === account._id) {
        const __VLS_91 = {}.VIcon;
        /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
        // @ts-ignore
        const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({
            icon: (__VLS_ctx.checkResult.isValid ? 'mdi-check-circle' : 'mdi-alert-circle'),
            color: (__VLS_ctx.checkResult.isValid ? 'success' : 'error'),
            size: "small",
            ...{ class: "ml-2" },
        }));
        const __VLS_93 = __VLS_92({
            icon: (__VLS_ctx.checkResult.isValid ? 'mdi-check-circle' : 'mdi-alert-circle'),
            color: (__VLS_ctx.checkResult.isValid ? 'success' : 'error'),
            size: "small",
            ...{ class: "ml-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_92));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (account.lastCheckedAt ? new Date(account.lastCheckedAt).toLocaleString('fr-FR') : '-');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    const __VLS_95 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_96 = __VLS_asFunctionalComponent(__VLS_95, new __VLS_95({
        text: "Verifier la session",
    }));
    const __VLS_97 = __VLS_96({
        text: "Verifier la session",
    }, ...__VLS_functionalComponentArgsRest(__VLS_96));
    __VLS_98.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_98.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_99 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_100 = __VLS_asFunctionalComponent(__VLS_99, new __VLS_99({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-refresh",
            size: "small",
            variant: "text",
            loading: (__VLS_ctx.checkingId === account._id),
        }));
        const __VLS_101 = __VLS_100({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-refresh",
            size: "small",
            variant: "text",
            loading: (__VLS_ctx.checkingId === account._id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_100));
        let __VLS_103;
        let __VLS_104;
        let __VLS_105;
        const __VLS_106 = {
            onClick: (...[$event]) => {
                __VLS_ctx.checkSession(account._id);
            }
        };
        var __VLS_102;
    }
    var __VLS_98;
    if (!account.isConnected) {
        const __VLS_107 = {}.VTooltip;
        /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
        // @ts-ignore
        const __VLS_108 = __VLS_asFunctionalComponent(__VLS_107, new __VLS_107({
            text: "Reconnecter",
        }));
        const __VLS_109 = __VLS_108({
            text: "Reconnecter",
        }, ...__VLS_functionalComponentArgsRest(__VLS_108));
        __VLS_110.slots.default;
        {
            const { activator: __VLS_thisSlot } = __VLS_110.slots;
            const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_111 = {}.VBtn;
            /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
            // @ts-ignore
            const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-link-variant",
                size: "small",
                variant: "text",
                color: "warning",
                disabled: (__VLS_ctx.connecting),
            }));
            const __VLS_113 = __VLS_112({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-link-variant",
                size: "small",
                variant: "text",
                color: "warning",
                disabled: (__VLS_ctx.connecting),
            }, ...__VLS_functionalComponentArgsRest(__VLS_112));
            let __VLS_115;
            let __VLS_116;
            let __VLS_117;
            const __VLS_118 = {
                onClick: (...[$event]) => {
                    if (!(!account.isConnected))
                        return;
                    __VLS_ctx.reconnect(account._id);
                }
            };
            var __VLS_114;
        }
        var __VLS_110;
    }
    if (account.isConnected) {
        const __VLS_119 = {}.VTooltip;
        /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
        // @ts-ignore
        const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({
            text: "Synchroniser les annonces",
        }));
        const __VLS_121 = __VLS_120({
            text: "Synchroniser les annonces",
        }, ...__VLS_functionalComponentArgsRest(__VLS_120));
        __VLS_122.slots.default;
        {
            const { activator: __VLS_thisSlot } = __VLS_122.slots;
            const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_123 = {}.VBtn;
            /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
            // @ts-ignore
            const __VLS_124 = __VLS_asFunctionalComponent(__VLS_123, new __VLS_123({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-sync",
                size: "small",
                variant: "text",
                color: "primary",
                loading: (__VLS_ctx.syncingId === account._id),
            }));
            const __VLS_125 = __VLS_124({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-sync",
                size: "small",
                variant: "text",
                color: "primary",
                loading: (__VLS_ctx.syncingId === account._id),
            }, ...__VLS_functionalComponentArgsRest(__VLS_124));
            let __VLS_127;
            let __VLS_128;
            let __VLS_129;
            const __VLS_130 = {
                onClick: (...[$event]) => {
                    if (!(account.isConnected))
                        return;
                    __VLS_ctx.syncAccount(account._id);
                }
            };
            var __VLS_126;
        }
        var __VLS_122;
    }
    const __VLS_131 = {}.VTooltip;
    /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
    // @ts-ignore
    const __VLS_132 = __VLS_asFunctionalComponent(__VLS_131, new __VLS_131({
        text: "Supprimer",
    }));
    const __VLS_133 = __VLS_132({
        text: "Supprimer",
    }, ...__VLS_functionalComponentArgsRest(__VLS_132));
    __VLS_134.slots.default;
    {
        const { activator: __VLS_thisSlot } = __VLS_134.slots;
        const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
        const __VLS_135 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_136 = __VLS_asFunctionalComponent(__VLS_135, new __VLS_135({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
            loading: (__VLS_ctx.removingId === account._id),
        }));
        const __VLS_137 = __VLS_136({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
            loading: (__VLS_ctx.removingId === account._id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_136));
        let __VLS_139;
        let __VLS_140;
        let __VLS_141;
        const __VLS_142 = {
            onClick: (...[$event]) => {
                __VLS_ctx.removeAccount(account._id);
            }
        };
        var __VLS_138;
    }
    var __VLS_134;
}
var __VLS_86;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            VncViewer: VncViewer,
            platforms: platforms,
            accounts: accounts,
            connecting: connecting,
            connectError: connectError,
            checkingId: checkingId,
            removingId: removingId,
            syncingId: syncingId,
            syncMessage: syncMessage,
            showVnc: showVnc,
            connectLocalMode: connectLocalMode,
            vncWsUrl: vncWsUrl,
            cancelConnect: cancelConnect,
            onVncDisconnect: onVncDisconnect,
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