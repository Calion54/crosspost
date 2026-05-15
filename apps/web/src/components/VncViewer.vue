<template>
  <div ref="container" class="vnc-container" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import RFB from '@novnc/novnc';

const props = defineProps<{
  url: string;
}>();

const emit = defineEmits<{
  disconnect: [];
}>();

const container = ref<HTMLDivElement>();
let rfb: RFB | null = null;

onMounted(() => {
  if (!container.value) return;

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
</script>

<style scoped>
.vnc-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
}

.vnc-container :deep(canvas) {
  display: block;
}
</style>
