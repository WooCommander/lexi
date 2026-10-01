import type { RouteRecordRaw } from 'vue-router'
import { UserRole } from '@/modules/auth/domain/User'

export const assignmentRoutes: RouteRecordRaw[] = [
    {
        path: '/assignments',
        name: 'Assignments',
        component: () => import('./ui/AssignmentsView.vue'),
        meta: { roles: [UserRole.Teacher, UserRole.Parent] },
    },
]
