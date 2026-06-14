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

    <v-card class="pa-4 mb-4" :loading="loading">
      <h2 class="text-h6 mb-1">Remontée automatique</h2>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Republie automatiquement tes annonces (suppression puis recréation) pour les faire
        remonter en tête des résultats Leboncoin et Vinted. Possibilité de baisser le prix
        à chaque remontée.
      </p>

      <v-form @submit.prevent="onSubmitBump">
        <v-switch
          v-model="bump.enabled"
          color="primary"
          :label="bump.enabled ? 'Remontée activée' : 'Remontée désactivée'"
          :disabled="savingBump"
          hide-details
          class="mb-2"
        />

        <v-text-field
          v-model.number="bump.intervalDays"
          type="number"
          label="Intervalle entre 2 remontées (jours)"
          hint="Minimum 1 jour"
          persistent-hint
          min="1"
          prepend-inner-icon="mdi-clock-outline"
          :disabled="savingBump || !bump.enabled"
          class="mb-3"
        />

        <v-text-field
          v-model.number="bump.priceReductionPercent"
          type="number"
          label="Réduction de prix à chaque remontée (%)"
          hint="0 = pas de réduction. Cumulatif (le prix baisse à chaque remontée)."
          persistent-hint
          min="0"
          max="100"
          prepend-inner-icon="mdi-sale"
          :disabled="savingBump || !bump.enabled"
          class="mb-3"
        />

        <div class="d-flex ga-2">
          <v-btn type="submit" color="primary" :loading="savingBump">
            Enregistrer
          </v-btn>
          <v-btn
            variant="tonal"
            prepend-icon="mdi-play"
            :loading="runningBump"
            @click="onRunBump"
          >
            Lancer maintenant
          </v-btn>
        </div>
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

interface BumpConfig {
  enabled: boolean;
  intervalDays: number;
  priceReductionPercent: number;
}

interface SettingsResponse {
  defaultLocation?: DefaultLocation;
  bump: BumpConfig;
}

const loading = ref(true);
const saving = ref(false);
const savingBump = ref(false);
const runningBump = ref(false);
const input = ref('');
const currentLocation = ref<DefaultLocation | null>(null);
const bump = reactive<BumpConfig>({
  enabled: false,
  intervalDays: 2,
  priceReductionPercent: 0,
});
const snackbar = reactive({ show: false, text: '', color: 'success' });

function applySettings(data: SettingsResponse) {
  currentLocation.value = data.defaultLocation ?? null;
  if (data.bump) Object.assign(bump, data.bump);
}

async function fetchSettings() {
  loading.value = true;
  try {
    const { data } = await apiClient.get<SettingsResponse>('/settings');
    applySettings(data);
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
    const { data } = await apiClient.patch<SettingsResponse>('/settings', {
      location: value,
    });
    applySettings(data);
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

async function onSubmitBump() {
  savingBump.value = true;
  try {
    const { data } = await apiClient.patch<SettingsResponse>('/settings', {
      bump: {
        enabled: bump.enabled,
        intervalDays: bump.intervalDays,
        priceReductionPercent: bump.priceReductionPercent,
      },
    });
    applySettings(data);
    snackbar.text = 'Remontée automatique enregistrée ✓';
    snackbar.color = 'success';
    snackbar.show = true;
  } catch (err: any) {
    snackbar.text =
      err?.response?.data?.message ?? err?.message ?? 'Erreur lors de l’enregistrement';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    savingBump.value = false;
  }
}

async function onRunBump() {
  runningBump.value = true;
  try {
    const { data } = await apiClient.post<{
      usersScanned: number;
      listingsDue: number;
      jobsEnqueued: number;
    }>('/bump/run');
    snackbar.text = `Tick lancé : ${data.listingsDue} annonces dues → ${data.jobsEnqueued} remontées en file`;
    snackbar.color = data.jobsEnqueued > 0 ? 'success' : 'info';
    snackbar.show = true;
  } catch (err: any) {
    snackbar.text =
      err?.response?.data?.message ?? err?.message ?? 'Erreur lors du lancement';
    snackbar.color = 'error';
    snackbar.show = true;
  } finally {
    runningBump.value = false;
  }
}

onMounted(fetchSettings);
</script>
