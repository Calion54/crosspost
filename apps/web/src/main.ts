import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import router from './router';
import vuetify from './plugins/vuetify';

import '@mdi/font/css/materialdesignicons.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(vuetify);
app.use(VueQueryPlugin);

app.mount('#app');
