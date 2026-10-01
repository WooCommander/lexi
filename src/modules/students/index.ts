import type { RouteRecordRaw } from 'vue-router'
import { UserRole } from '@/modules/auth/domain/User'

const mentors = [UserRole.Teacher, UserRole.Parent]

export const studentRoutes: RouteRecordRaw[] = [
    { path: '/students', name: 'Students', component: () => import('./ui/StudentsView.vue'), meta: { roles: mentors } },
    { path: '/students/:id', name: 'StudentDetail', component: () => import('./ui/StudentDetailView.vue'), meta: { roles: mentors } },
    { path: '/join', name: 'Join', component: () => import('./ui/JoinView.vue') },
]
