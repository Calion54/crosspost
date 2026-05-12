<template>
  <div>
    <p class="text-subtitle-1 mb-2">Photos ({{ mediaItems.length }}/10)</p>

    <div class="d-flex flex-wrap ga-3">
      <!-- Uploaded images (draggable) -->
      <v-card
        v-for="(item, index) in mediaItems"
        :key="item.key"
        width="120"
        height="120"
        class="position-relative media-card"
        :class="{ 'media-dragging': dragIndex === index, 'media-over': dragOverIndex === index }"
        :draggable="!item.uploading"
        @dragstart="onDragStart(index, $event)"
        @dragover.prevent="onDragOver(index)"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
      >
        <v-img :src="item.previewUrl || item.displayUrl" height="120" cover />
        <v-btn
          icon="mdi-close"
          size="x-small"
          color="error"
          variant="flat"
          class="position-absolute"
          style="top: 4px; right: 4px; z-index: 1;"
          @click="removeMedia(item)"
        />
        <v-progress-linear
          v-if="item.uploading"
          :model-value="item.progress"
          color="primary"
          class="position-absolute"
          style="bottom: 0;"
        />
        <div
          v-if="index === 0 && !item.uploading"
          class="position-absolute text-caption bg-primary text-white px-1 rounded-be"
          style="top: 0; left: 0;"
        >
          Cover
        </div>
      </v-card>

      <!-- Add button -->
      <v-card
        v-if="mediaItems.length < 10"
        width="120"
        height="120"
        class="d-flex align-center justify-center cursor-pointer"
        color="grey-lighten-4"
        variant="outlined"
        @click="openFilePicker"
      >
        <div class="text-center text-grey">
          <v-icon size="32">mdi-plus</v-icon>
          <p class="text-caption">Ajouter</p>
        </div>
      </v-card>
    </div>

    <p class="text-caption text-grey mt-1">
      Max {{ MAX_SIZE_MB }}Mo par image. Glisser pour réordonner.
    </p>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      hidden
      @change="onFilesSelected"
    />

    <p v-if="error" class="text-error text-caption mt-2">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import type { ListingMedia } from '@crosspost/shared';
import apiClient from '@/api/client';

const MAX_SIZE_MB = 9;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface MediaItem {
  key: string;
  contentType: string;
  displayUrl: string;
  previewUrl: string;
  uploading: boolean;
  progress: number;
}

const props = defineProps<{
  modelValue: ListingMedia[];
  mediaUrls?: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: ListingMedia[]];
}>();

const mediaItems = reactive<MediaItem[]>([]);
const initialized = ref(false);
const fileInput = ref<HTMLInputElement>();
const error = ref('');

// Initialize from existing media + signed URLs (edit mode)
watch(
  () => props.modelValue,
  (media) => {
    if (initialized.value || !media?.length) return;
    if (mediaItems.length > 0) return;
    const urls = props.mediaUrls || [];
    for (let i = 0; i < media.length; i++) {
      mediaItems.push(
        reactive({
          key: media[i].key,
          contentType: media[i].contentType,
          displayUrl: urls[i] || '',
          previewUrl: '',
          uploading: false,
          progress: 100,
        }),
      );
    }
    initialized.value = true;
  },
  { immediate: true },
);

// --- Drag & drop state ---
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

function onDragOver(index: number) {
  dragOverIndex.value = index;
}

function onDragLeave() {
  dragOverIndex.value = null;
}

function onDrop(targetIndex: number) {
  const sourceIndex = dragIndex.value;
  if (sourceIndex === null || sourceIndex === targetIndex) return;

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

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
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

async function uploadFile(file: File) {
  try {
    const { data } = await apiClient.post<{
      key: string;
      contentType: string;
      uploadUrl: string;
      fields: Record<string, string>;
    }>('/media/presign', {
      filename: file.name,
      contentType: file.type,
    });

    const item: MediaItem = reactive({
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

    await new Promise<void>((resolve, reject) => {
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
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(formData);
    });

    item.uploading = false;
    item.progress = 100;
    emitUpdate();
  } catch (err: any) {
    error.value = `Erreur upload: ${err.message}`;
    const idx = mediaItems.findIndex((m) => m.uploading && m.progress < 100);
    if (idx >= 0) mediaItems.splice(idx, 1);
  }
}

function removeMedia(item: MediaItem) {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  const idx = mediaItems.indexOf(item);
  if (idx >= 0) mediaItems.splice(idx, 1);
  emitUpdate();
}

function emitUpdate() {
  emit(
    'update:modelValue',
    mediaItems
      .filter((m) => !m.uploading)
      .map((m) => ({ key: m.key, contentType: m.contentType })),
  );
}
</script>

<style scoped>
.media-card {
  cursor: grab;
  transition: transform 0.15s, opacity 0.15s;
}
.media-card:active {
  cursor: grabbing;
}
.media-dragging {
  opacity: 0.4;
}
.media-over {
  transform: scale(1.05);
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
</style>
