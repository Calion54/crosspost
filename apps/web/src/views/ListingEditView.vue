<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" to="/listings" />
      <h1 class="text-h4 ml-2">Modifier l'annonce</h1>
    </div>

    <v-skeleton-loader v-if="loading" type="card" />

    <v-card v-else class="pa-4">
      <v-form @submit.prevent="onSubmit">
        <v-text-field
          v-model="form.title"
          label="Titre"
          counter="100"
          maxlength="100"
        />
        <v-textarea
          v-model="form.description"
          label="Description"
          counter="4000"
          maxlength="4000"
          rows="4"
          auto-grow
        />

        <v-btn
          color="secondary"
          variant="tonal"
          :loading="autoFilling"
          :disabled="!form.title || form.title.length < 3"
          class="mb-4"
          @click="onAutoFill"
        >
          <v-icon start>mdi-auto-fix</v-icon>
          Auto-remplir avec l'IA
        </v-btn>

        <v-divider class="mb-4" />

        <v-text-field
          v-model.number="form.price"
          label="Prix"
          type="number"
          prefix="EUR"
        />
        <v-text-field v-model="form.category" label="Categorie" />
        <v-select
          v-model="form.condition"
          :items="conditions"
          label="Etat"
          clearable
        />
        <v-text-field v-model="form.brand" label="Marque" />
        <v-text-field v-model="form.size" label="Taille" />
        <v-text-field v-model="form.color" label="Couleur" />
        <v-text-field
          v-model="form.location"
          label="Adresse"
          placeholder="ex: Paris (75011)"
          prepend-inner-icon="mdi-map-marker"
        />

        <v-divider class="my-4" />

        <MediaUpload v-model="form.media" :media-urls="mediaUrls" class="mb-4" />

        <v-btn
          type="submit"
          color="primary"
          size="large"
          :loading="submitting"
        >
          Sauvegarder
        </v-btn>
      </v-form>
    </v-card>

    <!-- Publication section -->
    <v-card class="pa-4 mt-4" v-if="!loading">
      <p class="text-subtitle-1 mb-3">Publication</p>

      <!-- Existing publications -->
      <div v-if="publications.length" class="mb-3">
        <v-chip
          v-for="pub in publications"
          :key="pub._id"
          :color="statusColor(pub.status)"
          :href="pub.externalUrl || undefined"
          :target="pub.externalUrl ? '_blank' : undefined"
          class="mr-2 mb-1"
          :prepend-icon="platformIcon(pub.platform)"
        >
          {{ platformLabel(pub.platform) }} — {{ pub.status }}
        </v-chip>
      </div>

      <!-- Publish buttons -->
      <div class="d-flex ga-2">
        <v-btn
          v-for="acc in publishableAccounts"
          :key="acc._id"
          color="primary"
          variant="tonal"
          :prepend-icon="platformIcon(acc.platform)"
          :loading="publishingTo[acc._id]"
          @click="onPublish(acc._id, acc.platform)"
        >
          Publier sur {{ platformLabel(acc.platform) }}
        </v-btn>
        <p
          v-if="!publishableAccounts.length && !publications.length"
          class="text-medium-emphasis text-caption"
        >
          Aucun compte connecte disponible.
          <router-link to="/accounts">Connecter un compte</router-link>
        </p>
      </div>
    </v-card>

    <!-- Publish progress dialog -->
    <v-dialog v-model="publishDialog.show" max-width="400" persistent>
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon :icon="platformIcon(publishDialog.platform)" class="mr-2" />
          Publication en cours
        </v-card-title>
        <v-card-text>
          <div class="d-flex align-center mb-2">
            <v-progress-circular
              v-if="publishDialog.status === 'publishing'"
              indeterminate
              size="20"
              width="2"
              class="mr-3"
            />
            <v-icon
              v-else-if="publishDialog.status === 'success'"
              color="success"
              class="mr-3"
            >mdi-check-circle</v-icon>
            <v-icon
              v-else-if="publishDialog.status === 'error'"
              color="error"
              class="mr-3"
            >mdi-alert-circle</v-icon>
            <span>{{ publishDialog.stepLabel }}</span>
          </div>
          <p v-if="publishDialog.error" class="text-error text-caption mt-2">
            {{ publishDialog.error }}
          </p>
          <p v-if="publishDialog.externalUrl" class="mt-2">
            <a :href="publishDialog.externalUrl" target="_blank">
              Voir l'annonce publiee
            </a>
          </p>
        </v-card-text>
        <v-card-actions v-if="publishDialog.status !== 'publishing'">
          <v-spacer />
          <v-btn @click="publishDialog.show = false; stopPolling()">Fermer</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ListingCondition } from '@crosspost/shared';
