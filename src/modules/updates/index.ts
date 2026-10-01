import type { RouteRecordRaw } from 'vue-router'

export const updateRoutes: RouteRecordRaw[] = [
    { path: '/changelog', name: 'Changelog', component: () => import('./ui/ChangelogView.vue') },
]
