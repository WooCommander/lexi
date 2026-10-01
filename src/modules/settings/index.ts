import type { RouteRecordRaw } from 'vue-router'

export const settingsRoutes: RouteRecordRaw[] = [
    { path: '/settings', name: 'Settings', component: () => import('./ui/SettingsView.vue') },
]
