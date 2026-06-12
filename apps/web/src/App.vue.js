import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { dismissReconnectAlert, useAccountReconnect, } from '@/composables/account-reconnect';
import { useAccounts } from '@/composables/accounts';
import { platformLabel } from '@/utils/platform';
const router = useRouter();
const reconnectAlert = useAccountReconnect();
const { fetchAccounts } = useAccounts();
onMounted(() => {
    void fetchAccounts();
});
function goReconnect() {
    router.push('/accounts');
    dismissReconnectAlert();
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.VApp;
/** @type {[typeof __VLS_components.VApp, typeof __VLS_components.vApp, typeof __VLS_components.VApp, typeof __VLS_components.vApp, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_4 = {};
__VLS_3.slots.default;
const __VLS_5 = {}.VNavigationDrawer;
/** @type {[typeof __VLS_components.VNavigationDrawer, typeof __VLS_components.vNavigationDrawer, typeof __VLS_components.VNavigationDrawer, typeof __VLS_components.vNavigationDrawer, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(__VLS_5, new __VLS_5({
    permanent: true,
}));
const __VLS_7 = __VLS_6({
    permanent: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_8.slots.default;
const __VLS_9 = {}.VList;
/** @type {[typeof __VLS_components.VList, typeof __VLS_components.vList, typeof __VLS_components.VList, typeof __VLS_components.vList, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    nav: true,
    density: "compact",
}));
const __VLS_11 = __VLS_10({
    nav: true,
    density: "compact",
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
__VLS_12.slots.default;
const __VLS_13 = {}.VListItem;
/** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    prependIcon: "mdi-view-dashboard",
    title: "Dashboard",
    to: "/",
}));
const __VLS_15 = __VLS_14({
    prependIcon: "mdi-view-dashboard",
    title: "Dashboard",
    to: "/",
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
const __VLS_17 = {}.VListItem;
/** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    prependIcon: "mdi-plus-box",
    title: "Nouvelle annonce",
    to: "/listings/new",
}));
const __VLS_19 = __VLS_18({
    prependIcon: "mdi-plus-box",
    title: "Nouvelle annonce",
    to: "/listings/new",
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
const __VLS_21 = {}.VListItem;
/** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    prependIcon: "mdi-format-list-bulleted",
    title: "Mes annonces",
    to: "/listings",
}));
const __VLS_23 = __VLS_22({
    prependIcon: "mdi-format-list-bulleted",
    title: "Mes annonces",
    to: "/listings",
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
const __VLS_25 = {}.VListItem;
/** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    prependIcon: "mdi-account-multiple",
    title: "Comptes",
    to: "/accounts",
}));
const __VLS_27 = __VLS_26({
    prependIcon: "mdi-account-multiple",
    title: "Comptes",
    to: "/accounts",
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
const __VLS_29 = {}.VListItem;
/** @type {[typeof __VLS_components.VListItem, typeof __VLS_components.vListItem, ]} */ ;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    prependIcon: "mdi-cog",
    title: "Paramètres",
    to: "/settings",
}));
const __VLS_31 = __VLS_30({
    prependIcon: "mdi-cog",
    title: "Paramètres",
    to: "/settings",
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
var __VLS_12;
var __VLS_8;
const __VLS_33 = {}.VAppBar;
/** @type {[typeof __VLS_components.VAppBar, typeof __VLS_components.vAppBar, typeof __VLS_components.VAppBar, typeof __VLS_components.vAppBar, ]} */ ;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({}));
const __VLS_35 = __VLS_34({}, ...__VLS_functionalComponentArgsRest(__VLS_34));
__VLS_36.slots.default;
const __VLS_37 = {}.VAppBarTitle;
/** @type {[typeof __VLS_components.VAppBarTitle, typeof __VLS_components.vAppBarTitle, typeof __VLS_components.VAppBarTitle, typeof __VLS_components.vAppBarTitle, ]} */ ;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({}));
const __VLS_39 = __VLS_38({}, ...__VLS_functionalComponentArgsRest(__VLS_38));
__VLS_40.slots.default;
var __VLS_40;
var __VLS_36;
const __VLS_41 = {}.VMain;
/** @type {[typeof __VLS_components.VMain, typeof __VLS_components.vMain, typeof __VLS_components.VMain, typeof __VLS_components.vMain, ]} */ ;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent(__VLS_41, new __VLS_41({}));
const __VLS_43 = __VLS_42({}, ...__VLS_functionalComponentArgsRest(__VLS_42));
__VLS_44.slots.default;
const __VLS_45 = {}.VContainer;
/** @type {[typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, typeof __VLS_components.VContainer, typeof __VLS_components.vContainer, ]} */ ;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({}));
const __VLS_47 = __VLS_46({}, ...__VLS_functionalComponentArgsRest(__VLS_46));
__VLS_48.slots.default;
const __VLS_49 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, typeof __VLS_components.routerView, ]} */ ;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({}));
const __VLS_51 = __VLS_50({}, ...__VLS_functionalComponentArgsRest(__VLS_50));
var __VLS_48;
var __VLS_44;
const __VLS_53 = {}.VSnackbar;
/** @type {[typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, ]} */ ;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
    modelValue: (!!__VLS_ctx.reconnectAlert.body),
    timeout: (-1),
    color: "error",
    location: "top right",
    multiLine: true,
}));
const __VLS_55 = __VLS_54({
    modelValue: (!!__VLS_ctx.reconnectAlert.body),
    timeout: (-1),
    color: "error",
    location: "top right",
    multiLine: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
__VLS_56.slots.default;
if (__VLS_ctx.reconnectAlert.body) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-body-2 mt-1" },
    });
    (__VLS_ctx.platformLabel(__VLS_ctx.reconnectAlert.body.platform));
    (__VLS_ctx.reconnectAlert.body.email);
}
{
    const { actions: __VLS_thisSlot } = __VLS_56.slots;
    const __VLS_57 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
        ...{ 'onClick': {} },
        variant: "text",
        color: "white",
    }));
    const __VLS_59 = __VLS_58({
        ...{ 'onClick': {} },
        variant: "text",
        color: "white",
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    let __VLS_61;
    let __VLS_62;
    let __VLS_63;
    const __VLS_64 = {
        onClick: (__VLS_ctx.goReconnect)
    };
    __VLS_60.slots.default;
    var __VLS_60;
    const __VLS_65 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
        ...{ 'onClick': {} },
        icon: "mdi-close",
        variant: "text",
    }));
    const __VLS_67 = __VLS_66({
        ...{ 'onClick': {} },
        icon: "mdi-close",
        variant: "text",
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    let __VLS_69;
    let __VLS_70;
    let __VLS_71;
    const __VLS_72 = {
        onClick: (__VLS_ctx.dismissReconnectAlert)
    };
    var __VLS_68;
}
var __VLS_56;
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            dismissReconnectAlert: dismissReconnectAlert,
            platformLabel: platformLabel,
            reconnectAlert: reconnectAlert,
            goReconnect: goReconnect,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=App.vue.js.map