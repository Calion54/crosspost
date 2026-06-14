import { onMounted, reactive, ref } from 'vue';
import apiClient from '@/api/client';
const loading = ref(true);
const saving = ref(false);
const savingBump = ref(false);
const runningBump = ref(false);
const input = ref('');
const currentLocation = ref(null);
const bump = reactive({
    enabled: false,
    intervalDays: 2,
    priceReductionPercent: 0,
});
const snackbar = reactive({ show: false, text: '', color: 'success' });
function applySettings(data) {
    currentLocation.value = data.defaultLocation ?? null;
    if (data.bump)
        Object.assign(bump, data.bump);
}
async function fetchSettings() {
    loading.value = true;
    try {
        const { data } = await apiClient.get('/settings');
        applySettings(data);
    }
    catch (err) {
        snackbar.text = err?.response?.data?.message ?? 'Erreur chargement settings';
        snackbar.color = 'error';
        snackbar.show = true;
    }
    finally {
        loading.value = false;
    }
}
async function onSubmit() {
    const value = input.value.trim();
    if (!value)
        return;
    saving.value = true;
    try {
        const { data } = await apiClient.patch('/settings', {
            location: value,
        });
        applySettings(data);
        input.value = '';
        snackbar.text = 'Localisation enregistrée ✓';
        snackbar.color = 'success';
        snackbar.show = true;
    }
    catch (err) {
        snackbar.text =
            err?.response?.data?.message ?? err?.message ?? 'Erreur lors du geocoding';
        snackbar.color = 'error';
        snackbar.show = true;
    }
    finally {
        saving.value = false;
    }
}
async function onSubmitBump() {
    savingBump.value = true;
    try {
        const { data } = await apiClient.patch('/settings', {
            bump: {
                enabled: bump.enabled,
                intervalDays: bump.intervalDays,
                priceReductionPercent: bump.priceReductionPercent,
            },
        });
        applySettings(data);
        snackbar.text = 'Remontée automatique enregistrée ✓';
        snackbar.color = 'success';
        snackbar.show = true;
    }
    catch (err) {
        snackbar.text =
            err?.response?.data?.message ?? err?.message ?? 'Erreur lors de l’enregistrement';
        snackbar.color = 'error';
        snackbar.show = true;
    }
    finally {
        savingBump.value = false;
    }
}
async function onRunBump() {
    runningBump.value = true;
    try {
        const { data } = await apiClient.post('/bump/run');
        snackbar.text = `Tick lancé : ${data.listingsDue} annonces dues → ${data.jobsEnqueued} remontées en file`;
        snackbar.color = data.jobsEnqueued > 0 ? 'success' : 'info';
        snackbar.show = true;
    }
    catch (err) {
        snackbar.text =
            err?.response?.data?.message ?? err?.message ?? 'Erreur lors du lancement';
        snackbar.color = 'error';
        snackbar.show = true;
    }
    finally {
        runningBump.value = false;
    }
}
onMounted(fetchSettings);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-h4 mb-4" },
});
const __VLS_0 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ class: "pa-4 mb-4" },
    loading: (__VLS_ctx.loading),
}));
const __VLS_2 = __VLS_1({
    ...{ class: "pa-4 mb-4" },
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-h6 mb-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-body-2 text-medium-emphasis mb-4" },
});
if (__VLS_ctx.currentLocation) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mb-4" },
    });
    const __VLS_4 = {}.VChip;
    /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        color: "success",
        prependIcon: "mdi-map-marker-check",
    }));
    const __VLS_6 = __VLS_5({
        color: "success",
        prependIcon: "mdi-map-marker-check",
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    (__VLS_ctx.currentLocation.city);
    (__VLS_ctx.currentLocation.zipcode);
    (__VLS_ctx.currentLocation.country);
    var __VLS_7;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-caption text-medium-emphasis mt-1" },
    });
    (__VLS_ctx.currentLocation.lat);
    (__VLS_ctx.currentLocation.lng);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mb-4" },
    });
    const __VLS_8 = {}.VChip;
    /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        color: "warning",
        prependIcon: "mdi-map-marker-off",
    }));
    const __VLS_10 = __VLS_9({
        color: "warning",
        prependIcon: "mdi-map-marker-off",
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_11.slots.default;
    var __VLS_11;
}
const __VLS_12 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onSubmit': {} },
}));
const __VLS_14 = __VLS_13({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onSubmit: (__VLS_ctx.onSubmit)
};
__VLS_15.slots.default;
const __VLS_20 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.input),
    label: "Nouvelle ville",
    placeholder: "ex: Laneuveville-devant-Nancy 54410",
    prependInnerIcon: "mdi-map-marker",
    disabled: (__VLS_ctx.saving),
    ...{ class: "mb-2" },
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.input),
    label: "Nouvelle ville",
    placeholder: "ex: Laneuveville-devant-Nancy 54410",
    prependInnerIcon: "mdi-map-marker",
    disabled: (__VLS_ctx.saving),
    ...{ class: "mb-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_24 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    type: "submit",
    color: "primary",
    loading: (__VLS_ctx.saving),
    disabled: (!__VLS_ctx.input.trim()),
}));
const __VLS_26 = __VLS_25({
    type: "submit",
    color: "primary",
    loading: (__VLS_ctx.saving),
    disabled: (!__VLS_ctx.input.trim()),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_27.slots.default;
var __VLS_27;
var __VLS_15;
var __VLS_3;
const __VLS_28 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    ...{ class: "pa-4 mb-4" },
    loading: (__VLS_ctx.loading),
}));
const __VLS_30 = __VLS_29({
    ...{ class: "pa-4 mb-4" },
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-h6 mb-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-body-2 text-medium-emphasis mb-4" },
});
const __VLS_32 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onSubmit': {} },
}));
const __VLS_34 = __VLS_33({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onSubmit: (__VLS_ctx.onSubmitBump)
};
__VLS_35.slots.default;
const __VLS_40 = {}.VSwitch;
/** @type {[typeof __VLS_components.VSwitch, typeof __VLS_components.vSwitch, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.bump.enabled),
    color: "primary",
    label: (__VLS_ctx.bump.enabled ? 'Remontée activée' : 'Remontée désactivée'),
    disabled: (__VLS_ctx.savingBump),
    hideDetails: true,
    ...{ class: "mb-2" },
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.bump.enabled),
    color: "primary",
    label: (__VLS_ctx.bump.enabled ? 'Remontée activée' : 'Remontée désactivée'),
    disabled: (__VLS_ctx.savingBump),
    hideDetails: true,
    ...{ class: "mb-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
const __VLS_44 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    modelValue: (__VLS_ctx.bump.intervalDays),
    modelModifiers: { number: true, },
    type: "number",
    label: "Intervalle entre 2 remontées (jours)",
    hint: "Minimum 1 jour",
    persistentHint: true,
    min: "1",
    prependInnerIcon: "mdi-clock-outline",
    disabled: (__VLS_ctx.savingBump || !__VLS_ctx.bump.enabled),
    ...{ class: "mb-3" },
}));
const __VLS_46 = __VLS_45({
    modelValue: (__VLS_ctx.bump.intervalDays),
    modelModifiers: { number: true, },
    type: "number",
    label: "Intervalle entre 2 remontées (jours)",
    hint: "Minimum 1 jour",
    persistentHint: true,
    min: "1",
    prependInnerIcon: "mdi-clock-outline",
    disabled: (__VLS_ctx.savingBump || !__VLS_ctx.bump.enabled),
    ...{ class: "mb-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
const __VLS_48 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    modelValue: (__VLS_ctx.bump.priceReductionPercent),
    modelModifiers: { number: true, },
    type: "number",
    label: "Réduction de prix à chaque remontée (%)",
    hint: "0 = pas de réduction. Cumulatif (le prix baisse à chaque remontée).",
    persistentHint: true,
    min: "0",
    max: "100",
    prependInnerIcon: "mdi-sale",
    disabled: (__VLS_ctx.savingBump || !__VLS_ctx.bump.enabled),
    ...{ class: "mb-3" },
}));
const __VLS_50 = __VLS_49({
    modelValue: (__VLS_ctx.bump.priceReductionPercent),
    modelModifiers: { number: true, },
    type: "number",
    label: "Réduction de prix à chaque remontée (%)",
    hint: "0 = pas de réduction. Cumulatif (le prix baisse à chaque remontée).",
    persistentHint: true,
    min: "0",
    max: "100",
    prependInnerIcon: "mdi-sale",
    disabled: (__VLS_ctx.savingBump || !__VLS_ctx.bump.enabled),
    ...{ class: "mb-3" },
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "d-flex ga-2" },
});
const __VLS_52 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    type: "submit",
    color: "primary",
    loading: (__VLS_ctx.savingBump),
}));
const __VLS_54 = __VLS_53({
    type: "submit",
    color: "primary",
    loading: (__VLS_ctx.savingBump),
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
__VLS_55.slots.default;
var __VLS_55;
const __VLS_56 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    ...{ 'onClick': {} },
    variant: "tonal",
    prependIcon: "mdi-play",
    loading: (__VLS_ctx.runningBump),
}));
const __VLS_58 = __VLS_57({
    ...{ 'onClick': {} },
    variant: "tonal",
    prependIcon: "mdi-play",
    loading: (__VLS_ctx.runningBump),
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
let __VLS_60;
let __VLS_61;
let __VLS_62;
const __VLS_63 = {
    onClick: (__VLS_ctx.onRunBump)
};
__VLS_59.slots.default;
var __VLS_59;
var __VLS_35;
var __VLS_31;
const __VLS_64 = {}.VSnackbar;
/** @type {[typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3500",
}));
const __VLS_66 = __VLS_65({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3500",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
(__VLS_ctx.snackbar.text);
var __VLS_67;
/** @type {__VLS_StyleScopedClasses['text-h4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-body-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['ga-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            saving: saving,
            savingBump: savingBump,
            runningBump: runningBump,
            input: input,
            currentLocation: currentLocation,
            bump: bump,
            snackbar: snackbar,
            onSubmit: onSubmit,
            onSubmitBump: onSubmitBump,
            onRunBump: onRunBump,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=SettingsView.vue.js.map