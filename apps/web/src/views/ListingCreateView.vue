<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" to="/listings" />
      <h1 class="text-h4 ml-2">Nouvelle annonce</h1>
      <v-spacer />
      <v-btn
        color="secondary"
        variant="tonal"
        size="small"
        :loading="autoFilling"
        :disabled="!canAutoFill"
        @click="onAutoFill"
      >
        <v-icon start size="small">mdi-auto-fix</v-icon>
        Auto-remplir (IA)
      </v-btn>
    </div>

    <v-form @submit.prevent="onSubmit">
      <v-card class="pa-4 mb-4">
        <p class="text-subtitle-2 text-medium-emphasis mb-3">Informations principales</p>
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
              :rules="[rules.required, rules.positive]"
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
              :rules="[rules.required]"
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
        <MediaUpload v-model="form.media" />
      </v-card>

      <v-btn
        type="submit"
        color="primary"
        size="large"
        block
        :loading="submitting"
        :disabled="!canSubmit"
      >
        Creer l'annonce
      </v-btn>
    </v-form>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ListingCategory, ListingColor, ListingCondition, PackageSize } from '@crosspost/shared';
import type { AutoFillResult, ListingMedia } from '@crosspost/shared';
import apiClient from '@/api/client';
import MediaUpload from '@/components/MediaUpload.vue';

const router = useRouter();

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
  category: null as ListingCategory | null,
  condition: null as ListingCondition | null,
  color: null as ListingColor | null,
  packageSize: (localStorage.getItem('listing.packageSize') as PackageSize | null) || null,
  location: localStorage.getItem('listing.location') || '',
  media: [] as ListingMedia[],
});

const autoFilling = ref(false);
const submitting = ref(false);
const snackbar = reactive({ show: false, text: '', color: 'success' });

const canAutoFill = computed(() => form.title.length >= 3);
const canSubmit = computed(
  () => form.title.length >= 3 && form.description.length >= 10 && (form.price ?? 0) > 0 && !!form.packageSize,
);

async function onAutoFill() {
  autoFilling.value = true;
  try {
    const { data } = await apiClient.post<AutoFillResult>('/listings/auto-fill', {
      title: form.title,
      description: form.description || undefined,
    });

    if (data.description) form.description = data.description;
    if (data.category && !form.category) form.category = data.category;
    if (data.condition && !form.condition) form.condition = data.condition;
    if (data.color && !form.color) form.color = data.color;
    if (data.packageSize && !form.packageSize) form.packageSize = data.packageSize;
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
    if (form.color) payload.color = form.color;
    payload.packageSize = form.packageSize;
    if (form.location) payload.location = form.location;

    await apiClient.post('/listings', payload);

    if (form.location) localStorage.setItem('listing.location', form.location);
    if (form.packageSize) localStorage.setItem('listing.packageSize', form.packageSize);

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
