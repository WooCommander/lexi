import type { RouteRecordRaw } from 'vue-router'
import { UserRole } from '@/modules/auth/domain/User'

const roles = [UserRole.Teacher]

export const groupRoutes: RouteRecordRaw[] = [
    { path: '/groups', name: 'Groups', component: () => import('./ui/GroupsView.vue'), meta: { roles } },
    { path: '/groups/:id', name: 'Group', component: () => import('./ui/GroupView.vue'), meta: { roles } },
]
