import { createRouter, createWebHistory } from 'vue-router';
const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'dashboard',
            component: () => import('@/views/DashboardView.vue'),
        },
        {
            path: '/listings',
            name: 'listings',
            component: () => import('@/views/ListingsView.vue'),
        },
        {
            path: '/listings/new',
            name: 'listing-create',
            component: () => import('@/views/ListingCreateView.vue'),
        },
        {
            path: '/listings/:id',
            name: 'listing-edit',
            component: () => import('@/views/ListingEditView.vue'),
        },
        {
            path: '/accounts',
            name: 'accounts',
            component: () => import('@/views/AccountsView.vue'),
        },
    ],
});
export default router;
//# sourceMappingURL=index.js.map