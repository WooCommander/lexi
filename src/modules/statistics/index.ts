import type { RouteRecordRaw } from 'vue-router'
import { UserRole } from '@/modules/auth/domain/User'

export const statisticsRoutes: RouteRecordRaw[] = [
    { path: '/stats', name: 'MyStats', component: () => import('./ui/MyStatsView.vue'), meta: { roles: [UserRole.Student] } },
    {
        path: '/teacher/stats',
        name: 'TeacherStats',
        component: () => import('./ui/TeacherStatsView.vue'),
        meta: { roles: [UserRole.Teacher] },
    },
]
