import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Platform } from '@crosspost/shared';
import apiClient from '@/api/client';
import { dismissReconnectAlert, useAccountReconnect, } from '@/composables/account-reconnect';
import { useAccounts } from '@/composables/accounts';
import { PLATFORM_OPTIONS, platformImage, platformLabel, } from '@/utils/platform';
const { accounts, fetchAccounts: fetchAccountsRaw } = useAccounts();
const error = ref('');
const removingId = ref(null);
const syncingAccountIds = ref(new Set());
const syncMessage = ref('');
let syncEventSource = null;
const connectDialog = ref(false);
const formPlatform = ref(Platform.LEBONCOIN);
const formEmail = ref('');
const formPassword = ref('');
const connecting = ref(false);
const formError = ref('');
const canSubmit = computed(() => !!formEmail.value && !!formPassword.value && !connecting.value);
async function fetchAccounts() {
    try {
        await fetchAccountsRaw();
    }
    catch {
        error.value = 'Impossible de récupérer les comptes';
    }
}
function openConnectDialog(account) {
    formError.value = '';
    formPlatform.value = account?.platform ?? Platform.LEBONCOIN;
    formEmail.value = account?.email ?? '';
    formPassword.value = '';
    connectDialog.value = true;
}
function closeConnectDialog() {
    if (connecting.value)
        return;
    connectDialog.value = false;
    formError.value = '';
    formPassword.value = '';
}
const reconnectAlert = useAccountReconnect();
async function submitConnect() {
    if (!canSubmit.value)
        return;
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
        // If the global "needs reconnect" alert was for this account, clear it.
        if (reconnectAlert.body?.platform === formPlatform.value &&
            reconnectAlert.body?.email === formEmail.value) {
            dismissReconnectAlert();
        }
    }
    catch (err) {
        const message = err?.response?.data?.message ??
            err?.message ??
            'La connexion a échoué';
        formError.value = Array.isArray(message) ? message.join(', ') : message;
    }
    finally {
        connecting.value = false;
    }
}
async function removeAccount(id) {
    removingId.value = id;
    try {
        await apiClient.delete(`/accounts/${id}`);
        await fetchAccounts();
    }
    catch {
        error.value = 'Suppression échouée';
    }
    finally {
        removingId.value = null;
    }
}
async function syncAccount(accountId) {
    if (isSyncing(accountId))
        return;
    syncMessage.value = '';
    error.value = '';
    // Optimistic spinner — n'attend pas l'event SSE 'queued'. Le 'completed' /
    // 'failed' du worker fera disparaître le spinner.
    const next = new Set(syncingAccountIds.value);
    next.add(accountId);
    syncingAccountIds.value = next;
    try {
        await apiClient.post(`/sync/${accountId}`);
    }
    catch {
        error.value = 'Impossible de lancer la synchronisation';
        const rollback = new Set(syncingAccountIds.value);
        rollback.delete(accountId);
        syncingAccountIds.value = rollback;
    }
}
function isSyncing(accountId) {
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
function handleSyncEvent(event) {
    const next = new Set(syncingAccountIds.value);
    if (event.type === 'queued' || event.type === 'started') {
        next.add(event.accountId);
    }
    else {
        next.delete(event.accountId);
    }
    syncingAccountIds.value = next;
    if (event.type === 'completed' && event.result) {
        const { found, created, skipped, removed, errors } = event.result;
        const trig = event.trigger === 'login' ? 'auto' : 'manuel';
        syncMessage.value = `Sync ${trig} : ${found} annonces, ${created} nouvelles${skipped ? `, ${skipped} déjà présentes` : ''}${removed ? `, ${removed} supprimées` : ''}${errors ? ` (${errors} erreurs)` : ''}.`;
        void fetchAccounts();
    }
    else if (event.type === 'failed') {
        error.value = event.error ?? 'La synchronisation a échoué';
    }
}
function statusColor(account) {
    if (account.needsReconnect)
        return 'warning';
    return account.isConnected ? 'success' : 'error';
}
function statusLabel(account) {
    if (account.needsReconnect)
        return 'Reconnexion nécessaire';
    return account.isConnected ? 'Connecté' : 'Déconnecté';
}
function formatDate(value) {
    if (!value)
        return '-';
    return new Date(value).toLocaleString('fr-FR');
}
onMounted(() => {
    void fetchAccounts();
    openSyncStream();
});
onUnmounted(closeSyncStream);
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
const __VLS_4 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ 'onClick': {} },
    color: "primary",
    prependIcon: "mdi-plus",
}));
const __VLS_6 = __VLS_5({
    ...{ 'onClick': {} },
    color: "primary",
    prependIcon: "mdi-plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
let __VLS_8;
let __VLS_9;
let __VLS_10;
const __VLS_11 = {
    onClick: (...[$event]) => {
        __VLS_ctx.openConnectDialog();
    }
};
__VLS_7.slots.default;
var __VLS_7;
if (__VLS_ctx.error) {
    const __VLS_12 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        ...{ 'onClick:close': {} },
        type: "error",
        ...{ class: "mb-4" },
        closable: true,
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onClick:close': {} },
        type: "error",
        ...{ class: "mb-4" },
        closable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_16;
    let __VLS_17;
    let __VLS_18;
    const __VLS_19 = {
        'onClick:close': (...[$event]) => {
            if (!(__VLS_ctx.error))
                return;
            __VLS_ctx.error = '';
        }
    };
    __VLS_15.slots.default;
    (__VLS_ctx.error);
    var __VLS_15;
}
if (__VLS_ctx.syncMessage) {
    const __VLS_20 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        ...{ 'onClick:close': {} },
        type: "success",
        variant: "tonal",
        ...{ class: "mb-4" },
        closable: true,
    }));
    const __VLS_22 = __VLS_21({
        ...{ 'onClick:close': {} },
        type: "success",
        variant: "tonal",
        ...{ class: "mb-4" },
        closable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    let __VLS_24;
    let __VLS_25;
    let __VLS_26;
    const __VLS_27 = {
        'onClick:close': (...[$event]) => {
            if (!(__VLS_ctx.syncMessage))
                return;
            __VLS_ctx.syncMessage = '';
        }
    };
    __VLS_23.slots.default;
    (__VLS_ctx.syncMessage);
    var __VLS_23;
}
const __VLS_28 = {}.VTable;
/** @type {[typeof __VLS_components.VTable, typeof __VLS_components.vTable, typeof __VLS_components.VTable, typeof __VLS_components.vTable, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({}));
const __VLS_30 = __VLS_29({}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
if (!__VLS_ctx.accounts.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "6",
        ...{ class: "text-center text-medium-emphasis pa-4" },
    });
}
for (const [account] of __VLS_getVForSourceType((__VLS_ctx.accounts))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (account._id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-flex align-center ga-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
        src: (__VLS_ctx.platformImage(account.platform)),
        alt: (__VLS_ctx.platformLabel(account.platform)),
        width: "22",
        height: "22",
        ...{ class: "rounded" },
    });
    (__VLS_ctx.platformLabel(account.platform));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (account.email);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    const __VLS_32 = {}.VChip;
    /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        color: (__VLS_ctx.statusColor(account)),
        size: "small",
    }));
    const __VLS_34 = __VLS_33({
        color: (__VLS_ctx.statusColor(account)),
        size: "small",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_35.slots.default;
    (__VLS_ctx.statusLabel(account));
    var __VLS_35;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.formatDate(account.connectedAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.formatDate(account.tokenExpiresAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    if (account.needsReconnect) {
        const __VLS_36 = {}.VTooltip;
        /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            text: "Reconnecter",
        }));
        const __VLS_38 = __VLS_37({
            text: "Reconnecter",
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
        __VLS_39.slots.default;
        {
            const { activator: __VLS_thisSlot } = __VLS_39.slots;
            const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_40 = {}.VBtn;
            /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
            // @ts-ignore
            const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-link-variant",
                size: "small",
                variant: "text",
                color: "warning",
            }));
            const __VLS_42 = __VLS_41({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-link-variant",
                size: "small",
                variant: "text",
                color: "warning",
            }, ...__VLS_functionalComponentArgsRest(__VLS_41));
            let __VLS_44;
            let __VLS_45;
            let __VLS_46;
            const __VLS_47 = {
                onClick: (...[$event]) => {
                    if (!(account.needsReconnect))
                        return;
                    __VLS_ctx.openConnectDialog(account);
                }
            };
            var __VLS_43;
        }
        var __VLS_39;
    }
    if (account.isConnected && !account.needsReconnect) {
        const __VLS_48 = {}.VTooltip;
        /** @type {[typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, typeof __VLS_components.VTooltip, typeof __VLS_components.vTooltip, ]} */ ;
        // @ts-ignore
        const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
            text: "Synchroniser les annonces",
        }));
        const __VLS_50 = __VLS_49({
            text: "Synchroniser les annonces",
        }, ...__VLS_functionalComponentArgsRest(__VLS_49));
        __VLS_51.slots.default;
        {
            const { activator: __VLS_thisSlot } = __VLS_51.slots;
            const [{ props }] = __VLS_getSlotParams(__VLS_thisSlot);
            const __VLS_52 = {}.VBtn;
            /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
            // @ts-ignore
            const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-sync",
                size: "small",
                variant: "text",
                color: "primary",
                loading: (__VLS_ctx.isSyncing(account._id)),
                disabled: (__VLS_ctx.isSyncing(account._id)),
            }));
            const __VLS_54 = __VLS_53({
                ...{ 'onClick': {} },
                ...(props),
                icon: "mdi-sync",
                size: "small",
                variant: "text",
                color: "primary",
                loading: (__VLS_ctx.isSyncing(account._id)),
                disabled: (__VLS_ctx.isSyncing(account._id)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_53));
            let __VLS_56;
            let __VLS_57;
            let __VLS_58;
            const __VLS_59 = {
                onClick: (...[$event]) => {
                    if (!(account.isConnected && !account.needsReconnect))
                        return;
                    __VLS_ctx.syncAccount(account._id);
                }
            };
            var __VLS_55;
        }
        var __VLS_51;
    }
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
            loading: (__VLS_ctx.removingId === account._id),
        }));
        const __VLS_66 = __VLS_65({
            ...{ 'onClick': {} },
            ...(props),
            icon: "mdi-delete",
            size: "small",
            variant: "text",
            color: "error",
            loading: (__VLS_ctx.removingId === account._id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        let __VLS_68;
        let __VLS_69;
        let __VLS_70;
        const __VLS_71 = {
            onClick: (...[$event]) => {
                __VLS_ctx.removeAccount(account._id);
            }
        };
        var __VLS_67;
    }
    var __VLS_63;
}
var __VLS_31;
const __VLS_72 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    modelValue: (__VLS_ctx.connectDialog),
    maxWidth: "500",
    persistent: true,
}));
const __VLS_74 = __VLS_73({
    modelValue: (__VLS_ctx.connectDialog),
    maxWidth: "500",
    persistent: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
__VLS_75.slots.default;
const __VLS_76 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({}));
const __VLS_78 = __VLS_77({}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
const __VLS_80 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({}));
const __VLS_82 = __VLS_81({}, ...__VLS_functionalComponentArgsRest(__VLS_81));
__VLS_83.slots.default;
var __VLS_83;
const __VLS_84 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({}));
const __VLS_86 = __VLS_85({}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
const __VLS_88 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    ...{ 'onSubmit': {} },
    ref: "formRef",
}));
const __VLS_90 = __VLS_89({
    ...{ 'onSubmit': {} },
    ref: "formRef",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
let __VLS_92;
let __VLS_93;
let __VLS_94;
const __VLS_95 = {
    onSubmit: (__VLS_ctx.submitConnect)
};
/** @type {typeof __VLS_ctx.formRef} */ ;
var __VLS_96 = {};
__VLS_91.slots.default;
const __VLS_98 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({
    modelValue: (__VLS_ctx.formPlatform),
    items: (__VLS_ctx.PLATFORM_OPTIONS),
    label: "Plateforme",
    variant: "outlined",
    density: "comfortable",
    disabled: (__VLS_ctx.connecting),
}));
const __VLS_100 = __VLS_99({
    modelValue: (__VLS_ctx.formPlatform),
    items: (__VLS_ctx.PLATFORM_OPTIONS),
    label: "Plateforme",
    variant: "outlined",
    density: "comfortable",
    disabled: (__VLS_ctx.connecting),
}, ...__VLS_functionalComponentArgsRest(__VLS_99));
const __VLS_102 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_103 = __VLS_asFunctionalComponent(__VLS_102, new __VLS_102({
    modelValue: (__VLS_ctx.formEmail),
    label: "Email",
    type: "email",
    variant: "outlined",
    density: "comfortable",
    rules: ([v => !!v || 'Email requis']),
    disabled: (__VLS_ctx.connecting),
    autocomplete: "email",
}));
const __VLS_104 = __VLS_103({
    modelValue: (__VLS_ctx.formEmail),
    label: "Email",
    type: "email",
    variant: "outlined",
    density: "comfortable",
    rules: ([v => !!v || 'Email requis']),
    disabled: (__VLS_ctx.connecting),
    autocomplete: "email",
}, ...__VLS_functionalComponentArgsRest(__VLS_103));
const __VLS_106 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_107 = __VLS_asFunctionalComponent(__VLS_106, new __VLS_106({
    modelValue: (__VLS_ctx.formPassword),
    label: "Mot de passe",
    type: "password",
    variant: "outlined",
    density: "comfortable",
    rules: ([v => !!v || 'Mot de passe requis']),
    disabled: (__VLS_ctx.connecting),
    autocomplete: "current-password",
}));
const __VLS_108 = __VLS_107({
    modelValue: (__VLS_ctx.formPassword),
    label: "Mot de passe",
    type: "password",
    variant: "outlined",
    density: "comfortable",
    rules: ([v => !!v || 'Mot de passe requis']),
    disabled: (__VLS_ctx.connecting),
    autocomplete: "current-password",
}, ...__VLS_functionalComponentArgsRest(__VLS_107));
if (__VLS_ctx.connecting) {
    const __VLS_110 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    const __VLS_111 = __VLS_asFunctionalComponent(__VLS_110, new __VLS_110({
        type: "info",
        variant: "tonal",
        ...{ class: "mt-2" },
    }));
    const __VLS_112 = __VLS_111({
        type: "info",
        variant: "tonal",
        ...{ class: "mt-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_111));
    __VLS_113.slots.default;
    const __VLS_114 = {}.VProgressLinear;
    /** @type {[typeof __VLS_components.VProgressLinear, typeof __VLS_components.vProgressLinear, ]} */ ;
    // @ts-ignore
    const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
        indeterminate: true,
        ...{ class: "mt-2" },
    }));
    const __VLS_116 = __VLS_115({
        indeterminate: true,
        ...{ class: "mt-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_115));
    var __VLS_113;
}
if (__VLS_ctx.formError) {
    const __VLS_118 = {}.VAlert;
    /** @type {[typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, typeof __VLS_components.VAlert, typeof __VLS_components.vAlert, ]} */ ;
    // @ts-ignore
    const __VLS_119 = __VLS_asFunctionalComponent(__VLS_118, new __VLS_118({
        type: "error",
        variant: "tonal",
        ...{ class: "mt-2" },
    }));
    const __VLS_120 = __VLS_119({
        type: "error",
        variant: "tonal",
        ...{ class: "mt-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_119));
    __VLS_121.slots.default;
    (__VLS_ctx.formError);
    var __VLS_121;
}
var __VLS_91;
var __VLS_87;
const __VLS_122 = {}.VCardActions;
/** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
// @ts-ignore
const __VLS_123 = __VLS_asFunctionalComponent(__VLS_122, new __VLS_122({}));
const __VLS_124 = __VLS_123({}, ...__VLS_functionalComponentArgsRest(__VLS_123));
__VLS_125.slots.default;
const __VLS_126 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
const __VLS_127 = __VLS_asFunctionalComponent(__VLS_126, new __VLS_126({}));
const __VLS_128 = __VLS_127({}, ...__VLS_functionalComponentArgsRest(__VLS_127));
const __VLS_130 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_131 = __VLS_asFunctionalComponent(__VLS_130, new __VLS_130({
    ...{ 'onClick': {} },
    disabled: (__VLS_ctx.connecting),
}));
const __VLS_132 = __VLS_131({
    ...{ 'onClick': {} },
    disabled: (__VLS_ctx.connecting),
}, ...__VLS_functionalComponentArgsRest(__VLS_131));
let __VLS_134;
let __VLS_135;
let __VLS_136;
const __VLS_137 = {
    onClick: (__VLS_ctx.closeConnectDialog)
};
__VLS_133.slots.default;
var __VLS_133;
const __VLS_138 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_139 = __VLS_asFunctionalComponent(__VLS_138, new __VLS_138({
    ...{ 'onClick': {} },
    color: "primary",
    loading: (__VLS_ctx.connecting),
    disabled: (!__VLS_ctx.canSubmit),
}));
const __VLS_140 = __VLS_139({
    ...{ 'onClick': {} },
    color: "primary",
    loading: (__VLS_ctx.connecting),
    disabled: (!__VLS_ctx.canSubmit),
}, ...__VLS_functionalComponentArgsRest(__VLS_139));
let __VLS_142;
let __VLS_143;
let __VLS_144;
const __VLS_145 = {
    onClick: (__VLS_ctx.submitConnect)
};
__VLS_141.slots.default;
var __VLS_141;
var __VLS_125;
var __VLS_79;
var __VLS_75;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['ga-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
// @ts-ignore
var __VLS_97 = __VLS_96;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            PLATFORM_OPTIONS: PLATFORM_OPTIONS,
            platformImage: platformImage,
            platformLabel: platformLabel,
            accounts: accounts,
            error: error,
            removingId: removingId,
            syncMessage: syncMessage,
            connectDialog: connectDialog,
            formPlatform: formPlatform,
            formEmail: formEmail,
            formPassword: formPassword,
            connecting: connecting,
            formError: formError,
            canSubmit: canSubmit,
            openConnectDialog: openConnectDialog,
            closeConnectDialog: closeConnectDialog,
            submitConnect: submitConnect,
            removeAccount: removeAccount,
            syncAccount: syncAccount,
            isSyncing: isSyncing,
            statusColor: statusColor,
            statusLabel: statusLabel,
            formatDate: formatDate,
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