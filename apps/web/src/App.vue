<template>
  <v-app>
    <v-navigation-drawer permanent>
      <v-list nav density="compact">
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Dashboard"
          to="/"
        />
        <v-list-item
          prepend-icon="mdi-plus-box"
          title="Nouvelle annonce"
          to="/listings/new"
        />
        <v-list-item
          prepend-icon="mdi-format-list-bulleted"
          title="Mes annonces"
          to="/listings"
        />
        <v-list-item
          prepend-icon="mdi-account-multiple"
          title="Comptes"
          to="/accounts"
        />
        <v-list-item
          prepend-icon="mdi-cog"
          title="Paramètres"
          to="/settings"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar>
      <v-app-bar-title>Crosspost</v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container>
        <router-view />
      </v-container>
    </v-main>

    <v-snackbar
      :model-value="!!reconnectAlert.body"
      :timeout="-1"
      color="error"
      location="top right"
      multi-line
    >
      <template v-if="reconnectAlert.body">
        <strong>Compte à reconnecter</strong>
        <div class="text-body-2 mt-1">
          {{ platformLabel(reconnectAlert.body.platform) }} · {{ reconnectAlert.body.email }}
        </div>
      </template>
      <template #actions>
        <v-btn variant="text" color="white" @click="goReconnect">
          Reconnecter
        </v-btn>
        <v-btn icon="mdi-close" variant="text" @click="dismissReconnectAlert" />
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  dismissReconnectAlert,
  useAccountReconnect,
} from '@/composables/account-reconnect';
import { useAccounts } from '@/composables/accounts';
import { platformLabel } from '@/utils/platform';

const router = useRouter();
const reconnectAlert = useAccountReconnect();
const { fetchAccounts } = useAccounts();

onMounted(() => {
  void fetchAccounts();
});

function goReconnect() {
  router.push('/accounts');
  dismissReconnectAlert();
}
</script>