import type { AutoFillResult, ListingMedia } from '@crosspost/shared';
import apiClient from '@/api/client';
import MediaUpload from '@/components/MediaUpload.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

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
  price: null as number | null,
  category: '',
  condition: null as ListingCondition | null,
  brand: '',
  size: '',
  color: '',
  location: '',
  media: [] as ListingMedia[],
});

const loading = ref(true);
const mediaUrls = ref<string[]>([]);
const autoFilling = ref(false);
const submitting = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });

// --- Publication state ---
const publications = ref<any[]>([]);
const accounts = ref<any[]>([]);
const publishingTo = reactive<Record<string, boolean>>({});
let pollTimer: ReturnType<typeof setInterval> | null = null;

const STEP_LABELS: Record<string, string> = {
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
  status: '' as string,
  platform: '' as string,
  stepLabel: '',
  error: '',
  externalUrl: '',
});

const publishableAccounts = computed(() => {
  const publishedPlatforms = new Set(
    publications.value
      .filter((p: any) => ['published', 'pending'].includes(p.status))
      .map((p: any) => p.platform),
  );
  return accounts.value.filter(
    (a) => a.isConnected && !publishedPlatforms.has(a.platform),
  );
});

function platformIcon(platform: string) {
  if (platform === 'leboncoin') return 'mdi-alpha-l-box';
  if (platform === 'vinted') return 'mdi-alpha-v-box';
  return 'mdi-web';
}

function platformLabel(platform: string) {
  if (platform === 'leboncoin') return 'Leboncoin';
  if (platform === 'vinted') return 'Vinted';
  return platform;
}

function statusColor(status: string) {
  const colors: Record<string, string> = {
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
  } catch {
    snackbar.text = 'Annonce introuvable';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => stopPolling());

async function onAutoFill() {
  autoFilling.value = true;
  try {
    const { data } = await apiClient.post<AutoFillResult>('/listings/auto-fill', {
      title: form.title,
      description: form.description || undefined,
    });

    if (data.category) form.category = data.category;
    if (data.condition) form.condition = data.condition;
    if (data.brand) form.brand = data.brand;
    if (data.size) form.size = data.size;
    if (data.color) form.color = data.color;

    snackbar.text = 'Champs remplis par l\'IA';
    snackbar.color = 'success';
    snackbar.show = true;
  } catch (err: any) {
    snackbar.text = err.response?.data?.message || 'Erreur auto-fill';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    autoFilling.value = false;
  }
}

async function onSubmit() {
  submitting.value = true;
  try {
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      price: form.price,
      media: form.media,
    };
    if (form.category) payload.category = form.category;
    if (form.condition) payload.condition = form.condition;
    if (form.brand) payload.brand = form.brand;
    if (form.size) payload.size = form.size;
    if (form.color) payload.color = form.color;
    if (form.location) payload.location = form.location;

    await apiClient.patch(`/listings/${id}`, payload);

    snackbar.text = 'Annonce mise a jour';
    snackbar.color = 'success';
    snackbar.show = true;

    router.push('/listings');
  } catch (err: any) {
    snackbar.text = err.response?.data?.message || 'Erreur mise a jour';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    submitting.value = false;
  }
}

async function onPublish(accountId: string, platform: string) {
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
        } else if (status.status === 'error') {
          publishDialog.status = 'error';
          publishDialog.stepLabel = 'Echec de la publication';
          publishDialog.error = status.error || 'Erreur inconnue';
          stopPolling();
          publishingTo[accountId] = false;
        }
      } catch {
        // Polling error, continue
      }
    }, 2000);
  } catch (err: any) {
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
</script>
