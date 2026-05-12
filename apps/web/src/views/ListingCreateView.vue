<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" to="/listings" />
      <h1 class="text-h4 ml-2">Nouvelle annonce</h1>
    </div>

    <v-card class="pa-4">
      <v-form @submit.prevent="onSubmit">
        <!-- Titre + Description (obligatoires) -->
        <v-text-field
          v-model="form.title"
          label="Titre"
          :rules="[rules.required, rules.minLength(3)]"
          counter="100"
          maxlength="100"
        />
        <v-textarea
          v-model="form.description"
          label="Description"
          :rules="[rules.required, rules.minLength(10)]"
          counter="4000"
          maxlength="4000"
          rows="4"
          auto-grow
        />

        <!-- Bouton auto-fill -->
        <v-btn
          color="secondary"
          variant="tonal"
          :loading="autoFilling"
          :disabled="!canAutoFill"
          class="mb-4"
          @click="onAutoFill"
        >
          <v-icon start>mdi-auto-fix</v-icon>
          Auto-remplir avec l'IA
        </v-btn>

        <v-divider class="mb-4" />

        <!-- Prix (obligatoire) -->
        <v-text-field
          v-model.number="form.price"
          label="Prix"
          type="number"
          prefix="EUR"
          :rules="[rules.required, rules.positive]"
        />

        <!-- Champs auto-remplissables -->
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

        <!-- Photos -->
        <MediaUpload v-model="form.media" class="mb-4" />

        <v-btn
          type="submit"
          color="primary"
          size="large"
          :loading="submitting"
          :disabled="!canSubmit"
        >
          Creer l'annonce
        </v-btn>
      </v-form>
    </v-card>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ListingCondition } from '@crosspost/shared';
import type { AutoFillResult, ListingMedia } from '@crosspost/shared';
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
  required: (v: any) => !!v || 'Champ obligatoire',
  minLength: (min: number) => (v: string) =>
    !v || v.length >= min || `Minimum ${min} caracteres`,
  positive: (v: number) => v > 0 || 'Le prix doit etre positif',
};

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

const autoFilling = ref(false);
const submitting = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });

const canAutoFill = computed(() => form.title.length >= 3);
const canSubmit = computed(
  () => form.title.length >= 3 && form.description.length >= 10 && (form.price ?? 0) > 0,
);

async function onAutoFill() {
  autoFilling.value = true;
  try {
    const { data } = await apiClient.post<AutoFillResult>('/listings/auto-fill', {
      title: form.title,
      description: form.description || undefined,
    });

    if (data.category && !form.category) form.category = data.category;
    if (data.condition && !form.condition) form.condition = data.condition;
    if (data.brand && !form.brand) form.brand = data.brand;
    if (data.size && !form.size) form.size = data.size;
    if (data.color && !form.color) form.color = data.color;
    if (data.suggestedPrice && !form.price) form.price = data.suggestedPrice;

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

    await apiClient.post('/listings', payload);

    snackbar.text = 'Annonce creee';
    snackbar.color = 'success';
    snackbar.show = true;

    router.push('/listings');
  } catch (err: any) {
    snackbar.text = err.response?.data?.message || 'Erreur creation';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    submitting.value = false;
  }
}
</script>
