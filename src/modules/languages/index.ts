import type { RouteRecordRaw } from 'vue-router'
import { UserRole } from '@/modules/auth/domain/User'

export const languageRoutes: RouteRecordRaw[] = [
    {
        path: '/languages',
        name: 'Languages',
        component: () => import('./ui/LanguagesView.vue'),
        meta: { roles: [UserRole.Teacher, UserRole.Parent] },
    },
]
