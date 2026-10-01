import type { RouteRecordRaw } from 'vue-router'

export const wordSetRoutes: RouteRecordRaw[] = [
    { path: '/sets', name: 'WordSets', component: () => import('./ui/WordSetsView.vue') },
    { path: '/sets/:id', name: 'WordSet', component: () => import('./ui/WordSetView.vue') },
]
