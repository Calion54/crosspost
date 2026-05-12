import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ListingCondition } from '@crosspost/shared';
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
    location: '',
    media: [],
});
const autoFilling = ref(false);
const submitting = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });
const canAutoFill = computed(() => form.title.length >= 3);
const canSubmit = computed(() => form.title.length >= 3 && form.description.length >= 10 && (form.price ?? 0) > 0);
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
        if (form.location)
            payload.location = form.location;
        await apiClient.post('/listings', payload);
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
const __VLS_4 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    ...{ class: "pa-4" },
}));
const __VLS_6 = __VLS_5({
    ...{ class: "pa-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
const __VLS_8 = {}.VForm;
/** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    ...{ 'onSubmit': {} },
}));
const __VLS_10 = __VLS_9({
    ...{ 'onSubmit': {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_12;
let __VLS_13;
let __VLS_14;
const __VLS_15 = {
    onSubmit: (__VLS_ctx.onSubmit)
};
__VLS_11.slots.default;
const __VLS_16 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    modelValue: (__VLS_ctx.form.title),
    label: "Titre",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minLength(3)]),
    counter: "100",
    maxlength: "100",
}));
const __VLS_18 = __VLS_17({
    modelValue: (__VLS_ctx.form.title),
    label: "Titre",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minLength(3)]),
    counter: "100",
    maxlength: "100",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
const __VLS_20 = {}.VTextarea;
/** @type {[typeof __VLS_components.VTextarea, typeof __VLS_components.vTextarea, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    modelValue: (__VLS_ctx.form.description),
    label: "Description",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minLength(10)]),
    counter: "4000",
    maxlength: "4000",
    rows: "4",
    autoGrow: true,
}));
const __VLS_22 = __VLS_21({
    modelValue: (__VLS_ctx.form.description),
    label: "Description",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.minLength(10)]),
    counter: "4000",
    maxlength: "4000",
    rows: "4",
    autoGrow: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_24 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    ...{ 'onClick': {} },
    color: "secondary",
    variant: "tonal",
    loading: (__VLS_ctx.autoFilling),
    disabled: (!__VLS_ctx.canAutoFill),
    ...{ class: "mb-4" },
}));
const __VLS_26 = __VLS_25({
    ...{ 'onClick': {} },
    color: "secondary",
    variant: "tonal",
    loading: (__VLS_ctx.autoFilling),
    disabled: (!__VLS_ctx.canAutoFill),
    ...{ class: "mb-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_28;
let __VLS_29;
let __VLS_30;
const __VLS_31 = {
    onClick: (__VLS_ctx.onAutoFill)
};
__VLS_27.slots.default;
const __VLS_32 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    start: true,
}));
const __VLS_34 = __VLS_33({
    start: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_35.slots.default;
var __VLS_35;
var __VLS_27;
const __VLS_36 = {}.VDivider;
/** @type {[typeof __VLS_components.VDivider, typeof __VLS_components.vDivider, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    ...{ class: "mb-4" },
}));
const __VLS_38 = __VLS_37({
    ...{ class: "mb-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
const __VLS_40 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.form.price),
    modelModifiers: { number: true, },
    label: "Prix",
    type: "number",
    prefix: "EUR",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.positive]),
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.form.price),
    modelModifiers: { number: true, },
    label: "Prix",
    type: "number",
    prefix: "EUR",
    rules: ([__VLS_ctx.rules.required, __VLS_ctx.rules.positive]),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
const __VLS_44 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    modelValue: (__VLS_ctx.form.category),
    label: "Categorie",
}));
const __VLS_46 = __VLS_45({
    modelValue: (__VLS_ctx.form.category),
    label: "Categorie",
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
const __VLS_48 = {}.VSelect;
/** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    modelValue: (__VLS_ctx.form.condition),
    items: (__VLS_ctx.conditions),
    label: "Etat",
    clearable: true,
}));
const __VLS_50 = __VLS_49({
    modelValue: (__VLS_ctx.form.condition),
    items: (__VLS_ctx.conditions),
    label: "Etat",
    clearable: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
const __VLS_52 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
    modelValue: (__VLS_ctx.form.brand),
    label: "Marque",
}));
const __VLS_54 = __VLS_53({
    modelValue: (__VLS_ctx.form.brand),
    label: "Marque",
}, ...__VLS_functionalComponentArgsRest(__VLS_53));
const __VLS_56 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    modelValue: (__VLS_ctx.form.size),
    label: "Taille",
}));
const __VLS_58 = __VLS_57({
    modelValue: (__VLS_ctx.form.size),
    label: "Taille",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
const __VLS_60 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
    modelValue: (__VLS_ctx.form.color),
    label: "Couleur",
}));
const __VLS_62 = __VLS_61({
    modelValue: (__VLS_ctx.form.color),
    label: "Couleur",
}, ...__VLS_functionalComponentArgsRest(__VLS_61));
const __VLS_64 = {}.VTextField;
/** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
// @ts-ignore
const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
    modelValue: (__VLS_ctx.form.location),
    label: "Adresse",
    placeholder: "ex: Paris (75011)",
    prependInnerIcon: "mdi-map-marker",
}));
const __VLS_66 = __VLS_65({
    modelValue: (__VLS_ctx.form.location),
    label: "Adresse",
    placeholder: "ex: Paris (75011)",
    prependInnerIcon: "mdi-map-marker",
}, ...__VLS_functionalComponentArgsRest(__VLS_65));
const __VLS_68 = {}.VDivider;
/** @type {[typeof __VLS_components.VDivider, typeof __VLS_components.vDivider, ]} */ ;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
    ...{ class: "my-4" },
}));
const __VLS_70 = __VLS_69({
    ...{ class: "my-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
/** @type {[typeof MediaUpload, ]} */ ;
// @ts-ignore
const __VLS_72 = __VLS_asFunctionalComponent(MediaUpload, new MediaUpload({
    modelValue: (__VLS_ctx.form.media),
    ...{ class: "mb-4" },
}));
const __VLS_73 = __VLS_72({
    modelValue: (__VLS_ctx.form.media),
    ...{ class: "mb-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_72));
const __VLS_75 = {}.VBtn;
/** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
// @ts-ignore
const __VLS_76 = __VLS_asFunctionalComponent(__VLS_75, new __VLS_75({
    type: "submit",
    color: "primary",
    size: "large",
    loading: (__VLS_ctx.submitting),
    disabled: (!__VLS_ctx.canSubmit),
}));
const __VLS_77 = __VLS_76({
    type: "submit",
    color: "primary",
    size: "large",
    loading: (__VLS_ctx.submitting),
    disabled: (!__VLS_ctx.canSubmit),
}, ...__VLS_functionalComponentArgsRest(__VLS_76));
__VLS_78.slots.default;
var __VLS_78;
var __VLS_11;
var __VLS_7;
const __VLS_79 = {}.VSnackbar;
/** @type {[typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, ]} */ ;
// @ts-ignore
const __VLS_80 = __VLS_asFunctionalComponent(__VLS_79, new __VLS_79({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}));
const __VLS_81 = __VLS_80({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}, ...__VLS_functionalComponentArgsRest(__VLS_80));
__VLS_82.slots.default;
(__VLS_ctx.snackbar.text);
var __VLS_82;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-h4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['my-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            MediaUpload: MediaUpload,
            conditions: conditions,
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