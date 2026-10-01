import type { RouteRecordRaw } from 'vue-router'
import { UserRole } from '@/modules/auth/domain/User'

const roles = [UserRole.Student]

export const trainingRoutes: RouteRecordRaw[] = [
    { path: '/learn', name: 'StudentHome', component: () => import('./ui/StudentHomeView.vue'), meta: { roles } },
    { path: '/learn/:languageId', name: 'LanguageToday', component: () => import('./ui/LanguageTodayView.vue'), meta: { roles } },
    {
        path: '/learn/:languageId/difficult',
        name: 'DifficultWords',
        component: () => import('./ui/DifficultWordsView.vue'),
        meta: { roles },
    },
    { path: '/train', name: 'Training', component: () => import('./ui/TrainingView.vue'), meta: { roles, layout: 'focus' } },
    {
        path: '/train/result',
        name: 'TrainingResult',
        component: () => import('./ui/TrainingResultView.vue'),
        meta: { roles, layout: 'focus' },
    },
]
