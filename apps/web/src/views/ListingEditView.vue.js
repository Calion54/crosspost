import { reactive, ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ListingCondition } from '@crosspost/shared';
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
const loading = ref(true);
const mediaUrls = ref([]);
const autoFilling = ref(false);
const submitting = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });
// --- Publication state ---
const publications = ref([]);
const accounts = ref([]);
const publishingTo = reactive({});
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
const publishDialog = reactive({
    show: false,
    status: '',
    platform: '',
    stepLabel: '',
    error: '',
    externalUrl: '',
});
const publishableAccounts = computed(() => {
    const publishedPlatforms = new Set(publications.value
        .filter((p) => ['published', 'pending'].includes(p.status))
        .map((p) => p.platform));
    return accounts.value.filter((a) => a.isConnected && !publishedPlatforms.has(a.platform));
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
onMounted(async () => {
    try {
        const [listingRes, accountsRes] = await Promise.all([
            apiClient.get(`/listings/${id}`),
            apiClient.get('/accounts'),
        ]);
        const data = listingRes.data;
        form.title = data.title || '';
        form.description = data.description || '';
        form.price = data.price || null;
        form.category = data.category || '';
        form.condition = data.condition || null;
        form.brand = data.brand || '';
        form.size = data.size || '';
        form.color = data.color || '';
        form.location = data.location || '';
        form.media = data.media || [];
        mediaUrls.value = data.mediaUrls || [];
        publications.value = data.publications || [];
        accounts.value = accountsRes.data;
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
onUnmounted(() => stopPolling());
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
async function onPublish(accountId, platform) {
    publishingTo[accountId] = true;
    publishDialog.show = true;
    publishDialog.status = 'publishing';
    publishDialog.platform = platform;
    publishDialog.stepLabel = STEP_LABELS['starting'];
    publishDialog.error = '';
    publishDialog.externalUrl = '';
    try {
        const { data } = await apiClient.post('/publish', { listingId: id, accountId });
        const sessionId = data.sessionId;
        pollTimer = setInterval(async () => {
            try {
                const { data: status } = await apiClient.get(`/publish/${sessionId}/status`);
                publishDialog.stepLabel = STEP_LABELS[status.step] || status.step || '';
                if (status.status === 'success') {
                    publishDialog.status = 'success';
                    publishDialog.stepLabel = 'Annonce publiee avec succes !';
                    publishDialog.externalUrl = status.externalUrl || '';
                    stopPolling();
                    publishingTo[accountId] = false;
                    // Refresh publications
                    const { data: updated } = await apiClient.get(`/listings/${id}`);
                    publications.value = updated.publications || [];
                }
                else if (status.status === 'error') {
                    publishDialog.status = 'error';
                    publishDialog.stepLabel = 'Echec de la publication';
                    publishDialog.error = status.error || 'Erreur inconnue';
                    stopPolling();
                    publishingTo[accountId] = false;
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
        publishingTo[accountId] = false;
    }
}
function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
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
if (__VLS_ctx.loading) {
    const __VLS_4 = {}.VSkeletonLoader;
    /** @type {[typeof __VLS_components.VSkeletonLoader, typeof __VLS_components.vSkeletonLoader, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        type: "card",
    }));
    const __VLS_6 = __VLS_5({
        type: "card",
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
}
else {
    const __VLS_8 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        ...{ class: "pa-4" },
    }));
    const __VLS_10 = __VLS_9({
        ...{ class: "pa-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_11.slots.default;
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
        modelValue: (__VLS_ctx.form.title),
        label: "Titre",
        counter: "100",
        maxlength: "100",
    }));
    const __VLS_22 = __VLS_21({
        modelValue: (__VLS_ctx.form.title),
        label: "Titre",
        counter: "100",
        maxlength: "100",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    const __VLS_24 = {}.VTextarea;
    /** @type {[typeof __VLS_components.VTextarea, typeof __VLS_components.vTextarea, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        modelValue: (__VLS_ctx.form.description),
        label: "Description",
        counter: "4000",
        maxlength: "4000",
        rows: "4",
        autoGrow: true,
    }));
    const __VLS_26 = __VLS_25({
        modelValue: (__VLS_ctx.form.description),
        label: "Description",
        counter: "4000",
        maxlength: "4000",
        rows: "4",
        autoGrow: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    const __VLS_28 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        ...{ 'onClick': {} },
        color: "secondary",
        variant: "tonal",
        loading: (__VLS_ctx.autoFilling),
        disabled: (!__VLS_ctx.form.title || __VLS_ctx.form.title.length < 3),
        ...{ class: "mb-4" },
    }));
    const __VLS_30 = __VLS_29({
        ...{ 'onClick': {} },
        color: "secondary",
        variant: "tonal",
        loading: (__VLS_ctx.autoFilling),
        disabled: (!__VLS_ctx.form.title || __VLS_ctx.form.title.length < 3),
        ...{ class: "mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    let __VLS_32;
    let __VLS_33;
    let __VLS_34;
    const __VLS_35 = {
        onClick: (__VLS_ctx.onAutoFill)
    };
    __VLS_31.slots.default;
    const __VLS_36 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        start: true,
    }));
    const __VLS_38 = __VLS_37({
        start: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    var __VLS_39;
    var __VLS_31;
    const __VLS_40 = {}.VDivider;
    /** @type {[typeof __VLS_components.VDivider, typeof __VLS_components.vDivider, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
        ...{ class: "mb-4" },
    }));
    const __VLS_42 = __VLS_41({
        ...{ class: "mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    const __VLS_44 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        modelValue: (__VLS_ctx.form.price),
        modelModifiers: { number: true, },
        label: "Prix",
        type: "number",
        prefix: "EUR",
    }));
    const __VLS_46 = __VLS_45({
        modelValue: (__VLS_ctx.form.price),
        modelModifiers: { number: true, },
        label: "Prix",
        type: "number",
        prefix: "EUR",
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    const __VLS_48 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        modelValue: (__VLS_ctx.form.category),
        label: "Categorie",
    }));
    const __VLS_50 = __VLS_49({
        modelValue: (__VLS_ctx.form.category),
        label: "Categorie",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    const __VLS_52 = {}.VSelect;
    /** @type {[typeof __VLS_components.VSelect, typeof __VLS_components.vSelect, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        modelValue: (__VLS_ctx.form.condition),
        items: (__VLS_ctx.conditions),
        label: "Etat",
        clearable: true,
    }));
    const __VLS_54 = __VLS_53({
        modelValue: (__VLS_ctx.form.condition),
        items: (__VLS_ctx.conditions),
        label: "Etat",
        clearable: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    const __VLS_56 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
        modelValue: (__VLS_ctx.form.brand),
        label: "Marque",
    }));
    const __VLS_58 = __VLS_57({
        modelValue: (__VLS_ctx.form.brand),
        label: "Marque",
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    const __VLS_60 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
        modelValue: (__VLS_ctx.form.size),
        label: "Taille",
    }));
    const __VLS_62 = __VLS_61({
        modelValue: (__VLS_ctx.form.size),
        label: "Taille",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    const __VLS_64 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        modelValue: (__VLS_ctx.form.color),
        label: "Couleur",
    }));
    const __VLS_66 = __VLS_65({
        modelValue: (__VLS_ctx.form.color),
        label: "Couleur",
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    const __VLS_68 = {}.VTextField;
    /** @type {[typeof __VLS_components.VTextField, typeof __VLS_components.vTextField, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        modelValue: (__VLS_ctx.form.location),
        label: "Adresse",
        placeholder: "ex: Paris (75011)",
        prependInnerIcon: "mdi-map-marker",
    }));
    const __VLS_70 = __VLS_69({
        modelValue: (__VLS_ctx.form.location),
        label: "Adresse",
        placeholder: "ex: Paris (75011)",
        prependInnerIcon: "mdi-map-marker",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    const __VLS_72 = {}.VDivider;
    /** @type {[typeof __VLS_components.VDivider, typeof __VLS_components.vDivider, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        ...{ class: "my-4" },
    }));
    const __VLS_74 = __VLS_73({
        ...{ class: "my-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    /** @type {[typeof MediaUpload, ]} */ ;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent(MediaUpload, new MediaUpload({
        modelValue: (__VLS_ctx.form.media),
        mediaUrls: (__VLS_ctx.mediaUrls),
        ...{ class: "mb-4" },
    }));
    const __VLS_77 = __VLS_76({
        modelValue: (__VLS_ctx.form.media),
        mediaUrls: (__VLS_ctx.mediaUrls),
        ...{ class: "mb-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    const __VLS_79 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_80 = __VLS_asFunctionalComponent(__VLS_79, new __VLS_79({
        type: "submit",
        color: "primary",
        size: "large",
        loading: (__VLS_ctx.submitting),
    }));
    const __VLS_81 = __VLS_80({
        type: "submit",
        color: "primary",
        size: "large",
        loading: (__VLS_ctx.submitting),
    }, ...__VLS_functionalComponentArgsRest(__VLS_80));
    __VLS_82.slots.default;
    var __VLS_82;
    var __VLS_15;
    var __VLS_11;
}
if (!__VLS_ctx.loading) {
    const __VLS_83 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({
        ...{ class: "pa-4 mt-4" },
    }));
    const __VLS_85 = __VLS_84({
        ...{ class: "pa-4 mt-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
    __VLS_86.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-subtitle-1 mb-3" },
    });
    if (__VLS_ctx.publications.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mb-3" },
        });
        for (const [pub] of __VLS_getVForSourceType((__VLS_ctx.publications))) {
            const __VLS_87 = {}.VChip;
            /** @type {[typeof __VLS_components.VChip, typeof __VLS_components.vChip, typeof __VLS_components.VChip, typeof __VLS_components.vChip, ]} */ ;
            // @ts-ignore
            const __VLS_88 = __VLS_asFunctionalComponent(__VLS_87, new __VLS_87({
                key: (pub._id),
                color: (__VLS_ctx.statusColor(pub.status)),
                href: (pub.externalUrl || undefined),
                target: (pub.externalUrl ? '_blank' : undefined),
                ...{ class: "mr-2 mb-1" },
                prependIcon: (__VLS_ctx.platformIcon(pub.platform)),
            }));
            const __VLS_89 = __VLS_88({
                key: (pub._id),
                color: (__VLS_ctx.statusColor(pub.status)),
                href: (pub.externalUrl || undefined),
                target: (pub.externalUrl ? '_blank' : undefined),
                ...{ class: "mr-2 mb-1" },
                prependIcon: (__VLS_ctx.platformIcon(pub.platform)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_88));
            __VLS_90.slots.default;
            (__VLS_ctx.platformLabel(pub.platform));
            (pub.status);
            var __VLS_90;
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-flex ga-2" },
    });
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.publishableAccounts))) {
        const __VLS_91 = {}.VBtn;
        /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
        // @ts-ignore
        const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({
            ...{ 'onClick': {} },
            key: (acc._id),
            color: "primary",
            variant: "tonal",
            prependIcon: (__VLS_ctx.platformIcon(acc.platform)),
            loading: (__VLS_ctx.publishingTo[acc._id]),
        }));
        const __VLS_93 = __VLS_92({
            ...{ 'onClick': {} },
            key: (acc._id),
            color: "primary",
            variant: "tonal",
            prependIcon: (__VLS_ctx.platformIcon(acc.platform)),
            loading: (__VLS_ctx.publishingTo[acc._id]),
        }, ...__VLS_functionalComponentArgsRest(__VLS_92));
        let __VLS_95;
        let __VLS_96;
        let __VLS_97;
        const __VLS_98 = {
            onClick: (...[$event]) => {
                if (!(!__VLS_ctx.loading))
                    return;
                __VLS_ctx.onPublish(acc._id, acc.platform);
            }
        };
        __VLS_94.slots.default;
        (__VLS_ctx.platformLabel(acc.platform));
        var __VLS_94;
    }
    if (!__VLS_ctx.publishableAccounts.length && !__VLS_ctx.publications.length) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-medium-emphasis text-caption" },
        });
        const __VLS_99 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        const __VLS_100 = __VLS_asFunctionalComponent(__VLS_99, new __VLS_99({
            to: "/accounts",
        }));
        const __VLS_101 = __VLS_100({
            to: "/accounts",
        }, ...__VLS_functionalComponentArgsRest(__VLS_100));
        __VLS_102.slots.default;
        var __VLS_102;
    }
    var __VLS_86;
}
const __VLS_103 = {}.VDialog;
/** @type {[typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, typeof __VLS_components.VDialog, typeof __VLS_components.vDialog, ]} */ ;
// @ts-ignore
const __VLS_104 = __VLS_asFunctionalComponent(__VLS_103, new __VLS_103({
    modelValue: (__VLS_ctx.publishDialog.show),
    maxWidth: "400",
    persistent: true,
}));
const __VLS_105 = __VLS_104({
    modelValue: (__VLS_ctx.publishDialog.show),
    maxWidth: "400",
    persistent: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_104));
__VLS_106.slots.default;
const __VLS_107 = {}.VCard;
/** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
// @ts-ignore
const __VLS_108 = __VLS_asFunctionalComponent(__VLS_107, new __VLS_107({}));
const __VLS_109 = __VLS_108({}, ...__VLS_functionalComponentArgsRest(__VLS_108));
__VLS_110.slots.default;
const __VLS_111 = {}.VCardTitle;
/** @type {[typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, typeof __VLS_components.VCardTitle, typeof __VLS_components.vCardTitle, ]} */ ;
// @ts-ignore
const __VLS_112 = __VLS_asFunctionalComponent(__VLS_111, new __VLS_111({
    ...{ class: "d-flex align-center" },
}));
const __VLS_113 = __VLS_112({
    ...{ class: "d-flex align-center" },
}, ...__VLS_functionalComponentArgsRest(__VLS_112));
__VLS_114.slots.default;
const __VLS_115 = {}.VIcon;
/** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
// @ts-ignore
const __VLS_116 = __VLS_asFunctionalComponent(__VLS_115, new __VLS_115({
    icon: (__VLS_ctx.platformIcon(__VLS_ctx.publishDialog.platform)),
    ...{ class: "mr-2" },
}));
const __VLS_117 = __VLS_116({
    icon: (__VLS_ctx.platformIcon(__VLS_ctx.publishDialog.platform)),
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_116));
var __VLS_114;
const __VLS_119 = {}.VCardText;
/** @type {[typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, typeof __VLS_components.VCardText, typeof __VLS_components.vCardText, ]} */ ;
// @ts-ignore
const __VLS_120 = __VLS_asFunctionalComponent(__VLS_119, new __VLS_119({}));
const __VLS_121 = __VLS_120({}, ...__VLS_functionalComponentArgsRest(__VLS_120));
__VLS_122.slots.default;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "d-flex align-center mb-2" },
});
if (__VLS_ctx.publishDialog.status === 'publishing') {
    const __VLS_123 = {}.VProgressCircular;
    /** @type {[typeof __VLS_components.VProgressCircular, typeof __VLS_components.vProgressCircular, ]} */ ;
    // @ts-ignore
    const __VLS_124 = __VLS_asFunctionalComponent(__VLS_123, new __VLS_123({
        indeterminate: true,
        size: "20",
        width: "2",
        ...{ class: "mr-3" },
    }));
    const __VLS_125 = __VLS_124({
        indeterminate: true,
        size: "20",
        width: "2",
        ...{ class: "mr-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_124));
}
else if (__VLS_ctx.publishDialog.status === 'success') {
    const __VLS_127 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({
        color: "success",
        ...{ class: "mr-3" },
    }));
    const __VLS_129 = __VLS_128({
        color: "success",
        ...{ class: "mr-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_128));
    __VLS_130.slots.default;
    var __VLS_130;
}
else if (__VLS_ctx.publishDialog.status === 'error') {
    const __VLS_131 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    const __VLS_132 = __VLS_asFunctionalComponent(__VLS_131, new __VLS_131({
        color: "error",
        ...{ class: "mr-3" },
    }));
    const __VLS_133 = __VLS_132({
        color: "error",
        ...{ class: "mr-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_132));
    __VLS_134.slots.default;
    var __VLS_134;
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
var __VLS_122;
if (__VLS_ctx.publishDialog.status !== 'publishing') {
    const __VLS_135 = {}.VCardActions;
    /** @type {[typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, typeof __VLS_components.VCardActions, typeof __VLS_components.vCardActions, ]} */ ;
    // @ts-ignore
    const __VLS_136 = __VLS_asFunctionalComponent(__VLS_135, new __VLS_135({}));
    const __VLS_137 = __VLS_136({}, ...__VLS_functionalComponentArgsRest(__VLS_136));
    __VLS_138.slots.default;
    const __VLS_139 = {}.VSpacer;
    /** @type {[typeof __VLS_components.VSpacer, typeof __VLS_components.vSpacer, ]} */ ;
    // @ts-ignore
    const __VLS_140 = __VLS_asFunctionalComponent(__VLS_139, new __VLS_139({}));
    const __VLS_141 = __VLS_140({}, ...__VLS_functionalComponentArgsRest(__VLS_140));
    const __VLS_143 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_144 = __VLS_asFunctionalComponent(__VLS_143, new __VLS_143({
        ...{ 'onClick': {} },
    }));
    const __VLS_145 = __VLS_144({
        ...{ 'onClick': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_144));
    let __VLS_147;
    let __VLS_148;
    let __VLS_149;
    const __VLS_150 = {
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.publishDialog.status !== 'publishing'))
                return;
            __VLS_ctx.publishDialog.show = false;
            __VLS_ctx.stopPolling();
        }
    };
    __VLS_146.slots.default;
    var __VLS_146;
    var __VLS_138;
}
var __VLS_110;
var __VLS_106;
const __VLS_151 = {}.VSnackbar;
/** @type {[typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, typeof __VLS_components.VSnackbar, typeof __VLS_components.vSnackbar, ]} */ ;
// @ts-ignore
const __VLS_152 = __VLS_asFunctionalComponent(__VLS_151, new __VLS_151({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}));
const __VLS_153 = __VLS_152({
    modelValue: (__VLS_ctx.snackbar.show),
    color: (__VLS_ctx.snackbar.color),
    timeout: "3000",
}, ...__VLS_functionalComponentArgsRest(__VLS_152));
__VLS_154.slots.default;
(__VLS_ctx.snackbar.text);
var __VLS_154;
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
/** @type {__VLS_StyleScopedClasses['pa-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-subtitle-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['ga-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-medium-emphasis']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
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
            MediaUpload: MediaUpload,
            conditions: conditions,
            form: form,
            loading: loading,
            mediaUrls: mediaUrls,
            autoFilling: autoFilling,
            submitting: submitting,
            snackbar: snackbar,
            publications: publications,
            publishingTo: publishingTo,
            publishDialog: publishDialog,
            publishableAccounts: publishableAccounts,
            platformIcon: platformIcon,
            platformLabel: platformLabel,
            statusColor: statusColor,
            onAutoFill: onAutoFill,
            onSubmit: onSubmit,
            onPublish: onPublish,
            stopPolling: stopPolling,
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