import type { RouteRecordRaw } from 'vue-router'
import { UserRole } from '@/modules/auth/domain/User'

export const teacherRoutes: RouteRecordRaw[] = [
    {
        path: '/teacher',
        name: 'TeacherDashboard',
        component: () => import('./ui/TeacherDashboardView.vue'),
        meta: { roles: [UserRole.Teacher] },
    },
]
