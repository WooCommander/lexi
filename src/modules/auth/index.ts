import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
    {
        path: '/login',
        name: 'Login',
        component: () => import('./ui/LoginView.vue'),
        meta: { public: true, layout: 'blank' },
    },
]
