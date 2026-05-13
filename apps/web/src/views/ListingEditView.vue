<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" to="/listings" />
      <h1 class="text-h4 ml-2">Modifier l'annonce</h1>
      <v-spacer />
      <v-btn
        color="secondary"
        variant="tonal"
        size="small"
        :loading="autoFilling"
        :disabled="!form.title || form.title.length < 3"
        @click="onAutoFill"
      >
        <v-icon start size="small">mdi-auto-fix</v-icon>
        Auto-remplir (IA)
      </v-btn>
    </div>

    <v-skeleton-loader v-if="loading" type="card,card,card" />

    <v-form v-else @submit.prevent="onSubmit">
      <v-card class="pa-4 mb-4">
        <p class="text-subtitle-2 text-medium-emphasis mb-3">Informations principales</p>
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
          rows="3"
          auto-grow
        />
        <v-row>
          <v-col cols="6">
            <v-text-field
              v-model.number="form.price"
              label="Prix"
              type="number"
              prefix="EUR"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="form.category"
              :items="categories"
              label="Categorie"
              clearable
              hide-details="auto"
            />
          </v-col>
        </v-row>
      </v-card>

      <v-card class="pa-4 mb-4">
        <p class="text-subtitle-2 text-medium-emphasis mb-3">Details du produit</p>
        <v-row>
          <v-col cols="6">
            <v-select
              v-model="form.condition"
              :items="conditions"
              label="Etat"
              clearable
              hide-details="auto"
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="form.color"
              :items="colors"
              label="Couleur"
              clearable
              hide-details="auto"
            />
          </v-col>
          <v-col cols="6">
            <v-select
              v-model="form.packageSize"
              :items="packageSizes"
              label="Taille du colis"
              hide-details="auto"
            />
          </v-col>
        </v-row>
      </v-card>

      <v-card class="pa-4 mb-4">
        <p class="text-subtitle-2 text-medium-emphasis mb-3">Localisation & photos</p>
        <v-text-field
          v-model="form.location"
          label="Adresse"
          placeholder="ex: Paris (75011)"
          prepend-inner-icon="mdi-map-marker"
          class="mb-2"
        />
        <MediaUpload v-model="form.media" :media-urls="mediaUrls" />
      </v-card>

      <v-btn
        type="submit"
        color="primary"
        size="large"
        block
        :loading="submitting"
        class="mb-4"
      >
        Sauvegarder
      </v-btn>
    </v-form>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ListingCategory, ListingColor, ListingCondition, PackageSize } from '@crosspost/shared';
import type { AutoFillResult, ListingMedia } from '@crosspost/shared';
import apiClient from '@/api/client';
import MediaUpload from '@/components/MediaUpload.vue';

const route = useRoute();
const router = useRouter();
const id = route.params.id as string;

const categories = [
  { title: 'Vetements & accessoires', value: ListingCategory.CLOTHING },
  { title: 'Electronique', value: ListingCategory.ELECTRONICS },
  { title: 'Maison & deco', value: ListingCategory.HOME },
  { title: 'Sports & loisirs', value: ListingCategory.SPORTS },
  { title: 'Jouets & jeux', value: ListingCategory.TOYS_GAMES },
  { title: 'Livres & medias', value: ListingCategory.BOOKS_MEDIA },
  { title: 'Beaute', value: ListingCategory.BEAUTY },
  { title: 'Bebe & enfant', value: ListingCategory.BABY },
  { title: 'Bricolage', value: ListingCategory.DIY },
  { title: 'Collection', value: ListingCategory.COLLECTIBLES },
  { title: 'Autre', value: ListingCategory.OTHER },
];

const conditions = [
  { title: 'Neuf avec etiquette', value: ListingCondition.NEW_WITH_TAGS },
  { title: 'Neuf sans etiquette', value: ListingCondition.NEW_WITHOUT_TAGS },
  { title: 'Tres bon etat', value: ListingCondition.VERY_GOOD },
  { title: 'Bon etat', value: ListingCondition.GOOD },
  { title: 'Etat correct', value: ListingCondition.FAIR },
];

const colors = [
  { title: 'Noir', value: ListingColor.BLACK },
  { title: 'Blanc', value: ListingColor.WHITE },
  { title: 'Gris', value: ListingColor.GREY },
  { title: 'Bleu', value: ListingColor.BLUE },
  { title: 'Rouge', value: ListingColor.RED },
  { title: 'Vert', value: ListingColor.GREEN },
  { title: 'Jaune', value: ListingColor.YELLOW },
  { title: 'Orange', value: ListingColor.ORANGE },
  { title: 'Rose', value: ListingColor.PINK },
  { title: 'Violet', value: ListingColor.PURPLE },
  { title: 'Marron', value: ListingColor.BROWN },
  { title: 'Beige', value: ListingColor.BEIGE },
  { title: 'Dore', value: ListingColor.GOLD },
  { title: 'Argente', value: ListingColor.SILVER },
  { title: 'Multicolore', value: ListingColor.MULTICOLOR },
  { title: 'Autre', value: ListingColor.OTHER },
];

const packageSizes = [
  { title: 'S — Petit (enveloppe, petite boite)', value: PackageSize.S },
  { title: 'M — Moyen (boite a chaussures)', value: PackageSize.M },
  { title: 'L — Grand (carton volumineux)', value: PackageSize.L },
];

const form = reactive({
  title: '',
  description: '',
  price: null as number | null,
  category: null as ListingCategory | null,
  condition: null as ListingCondition | null,
  color: null as ListingColor | null,
  packageSize: null as PackageSize | null,
  location: '',
  media: [] as ListingMedia[],
});

const loading = ref(true);
const mediaUrls = ref<string[]>([]);
const autoFilling = ref(false);
const submitting = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });

onMounted(async () => {
  try {
    const { data } = await apiClient.get(`/listings/${id}`);
    form.title = data.title || '';
    form.description = data.description || '';
    form.price = data.price || null;
    form.category = data.category || null;
    form.condition = data.condition || null;
    form.color = data.color || null;
    form.packageSize = data.packageSize || null;
    form.location = data.location || '';
    form.media = data.media || [];
    mediaUrls.value = data.mediaUrls || [];
  } catch {
    snackbar.text = 'Annonce introuvable';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    loading.value = false;
  }
});

async function onAutoFill() {
  autoFilling.value = true;
  try {
    const { data } = await apiClient.post<AutoFillResult>('/listings/auto-fill', {
      title: form.title,
      description: form.description || undefined,
    });

    if (data.description) form.description = data.description;
    if (data.category) form.category = data.category;
    if (data.condition) form.condition = data.condition;
    if (data.color) form.color = data.color;
    if (data.packageSize && !form.packageSize) form.packageSize = data.packageSize;

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
    if (form.color) payload.color = form.color;
    if (form.packageSize) payload.packageSize = form.packageSize;
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
</script>
