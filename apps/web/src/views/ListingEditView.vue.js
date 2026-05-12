import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ListingCondition, PackageSize } from '@crosspost/shared';
import apiClient from '@/api/client';
import MediaUpload from '@/components/MediaUpload.vue';
const route = useRoute();
const router = useRouter();
const id = route.params.id;
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
const form = reactive({
    title: '',
    description: '',
    price: null,
    category: '',
    condition: null,
    brand: '',
    size: '',
    color: '',
    packageSize: null,
    location: '',
    media: [],
});
const loading = ref(true);
const mediaUrls = ref([]);
const autoFilling = ref(false);
const submitting = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });
onMounted(async () => {
    try {
        const { data } = await apiClient.get(`/listings/${id}`);
        form.title = data.title || '';
        form.description = data.description || '';
        form.price = data.price || null;
        form.category = data.category || '';
        form.condition = data.condition || null;
        form.brand = data.brand || '';
        form.size = data.size || '';
        form.color = data.color || '';
        form.packageSize = data.packageSize || null;
        form.location = data.location || '';
        form.media = data.media || [];
        mediaUrls.value = data.mediaUrls || [];
    }
    catch {
        snackbar.text = 'Annonce introuvable';
        snackbar.color = 'error';
        snackbar.show = true;
    }
    finally {
        loading.value = false;
    }
});
async function onAutoFill() {
    autoFilling.value = true;
    try {
        const { data } = await apiClient.post('/listings/auto-fill', {
            title: form.title,
            description: form.description || undefined,
        });
        if (data.category)
            form.category = data.category;
        if (data.condition)
            form.condition = data.condition;
        if (data.brand)
            form.brand = data.brand;
        if (data.size)
            form.size = data.size;
        if (data.color)
            form.color = data.color;
        if (data.packageSize && !form.packageSize)
            form.packageSize = data.packageSize;
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
        if (form.packageSize)
            payload.packageSize = form.packageSize;
        if (form.location)
            payload.location = form.location;
        await apiClient.patch(`/listings/${id}`, payload);
        snackbar.text = 'Annonce mise a jour';
        snackbar.color = 'success';
        snackbar.show = true;
        router.push('/listings');
    }
    catch (err) {
        snackbar.text = err.response?.data?.message || 'Erreur mise a jour';
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
    disabled: (!__VLS_ctx.form.title || __VLS_ctx.form.title.length < 3),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    color: "secondary",
    variant: "tonal",
    size: "small",
    loading: (__VLS_ctx.autoFilling),
    disabled: (!__VLS_ctx.form.title || __VLS_ctx.form.title.length < 3),
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
if (__VLS_ctx.loading) {
    const __VLS_20 = {}.VSkeletonLoader;
    /** @type {[typeof __VLS_components.VSkeletonLoader, typeof __VLS_components.vSkeletonLoader, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        type: "card,card,card",
    }));
    const __VLS_22 = __VLS_21({
        type: "card,card,card",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
else {
    const __VLS_24 = {}.VForm;
    /** @type {[typeof __VLS_components.VForm, typeof __VLS_components.vForm, typeof __VLS_components.VForm, typeof __VLS_components.vForm, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        ...{ 'onSubmit': {} },
    }));
    const __VLS_26 = __VLS_25({
        ...{ 'onSubmit': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    let __VLS_28;
    let __VLS_29;
    let __VLS_30;
    const __VLS_31 = {
        onSubmit: (__VLS_ctx.onSubmit)
    };
    __VLS_27.slots.default;
    const __VLS_32 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        ...{ class: "pa-4 mb-4" },
    }));
    const __VLS_34 = __VLS_33({
        ...{ class: "pa-4 mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_35.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-subtitle-2 text-medium-emphasis mb-3" },
    });
    const __VLS_36 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        modelValue: (__VLS_ctx.form.title),
        label: "Titre",
        counter: "100",
        maxlength: "100",
    }));
    const __VLS_38 = __VLS_37({
        modelValue: (__VLS_ctx.form.title),
        label: "Titre",
        counter: "100",
        maxlength: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    const __VLS_40 = {}.VTextarea;
    /** @type {[typeof __VLS_components.VTextarea, typeof __VLS_components.vTextarea, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        modelValue: (__VLS_ctx.form.description),
        label: "Description",
        counter: "4000",
        maxlength: "4000",
        rows: "3",
        autoGrow: true,
    }));
    const __VLS_42 = __VLS_41({
        modelValue: (__VLS_ctx.form.description),
        label: "Description",
        counter: "4000",
        maxlength: "4000",
        rows: "3",
        autoGrow: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    const __VLS_44 = {}.VRow;
    /** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({}));
    const __VLS_46 = __VLS_45({}, ...__VLS_functionalComponentArgsRest(__VLS_45));
    __VLS_47.slots.default;
    const __VLS_48 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        cols: "6",
    }));
    const __VLS_50 = __VLS_49({
        cols: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_51.slots.default;
    const __VLS_52 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        modelValue: (__VLS_ctx.form.price),
        modelModifiers: { number: true, },
        label: "Prix",
        type: "number",
        prefix: "EUR",
        hideDetails: "auto",
    }));
    const __VLS_54 = __VLS_53({
        modelValue: (__VLS_ctx.form.price),
        modelModifiers: { number: true, },
        label: "Prix",
        type: "number",
        prefix: "EUR",
        hideDetails: "auto",
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    var __VLS_51;
    const __VLS_56 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        cols: "6",
    }));
    const __VLS_58 = __VLS_57({
        cols: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    __VLS_59.slots.default;
    const __VLS_60 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        modelValue: (__VLS_ctx.form.category),
        label: "Categorie",
        hideDetails: "auto",
    }));
    const __VLS_62 = __VLS_61({
        modelValue: (__VLS_ctx.form.category),
        label: "Categorie",
        hideDetails: "auto",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    var __VLS_59;
    var __VLS_47;
    var __VLS_35;
    const __VLS_64 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        ...{ class: "pa-4 mb-4" },
    }));
    const __VLS_66 = __VLS_65({
        ...{ class: "pa-4 mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    __VLS_67.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-subtitle-2 text-medium-emphasis mb-3" },
    });
    const __VLS_68 = {}.VRow;
    /** @type {[typeof __VLS_components.VRow, typeof __VLS_components.vRow, typeof __VLS_components.VRow, typeof __VLS_components.vRow, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({}));
    const __VLS_70 = __VLS_69({}, ...__VLS_functionalComponentArgsRest(__VLS_69));
    __VLS_71.slots.default;
    const __VLS_72 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        cols: "6",
    }));
    const __VLS_74 = __VLS_73({
        cols: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_75.slots.default;
    const __VLS_76 = {}.VSelect;
    /** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        modelValue: (__VLS_ctx.form.condition),
        items: (__VLS_ctx.conditions),
        label: "Etat",
        clearable: true,
        hideDetails: "auto",
    }));
    const __VLS_78 = __VLS_77({
        modelValue: (__VLS_ctx.form.condition),
        items: (__VLS_ctx.conditions),
        label: "Etat",
        clearable: true,
        hideDetails: "auto",
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    var __VLS_75;
    const __VLS_80 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        cols: "6",
    }));
    const __VLS_82 = __VLS_81({
        cols: "6",
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    __VLS_83.slots.default;
    const __VLS_84 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
        modelValue: (__VLS_ctx.form.brand),
        label: "Marque",
        hideDetails: "auto",
    }));
    const __VLS_86 = __VLS_85({
        modelValue: (__VLS_ctx.form.brand),
        label: "Marque",
        hideDetails: "auto",
    }, ...__VLS_functionalComponentArgsRest(__VLS_85));
    var __VLS_83;
    const __VLS_88 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
        cols: "4",
    }));
    const __VLS_90 = __VLS_89({
        cols: "4",
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    __VLS_91.slots.default;
    const __VLS_92 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
        modelValue: (__VLS_ctx.form.size),
        label: "Taille",
        hideDetails: "auto",
    }));
    const __VLS_94 = __VLS_93({
        modelValue: (__VLS_ctx.form.size),
        label: "Taille",
        hideDetails: "auto",
    }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    var __VLS_91;
    const __VLS_96 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        cols: "4",
    }));
    const __VLS_98 = __VLS_97({
        cols: "4",
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_99.slots.default;
    const __VLS_100 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({
        modelValue: (__VLS_ctx.form.color),
        label: "Couleur",
        hideDetails: "auto",
    }));
    const __VLS_102 = __VLS_101({
        modelValue: (__VLS_ctx.form.color),
        label: "Couleur",
        hideDetails: "auto",
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    var __VLS_99;
    const __VLS_104 = {}.VCol;
    /** @type {[typeof __VLS_components.VCol, typeof __VLS_components.vCol, typeof __VLS_components.VCol, typeof __VLS_components.vCol, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({
        cols: "4",
    }));
    const __VLS_106 = __VLS_105({
        cols: "4",
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    __VLS_107.slots.default;
    const __VLS_108 = {}.VSelect;
    /** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
    // @ts-ignore
    const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({
        modelValue: (__VLS_ctx.form.packageSize),
        items: (__VLS_ctx.packageSizes),
        label: "Taille du colis",
        hideDetails: "auto",
    }));
    const __VLS_110 = __VLS_109({
        modelValue: (__VLS_ctx.form.packageSize),
        items: (__VLS_ctx.packageSizes),
        label: "Taille du colis",
        hideDetails: "auto",
    }, ...__VLS_functionalComponentArgsRest(__VLS_109));
    var __VLS_107;
    var __VLS_71;
    var __VLS_67;
    const __VLS_112 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
        ...{ class: "pa-4 mb-4" },
    }));
    const __VLS_114 = __VLS_113({
        ...{ class: "pa-4 mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_113));
    __VLS_115.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-subtitle-2 text-medium-emphasis mb-3" },
    });
    const __VLS_116 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
        modelValue: (__VLS_ctx.form.location),
        label: "Adresse",
        placeholder: "ex: Paris (75011)",
        prependInnerIcon: "mdi-map-marker",
        ...{ class: "mb-2" },
    }));
    const __VLS_118 = __VLS_117({
        modelValue: (__VLS_ctx.form.location),
        label: "Adresse",
        placeholder: "ex: Paris (75011)",
        prependInnerIcon: "mdi-map-marker",
        ...{ class: "mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_117));
    /** @type {[typeof MediaUpload, ]} */ ;
    // @ts-ignore
    const __VLS_120 = __VLS_asFunctionalComponent(MediaUpload, new MediaUpload({
        modelValue: (__VLS_ctx.form.media),
        mediaUrls: (__VLS_ctx.mediaUrls),
    }));
    const __VLS_121 = __VLS_120({
        modelValue: (__VLS_ctx.form.media),
        mediaUrls: (__VLS_ctx.mediaUrls),
    }, ...__VLS_functionalComponentArgsRest(__VLS_120));
    var __VLS_115;
    const __VLS_123 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_124 = __VLS_asFunctionalComponent(__VLS_123, new __VLS_123({
        type: "submit",
        color: "primary",
        size: "large",
        block: true,
        loading: (__VLS_ctx.submitting),
        ...{ class: "mb-4" },
    }));
    const __VLS_125 = __VLS_124({
        type: "submit",
        color: "primary",
        size: "large",
        block: true,
        loading: (__VLS_ctx.submitting),
        ...{ class: "mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_124));
    __VLS_126.slots.default;
    var __VLS_126;
    var __VLS_27;
}
const __VLS_127 = {}.VSnackbar;
/** @type {[typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, ]} */ ;
// @ts-ignore
const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}));
const __VLS_129 = __VLS_128({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}, ...__VLS_functionalComponentArgsRest(__VLS_128));
__VLS_130.slots.default;
(__VLS_ctx.snackbar.text);
var __VLS_130;
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
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            MediaUpload: MediaUpload,
            conditions: conditions,
            packageSizes: packageSizes,
            form: form,
            loading: loading,
            mediaUrls: mediaUrls,
            autoFilling: autoFilling,
            submitting: submitting,
            snackbar: snackbar,
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
//# sourceMappingURL=ListingEditView.vue.js.map