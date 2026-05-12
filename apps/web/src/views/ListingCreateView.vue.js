import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ListingCondition, PackageSize } from '@crosspost/shared';
import apiClient from '@/api/client';
import MediaUpload from '@/components/MediaUpload.vue';
const router = useRouter();
const conditions = [
    { title: 'Neuf avec etiquette', value: ListingCondition.NEW_WITH_TAGS },
    { title: 'Neuf sans etiquette', value: ListingCondition.NEW_WITHOUT_TAGS },
    { title: 'Tres bon etat', value: ListingCondition.VERY_GOOD },
    { title: 'Bon etat', value: ListingCondition.GOOD },
    { title: 'Etat correct', value: ListingCondition.FAIR },
];
const packageSizes = [
    { title: 'S — Petit (enveloppe, petite boite)', value: PackageSize.S },
    { title: 'M — Moyen (boite a chaussures)', value: PackageSize.M },
    { title: 'L — Grand (carton volumineux)', value: PackageSize.L },
];
const rules = {
    required: (v) => !!v || 'Champ obligatoire',
    minLength: (min) => (v) => !v || v.length >= min || `Minimum ${min} caracteres`,
    positive: (v) => v > 0 || 'Le prix doit etre positif',
};
const form = reactive({
    title: '',
    description: '',
    price: null,
    category: '',
    condition: null,
    brand: '',
    size: '',
    color: '',
    packageSize: localStorage.getItem('listing.packageSize') || null,
    location: localStorage.getItem('listing.location') || '',
    media: [],
});
const autoFilling = ref(false);
const submitting = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });
const canAutoFill = computed(() => form.title.length >= 3);
const canSubmit = computed(() => form.title.length >= 3 && form.description.length >= 10 && (form.price ?? 0) > 0 && !!form.packageSize);
async function onAutoFill() {
    autoFilling.value = true;
    try {
        const { data } = await apiClient.post('/listings/auto-fill', {
            title: form.title,
            description: form.description || undefined,
        });
        if (data.category && !form.category)
            form.category = data.category;
        if (data.condition && !form.condition)
            form.condition = data.condition;
        if (data.brand && !form.brand)
            form.brand = data.brand;
        if (data.size && !form.size)
            form.size = data.size;
        if (data.color && !form.color)
            form.color = data.color;
        if (data.packageSize && !form.packageSize)
            form.packageSize = data.packageSize;
        if (data.suggestedPrice && !form.price)
            form.price = data.suggestedPrice;
        snackbar.text = 'Champs remplis par l\'IA';
        snackbar.color = 'success';
        snackbar.show = true;
    }
    catch (err) {
        snackbar.text = err.response?.data?.message || 'Erreur auto-fill';
        snackbar.color = 'error';
        snackbar.show = true;
    }
    finally {
        autoFilling.value = false;
    }
}
async function onSubmit() {
    submitting.value = true;
    try {
        const payload = {
            title: form.title,
            description: form.description,
            price: form.price,
            media: form.media,
        };
        if (form.category)
            payload.category = form.category;
        if (form.condition)
            payload.condition = form.condition;
        if (form.brand)
            payload.brand = form.brand;
        if (form.size)
            payload.size = form.size;
        if (form.color)
            payload.color = form.color;
        payload.packageSize = form.packageSize;
        if (form.location)
            payload.location = form.location;
        await apiClient.post('/listings', payload);
        if (form.location)
            localStorage.setItem('listing.location', form.location);
        if (form.packageSize)
            localStorage.setItem('listing.packageSize', form.packageSize);
        snackbar.text = 'Annonce creee';
        snackbar.color = 'success';
        snackbar.show = true;
        router.push('/listings');
    }
    catch (err) {
        snackbar.text = err.response?.data?.message || 'Erreur creation';
        snackbar.color = 'error';
        snackbar.show = true;
    }
    finally {
        submitting.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "d-flex align-center mb-4" },
});
const __VLS_0 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi-arrow-left",
    variant: "text",
    to: "/listings",
}));
const __VLS_2 = __VLS_1({
    icon: "mdi-arrow-left",
    variant: "text",
    to: "/listings",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-h4 ml-2" },
});
const __VLS_4 = {}.VSpacer;
/** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({}));
const __VLS_6 = __VLS_5({}, ...__VLS_functionalComponentArgsRest(__VLS_5));
const __VLS_8 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    color: "secondary",
    variant: "tonal",
    size: "small",
    loading: (__VLS_ctx.autoFilling),
    disabled: (!__VLS_ctx.canAutoFill),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    color: "secondary",
    variant: "tonal",
    size: "small",
    loading: (__VLS_ctx.autoFilling),
    disabled: (!__VLS_ctx.canAutoFill),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onClick: (__VLS_ctx.onAutoFill)
};
__VLS_11.slots.default;
const __VLS_16 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    start: true,
    size: "small",
}));
const __VLS_18 = __VLS_17({
    start: true,
    size: "small",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_19.slots.default;
var __VLS_19;
var __VLS_11;
const __VLS_20 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ 'onSubmit': {} },
}));
const __VLS_22 = __VLS_21({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_24;
let __VLS_25;
let __VLS_26;
const __VLS_27 = {
    onSubmit: (__VLS_ctx.onSubmit)
};
__VLS_23.slots.default;
const __VLS_28 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    ...{ class: "pa-4 mb-4" },
}));
const __VLS_30 = __VLS_29({
    ...{ class: "pa-4 mb-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-subtitle-2 text-medium-emphasis mb-3" },
});
const __VLS_32 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    modelValue: (__VLS_ctx.form.title),
    label: "Titre",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minLength(3)]),
    counter: "100",
    maxlength: "100",
}));
const __VLS_34 = __VLS_33({
    modelValue: (__VLS_ctx.form.title),
    label: "Titre",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minLength(3)]),
    counter: "100",
    maxlength: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
const __VLS_36 = {}.VTextarea;
/** @type {[typeof __VLS_components.VTextarea, typeof __VLS_components.vTextarea, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    modelValue: (__VLS_ctx.form.description),
    label: "Description",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minLength(10)]),
    counter: "4000",
    maxlength: "4000",
    rows: "3",
    autoGrow: true,
}));
const __VLS_38 = __VLS_37({
    modelValue: (__VLS_ctx.form.description),
    label: "Description",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minLength(10)]),
    counter: "4000",
    maxlength: "4000",
    rows: "3",
    autoGrow: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const __VLS_40 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({}));
const __VLS_42 = __VLS_41({}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
const __VLS_44 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    cols: "6",
}));
const __VLS_46 = __VLS_45({
    cols: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
const __VLS_48 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    modelValue: (__VLS_ctx.form.price),
    modelModifiers: { number: true, },
    label: "Prix",
    type: "number",
    prefix: "EUR",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.positive]),
    hideDetails: "auto",
}));
const __VLS_50 = __VLS_49({
    modelValue: (__VLS_ctx.form.price),
    modelModifiers: { number: true, },
    label: "Prix",
    type: "number",
    prefix: "EUR",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.positive]),
    hideDetails: "auto",
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
var __VLS_47;
const __VLS_52 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    cols: "6",
}));
const __VLS_54 = __VLS_53({
    cols: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
__VLS_55.slots.default;
const __VLS_56 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    modelValue: (__VLS_ctx.form.category),
    label: "Categorie",
    hideDetails: "auto",
}));
const __VLS_58 = __VLS_57({
    modelValue: (__VLS_ctx.form.category),
    label: "Categorie",
    hideDetails: "auto",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
var __VLS_55;
var __VLS_43;
var __VLS_31;
const __VLS_60 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    ...{ class: "pa-4 mb-4" },
}));
const __VLS_62 = __VLS_61({
    ...{ class: "pa-4 mb-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
__VLS_63.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-subtitle-2 text-medium-emphasis mb-3" },
});
const __VLS_64 = {}.VRow;
/** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({}));
const __VLS_66 = __VLS_65({}, ...__VLS_functionalComponentArgsRest(__VLS_65));
__VLS_67.slots.default;
const __VLS_68 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    cols: "6",
}));
const __VLS_70 = __VLS_69({
    cols: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
__VLS_71.slots.default;
const __VLS_72 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
    modelValue: (__VLS_ctx.form.condition),
    items: (__VLS_ctx.conditions),
    label: "Etat",
    clearable: true,
    hideDetails: "auto",
}));
const __VLS_74 = __VLS_73({
    modelValue: (__VLS_ctx.form.condition),
    items: (__VLS_ctx.conditions),
    label: "Etat",
    clearable: true,
    hideDetails: "auto",
}, ...__VLS_functionalComponentArgsRest(__VLS_73));
var __VLS_71;
const __VLS_76 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    cols: "6",
}));
const __VLS_78 = __VLS_77({
    cols: "6",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
__VLS_79.slots.default;
const __VLS_80 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
    modelValue: (__VLS_ctx.form.brand),
    label: "Marque",
    hideDetails: "auto",
}));
const __VLS_82 = __VLS_81({
    modelValue: (__VLS_ctx.form.brand),
    label: "Marque",
    hideDetails: "auto",
}, ...__VLS_functionalComponentArgsRest(__VLS_81));
var __VLS_79;
const __VLS_84 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
    cols: "4",
}));
const __VLS_86 = __VLS_85({
    cols: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_85));
__VLS_87.slots.default;
const __VLS_88 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
    modelValue: (__VLS_ctx.form.size),
    label: "Taille",
    hideDetails: "auto",
}));
const __VLS_90 = __VLS_89({
    modelValue: (__VLS_ctx.form.size),
    label: "Taille",
    hideDetails: "auto",
}, ...__VLS_functionalComponentArgsRest(__VLS_89));
var __VLS_87;
const __VLS_92 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
    cols: "4",
}));
const __VLS_94 = __VLS_93({
    cols: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_93));
__VLS_95.slots.default;
const __VLS_96 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
    modelValue: (__VLS_ctx.form.color),
    label: "Couleur",
    hideDetails: "auto",
}));
const __VLS_98 = __VLS_97({
    modelValue: (__VLS_ctx.form.color),
    label: "Couleur",
    hideDetails: "auto",
}, ...__VLS_functionalComponentArgsRest(__VLS_97));
var __VLS_95;
const __VLS_100 = {}.VCol;
/** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
// @ts-ignore
const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
    cols: "4",
}));
const __VLS_102 = __VLS_101({
    cols: "4",
}, ...__VLS_functionalComponentArgsRest(__VLS_101));
__VLS_103.slots.default;
const __VLS_104 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
    modelValue: (__VLS_ctx.form.packageSize),
    items: (__VLS_ctx.packageSizes),
    label: "Taille du colis",
    rules: ([__VLS_ctx.rules.required]),
    hideDetails: "auto",
}));
const __VLS_106 = __VLS_105({
    modelValue: (__VLS_ctx.form.packageSize),
    items: (__VLS_ctx.packageSizes),
    label: "Taille du colis",
    rules: ([__VLS_ctx.rules.required]),
    hideDetails: "auto",
}, ...__VLS_functionalComponentArgsRest(__VLS_105));
var __VLS_103;
var __VLS_67;
var __VLS_63;
const __VLS_108 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
    ...{ class: "pa-4 mb-4" },
}));
const __VLS_110 = __VLS_109({
    ...{ class: "pa-4 mb-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
__VLS_111.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-subtitle-2 text-medium-emphasis mb-3" },
});
const __VLS_112 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
    modelValue: (__VLS_ctx.form.location),
    label: "Adresse",
    placeholder: "ex: Paris (75011)",
    prependInnerIcon: "mdi-map-marker",
    ...{ class: "mb-2" },
}));
const __VLS_114 = __VLS_113({
    modelValue: (__VLS_ctx.form.location),
    label: "Adresse",
    placeholder: "ex: Paris (75011)",
    prependInnerIcon: "mdi-map-marker",
    ...{ class: "mb-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
/** @type {[typeof MediaUpload, ]} */ ;
// @ts-ignore
const __VLS_116 = __VLS_asFunctionalComponent(MediaUpload, new MediaUpload({
    modelValue: (__VLS_ctx.form.media),
}));
const __VLS_117 = __VLS_116({
    modelValue: (__VLS_ctx.form.media),
}, ...__VLS_functionalComponentArgsRest(__VLS_116));
var __VLS_111;
const __VLS_119 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({
    type: "submit",
    color: "primary",
    size: "large",
    block: true,
    loading: (__VLS_ctx.submitting),
    disabled: (!__VLS_ctx.canSubmit),
}));
const __VLS_121 = __VLS_120({
    type: "submit",
    color: "primary",
    size: "large",
    block: true,
    loading: (__VLS_ctx.submitting),
    disabled: (!__VLS_ctx.canSubmit),
}, ...__VLS_functionalComponentArgsRest(__VLS_120));
__VLS_122.slots.default;
var __VLS_122;
var __VLS_23;
const __VLS_123 = {}.VSnackbar;
/** @type {[typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, ]} */ ;
// @ts-ignore
const __VLS_124 = __VLS_asFunctionalComponent(__VLS_123, new __VLS_123({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}));
const __VLS_125 = __VLS_124({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}, ...__VLS_functionalComponentArgsRest(__VLS_124));
__VLS_126.slots.default;
(__VLS_ctx.snackbar.text);
var __VLS_126;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            MediaUpload: MediaUpload,
            conditions: conditions,
            packageSizes: packageSizes,
            rules: rules,
            form: form,
            autoFilling: autoFilling,
            submitting: submitting,
            snackbar: snackbar,
            canAutoFill: canAutoFill,
            canSubmit: canSubmit,
            onAutoFill: onAutoFill,
            onSubmit: onSubmit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=ListingCreateView.vue.js.map