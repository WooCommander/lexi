import { createRouter, createWebHistory } from 'vue-router'
import { authRoutes } from '@/modules/auth'
import { trainingRoutes } from '@/modules/training'
import { wordSetRoutes } from '@/modules/word-sets'
import { statisticsRoutes } from '@/modules/statistics'
import { studentRoutes } from '@/modules/students'
import { groupRoutes } from '@/modules/groups'
import { assignmentRoutes } from '@/modules/assignments'
import { teacherRoutes } from '@/modules/teachers'
import { languageRoutes } from '@/modules/languages'
import { settingsRoutes } from '@/modules/settings'
import { updateRoutes } from '@/modules/updates'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { HOME_BY_ROLE } from '@/app/navigation'

// Каждый модуль сам описывает свои маршруты — здесь только сборка и guard.
const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/', name: 'Home', component: { render: () => null } },
        ...authRoutes,
        ...trainingRoutes,
        ...wordSetRoutes,
        ...statisticsRoutes,
        ...studentRoutes,
        ...groupRoutes,
        ...assignmentRoutes,
        ...teacherRoutes,
        ...languageRoutes,
        ...settingsRoutes,
        ...updateRoutes,
        { path: '/:pathMatch(.*)*', redirect: '/' },
    ],
    scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async to => {
    const auth = useAuthStore()
    await auth.init()

    const home = auth.activeRole ? HOME_BY_ROLE[auth.activeRole] : '/settings'

    if (!to.meta.public && !auth.isAuthenticated) {
        return { name: 'Login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
    }
    if (to.name === 'Login' && auth.isAuthenticated && !auth.isRecoveryFlow) return home
    if (to.name === 'Home') return home

    const roles = to.meta.roles
    if (roles?.length) {
        const allowed = roles.filter(r => auth.hasRole(r))
        if (!allowed.length) return home
        // открыли экран другой роли (например, по ссылке) — переключаем интерфейс
        if (!auth.activeRole || !allowed.includes(auth.activeRole)) auth.setActiveRole(allowed[0])
    }
    return true
})

export default router
