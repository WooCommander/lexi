import type { Component } from 'vue'
import {
    BarChart3,
    ClipboardList,
    GraduationCap,
    Languages,
    LayoutDashboard,
    Library,
    Settings,
    UsersRound,
    Baby,
    School,
} from 'lucide-vue-next'
import { UserRole } from '@/modules/auth/domain/User'

export interface NavItem {
    label: string
    path: string
    icon: Component
    /** Показывать в нижней панели на телефоне (остальное — в «Ещё»). */
    mobile?: boolean
}

/**
 * Навигация описана данными, а не ссылками в шаблоне layout —
 * у каждой роли свой набор разделов (раздел 38 ТЗ для учителя).
 */
export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
    [UserRole.Student]: [
        { label: 'Учиться', path: '/learn', icon: GraduationCap, mobile: true },
        { label: 'Наборы', path: '/sets', icon: Library, mobile: true },
        { label: 'Статистика', path: '/stats', icon: BarChart3, mobile: true },
        { label: 'Профиль', path: '/settings', icon: Settings, mobile: true },
    ],
    [UserRole.Parent]: [
        { label: 'Дети', path: '/students', icon: Baby, mobile: true },
        { label: 'Наборы', path: '/sets', icon: Library, mobile: true },
        { label: 'Задания', path: '/assignments', icon: ClipboardList, mobile: true },
        { label: 'Профиль', path: '/settings', icon: Settings, mobile: true },
    ],
    [UserRole.Teacher]: [
        { label: 'Главная', path: '/teacher', icon: LayoutDashboard, mobile: true },
        { label: 'Ученики', path: '/students', icon: UsersRound, mobile: true },
        { label: 'Группы', path: '/groups', icon: School },
        { label: 'Языки', path: '/languages', icon: Languages },
        { label: 'Наборы слов', path: '/sets', icon: Library, mobile: true },
        { label: 'Задания', path: '/assignments', icon: ClipboardList, mobile: true },
        { label: 'Статистика', path: '/teacher/stats', icon: BarChart3 },
        { label: 'Профиль', path: '/settings', icon: Settings },
    ],
}

export const HOME_BY_ROLE: Record<UserRole, string> = {
    [UserRole.Student]: '/learn',
    [UserRole.Parent]: '/students',
    [UserRole.Teacher]: '/teacher',
}

/** Активен ли пункт для текущего пути (вложенные экраны подсвечивают родителя). */
export const isNavActive = (item: NavItem, path: string, items: NavItem[]): boolean => {
    if (path === item.path) return true
    if (!path.startsWith(`${item.path}/`)) return false
    // /teacher/stats не должен подсвечивать /teacher
    return !items.some(other => other !== item && other.path.length > item.path.length && path.startsWith(other.path))
}
