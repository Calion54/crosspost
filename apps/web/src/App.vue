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
  </v-app>
</template>
