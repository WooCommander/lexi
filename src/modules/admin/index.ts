import type { RouteRecordRaw } from 'vue-router'
import { UserRole } from '@/modules/auth/domain/User'

const roles = [UserRole.Admin]

export const adminRoutes: RouteRecordRaw[] = [
    { path: '/admin', name: 'AdminDashboard', component: () => import('./ui/AdminDashboardView.vue'), meta: { roles } },
    { path: '/admin/users', name: 'AdminUsers', component: () => import('./ui/AdminUsersView.vue'), meta: { roles } },
    { path: '/admin/users/:id', name: 'AdminUser', component: () => import('./ui/AdminUserView.vue'), meta: { roles } },
]
