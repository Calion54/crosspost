import { ref, reactive, watch } from 'vue';
import apiClient from '@/api/client';
const MAX_SIZE_MB = 9;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const props = defineProps();
const emit = defineEmits();
const mediaItems = reactive([]);
const initialized = ref(false);
const fileInput = ref();
const error = ref('');
// Initialize from existing media + signed URLs (edit mode)
watch(() => props.modelValue, (media) => {
    if (initialized.value || !media?.length)
        return;
    if (mediaItems.length > 0)
        return;
    const urls = props.mediaUrls || [];
    for (let i = 0; i < media.length; i++) {
        mediaItems.push(reactive({
            key: media[i].key,
            contentType: media[i].contentType,
            displayUrl: urls[i] || '',
            previewUrl: '',
            uploading: false,
            progress: 100,
        }));
    }
    initialized.value = true;
}, { immediate: true });
// --- Drag & drop state ---
const dragIndex = ref(null);
const dragOverIndex = ref(null);
function onDragStart(index, event) {
    dragIndex.value = index;
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
    }
}
function onDragOver(index) {
    dragOverIndex.value = index;
}
function onDragLeave() {
    dragOverIndex.value = null;
}
function onDrop(targetIndex) {
    const sourceIndex = dragIndex.value;
    if (sourceIndex === null || sourceIndex === targetIndex)
        return;
    const [moved] = mediaItems.splice(sourceIndex, 1);
    mediaItems.splice(targetIndex, 0, moved);
    emitUpdate();
}
function onDragEnd() {
    dragIndex.value = null;
    dragOverIndex.value = null;
}
// --- File picking & upload ---
function openFilePicker() {
    fileInput.value?.click();
}
async function onFilesSelected(event) {
    const input = event.target;
    const files = Array.from(input.files || []);
    input.value = '';
    error.value = '';
    const remaining = 10 - mediaItems.length;
    if (files.length > remaining) {
        error.value = `Maximum 10 photos. Vous pouvez en ajouter ${remaining}.`;
        return;
    }
    for (const file of files) {
        if (file.size > MAX_SIZE_BYTES) {
            error.value = `${file.name} depasse ${MAX_SIZE_MB}Mo (${(file.size / 1024 / 1024).toFixed(1)}Mo)`;
            continue;
        }
        await uploadFile(file);
    }
}
async function uploadFile(file) {
    try {
        const { data } = await apiClient.post('/media/presign', {
            filename: file.name,
            contentType: file.type,
        });
        const item = reactive({
            key: data.key,
            contentType: data.contentType,
            displayUrl: '',
            previewUrl: URL.createObjectURL(file),
            uploading: true,
            progress: 0,
        });
        mediaItems.push(item);
        const formData = new FormData();
        for (const [k, v] of Object.entries(data.fields)) {
            formData.append(k, v);
        }
        formData.append('file', file); // must be last
        await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', data.uploadUrl);
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    item.progress = Math.round((e.loaded / e.total) * 100);
                }
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                }
                else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            };
            xhr.onerror = () => reject(new Error('Upload failed'));
            xhr.send(formData);
        });
        item.uploading = false;
        item.progress = 100;
        emitUpdate();
    }
    catch (err) {
        error.value = `Erreur upload: ${err.message}`;
        const idx = mediaItems.findIndex((m) => m.uploading && m.progress < 100);
        if (idx >= 0)
            mediaItems.splice(idx, 1);
    }
}
function removeMedia(item) {
    if (item.previewUrl)
        URL.revokeObjectURL(item.previewUrl);
    const idx = mediaItems.indexOf(item);
    if (idx >= 0)
        mediaItems.splice(idx, 1);
    emitUpdate();
}
function emitUpdate() {
    emit('update:modelValue', mediaItems
        .filter((m) => !m.uploading)
        .map((m) => ({ key: m.key, contentType: m.contentType })));
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['media-card']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-subtitle-1 mb-2" },
});
(__VLS_ctx.mediaItems.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "d-flex flex-wrap ga-3" },
});
for (const [item, index] of __VLS_getVForSourceType((__VLS_ctx.mediaItems))) {
    const __VLS_0 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        ...{ 'onDragstart': {} },
        ...{ 'onDragover': {} },
        ...{ 'onDragleave': {} },
        ...{ 'onDrop': {} },
        ...{ 'onDragend': {} },
        key: (item.key),
        width: "120",
        height: "120",
        ...{ class: "position-relative media-card" },
        ...{ class: ({ 'media-dragging': __VLS_ctx.dragIndex === index, 'media-over': __VLS_ctx.dragOverIndex === index }) },
        draggable: (!item.uploading),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onDragstart': {} },
        ...{ 'onDragover': {} },
        ...{ 'onDragleave': {} },
        ...{ 'onDrop': {} },
        ...{ 'onDragend': {} },
        key: (item.key),
        width: "120",
        height: "120",
        ...{ class: "position-relative media-card" },
        ...{ class: ({ 'media-dragging': __VLS_ctx.dragIndex === index, 'media-over': __VLS_ctx.dragOverIndex === index }) },
        draggable: (!item.uploading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_4;
    let __VLS_5;
    let __VLS_6;
    const __VLS_7 = {
        onDragstart: (...[$event]) => {
            __VLS_ctx.onDragStart(index, $event);
        }
    };
    const __VLS_8 = {
        onDragover: (...[$event]) => {
            __VLS_ctx.onDragOver(index);
        }
    };
    const __VLS_9 = {
        onDragleave: (__VLS_ctx.onDragLeave)
    };
    const __VLS_10 = {
        onDrop: (...[$event]) => {
            __VLS_ctx.onDrop(index);
        }
    };
    const __VLS_11 = {
        onDragend: (__VLS_ctx.onDragEnd)
    };
    __VLS_3.slots.default;
    const __VLS_12 = {}.VImg;
    /** @type {[typeof __VLS_components.VImg, typeof __VLS_components.vImg, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        src: (item.previewUrl || item.displayUrl),
        height: "120",
        cover: true,
    }));
    const __VLS_14 = __VLS_13({
        src: (item.previewUrl || item.displayUrl),
        height: "120",
        cover: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    const __VLS_16 = {}.VBtn;
    /** @type {[typeof __VLS_components.VBtn, typeof __VLS_components.vBtn, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        ...{ 'onClick': {} },
        icon: "mdi-close",
        size: "x-small",
        color: "error",
        variant: "flat",
        ...{ class: "position-absolute" },
        ...{ style: {} },
    }));
    const __VLS_18 = __VLS_17({
        ...{ 'onClick': {} },
        icon: "mdi-close",
        size: "x-small",
        color: "error",
        variant: "flat",
        ...{ class: "position-absolute" },
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    let __VLS_20;
    let __VLS_21;
    let __VLS_22;
    const __VLS_23 = {
        onClick: (...[$event]) => {
            __VLS_ctx.removeMedia(item);
        }
    };
    var __VLS_19;
    if (item.uploading) {
        const __VLS_24 = {}.VProgressLinear;
        /** @type {[typeof __VLS_components.VProgressLinear, typeof __VLS_components.vProgressLinear, ]} */ ;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
            modelValue: (item.progress),
            color: "primary",
            ...{ class: "position-absolute" },
            ...{ style: {} },
        }));
        const __VLS_26 = __VLS_25({
            modelValue: (item.progress),
            color: "primary",
            ...{ class: "position-absolute" },
            ...{ style: {} },
        }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    }
    if (index === 0 && !item.uploading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "position-absolute text-caption bg-primary text-white px-1 rounded-be" },
            ...{ style: {} },
        });
    }
    var __VLS_3;
}
if (__VLS_ctx.mediaItems.length < 10) {
    const __VLS_28 = {}.VCard;
    /** @type {[typeof __VLS_components.VCard, typeof __VLS_components.vCard, typeof __VLS_components.VCard, typeof __VLS_components.vCard, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        ...{ 'onClick': {} },
        width: "120",
        height: "120",
        ...{ class: "d-flex align-center justify-center cursor-pointer" },
        color: "grey-lighten-4",
        variant: "outlined",
    }));
    const __VLS_30 = __VLS_29({
        ...{ 'onClick': {} },
        width: "120",
        height: "120",
        ...{ class: "d-flex align-center justify-center cursor-pointer" },
        color: "grey-lighten-4",
        variant: "outlined",
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    let __VLS_32;
    let __VLS_33;
    let __VLS_34;
    const __VLS_35 = {
        onClick: (__VLS_ctx.openFilePicker)
    };
    __VLS_31.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center text-grey" },
    });
    const __VLS_36 = {}.VIcon;
    /** @type {[typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, typeof __VLS_components.VIcon, typeof __VLS_components.vIcon, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        size: "32",
    }));
    const __VLS_38 = __VLS_37({
        size: "32",
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    var __VLS_39;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-caption" },
    });
    var __VLS_31;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-caption text-grey mt-1" },
});
(__VLS_ctx.MAX_SIZE_MB);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.onFilesSelected) },
    ref: "fileInput",
    type: "file",
    accept: "image/jpeg,image/png,image/webp",
    multiple: true,
    hidden: true,
});
/** @type {typeof __VLS_ctx.fileInput} */ ;
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-error text-caption mt-2" },
    });
    (__VLS_ctx.error);
}
/** @type {__VLS_StyleScopedClasses['text-subtitle-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['ga-3']} */ ;
/** @type {__VLS_StyleScopedClasses['position-relative']} */ ;
/** @type {__VLS_StyleScopedClasses['media-card']} */ ;
/** @type {__VLS_StyleScopedClasses['position-absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['position-absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['position-absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-be']} */ ;
/** @type {__VLS_StyleScopedClasses['d-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['align-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-grey']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['text-grey']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-caption']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            MAX_SIZE_MB: MAX_SIZE_MB,
            mediaItems: mediaItems,
            fileInput: fileInput,
            error: error,
            dragIndex: dragIndex,
            dragOverIndex: dragOverIndex,
            onDragStart: onDragStart,
            onDragOver: onDragOver,
            onDragLeave: onDragLeave,
            onDrop: onDrop,
            onDragEnd: onDragEnd,
            openFilePicker: openFilePicker,
            onFilesSelected: onFilesSelected,
            removeMedia: removeMedia,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=MediaUpload.vue.js.map