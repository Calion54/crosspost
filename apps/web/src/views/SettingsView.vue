<template>
  <div>
    <h1 class="text-h4 mb-4">Paramètres</h1>

    <v-card class="pa-4 mb-4" :loading="loading">
      <h2 class="text-h6 mb-1">Ma localisation par défaut</h2>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Utilisée pour toutes tes publications. Saisis simplement ta ville (et idéalement le code postal),
        on s'occupe du reste via Google Maps.
      </p>

      <div v-if="currentLocation" class="mb-4">
        <v-chip color="success" prepend-icon="mdi-map-marker-check">
          {{ currentLocation.city }} ({{ currentLocation.zipcode }}) — {{ currentLocation.country }}
        </v-chip>
        <div class="text-caption text-medium-emphasis mt-1">
          lat: {{ currentLocation.lat }} · lng: {{ currentLocation.lng }}
        </div>
      </div>
      <div v-else class="mb-4">
        <v-chip color="warning" prepend-icon="mdi-map-marker-off">
          Aucune location configurée — la publication sera bloquée tant qu'elle n'est pas définie
        </v-chip>
      </div>

      <v-form @submit.prevent="onSubmit">
        <v-text-field
          v-model="input"
          label="Nouvelle ville"
          placeholder="ex: Laneuveville-devant-Nancy 54410"
          prepend-inner-icon="mdi-map-marker"
          :disabled="saving"
          class="mb-2"
        />
        <v-btn
          type="submit"
          color="primary"
          :loading="saving"
          :disabled="!input.trim()"
        >
          Enregistrer
        </v-btn>
      </v-form>
    </v-card>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3500">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import apiClient from '@/api/client';

interface DefaultLocation {
  city: string;
  zipcode: string;
  country: string;
  lat: number;
  lng: number;
}

const loading = ref(true);
const saving = ref(false);
const input = ref('');
const currentLocation = ref<DefaultLocation | null>(null);
const snackbar = reactive({ show: false, text: '', color: 'success' });

async function fetchSettings() {
  loading.value = true;
  try {
    const { data } = await apiClient.get<{ defaultLocation?: DefaultLocation }>(
      '/settings',
    );
    currentLocation.value = data.defaultLocation ?? null;
  } catch (err: any) {
    snackbar.text = err?.response?.data?.message ?? 'Erreur chargement settings';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    loading.value = false;
  }
}

async function onSubmit() {
  const value = input.value.trim();
  if (!value) return;
  saving.value = true;
  try {
    const { data } = await apiClient.patch<{ defaultLocation?: DefaultLocation }>(
      '/settings',
      { location: value },
    );
    currentLocation.value = data.defaultLocation ?? null;
    input.value = '';
    snackbar.text = 'Localisation enregistrée ✓';
    snackbar.color = 'success';
    snackbar.show = true;
  } catch (err: any) {
    snackbar.text =
      err?.response?.data?.message ?? err?.message ?? 'Erreur lors du geocoding';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    saving.value = false;
  }
}

onMounted(fetchSettings);
</script>
