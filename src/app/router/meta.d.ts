import 'vue-router'
import type { UserRole } from '@/modules/auth/domain/User'

declare module 'vue-router' {
    interface RouteMeta {
        /** Доступно без входа (по умолчанию все маршруты закрыты). */
        public?: boolean
        /** Какие роли могут открыть экран. Пусто — любая. */
        roles?: UserRole[]
        /** focus — без навигации (тренировка), blank — без layout (вход). */
        layout?: 'default' | 'focus' | 'blank'
        title?: string
    }
}

export {}
