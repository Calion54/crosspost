<template>
  <div>
    <h1 class="text-h4 mb-4">Publications</h1>
    <v-card>
      <v-data-table
        :headers="headers"
        :items="[]"
        no-data-text="Aucune publication pour le moment"
      />
    </v-card>
  </div>
</template>

<script setup lang="ts">
const headers = [
  { title: 'Annonce', key: 'listing.title' },
  { title: 'Plateforme', key: 'platform' },
  { title: 'Statut', key: 'status' },
  { title: 'ID externe', key: 'externalId' },
  { title: 'Actions', key: 'actions', sortable: false },
];
</script>
