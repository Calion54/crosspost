import { ref, onMounted, onBeforeUnmount } from 'vue';
import RFB from '@novnc/novnc';
const props = defineProps();
const emit = defineEmits();
const container = ref();
let rfb = null;
onMounted(() => {
    if (!container.value)
        return;
    rfb = new RFB(container.value, props.url);
    // resizeSession asks the server (Xvfb via x11vnc -xrandr resize) to match
    // the client viewport — native pixels, no scaling blur on text.
    rfb.resizeSession = true;
    rfb.scaleViewport = false;
    rfb.addEventListener('disconnect', () => {
        emit('disconnect');
    });
});
onBeforeUnmount(() => {
    if (rfb) {
        rfb.disconnect();
        rfb = null;
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['vnc-container']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
    ref: "container",
    ...{ class: "vnc-container" },
});
/** @type {typeof __VLS_ctx.container} */ ;
/** @type {__VLS_StyleScopedClasses['vnc-container']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            container: container,
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
//# sourceMappingURL=VncViewer.vue.js.map