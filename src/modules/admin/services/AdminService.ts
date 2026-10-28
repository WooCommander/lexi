import { supabase } from '@/api/supabase'
import type { UserRole } from '@/modules/auth/domain/User'
import {
    activityFromRow,
    adminUserFromRow,
    bucketFromRow,
    languageStatFromRow,
    overviewFromRow,
    popularWordFromRow,
    signupFromRow,
    teacherStatFromRow,
    topLearnerFromRow,
    type ActivityDayRow,
    type AdminOverviewRow,
    type AdminUserRow,
    type LanguageStatRow,
    type LearnedBucketRow,
    type PopularWordRow,
    type SignupDayRow,
    type TeacherStatRow,
    type TopLearnerRow,
} from '../domain/Admin'

/**
 * Серверные функции admin_* (db/02_functions.sql) сами проверяют, что вызывающий — администратор:
 * клиентская проверка роли — лишь удобство интерфейса, не защита.
 */
const call = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) throw error
    return data as T
}

export class AdminService {
    static async overview() {
        return overviewFromRow(await call<AdminOverviewRow>('admin_overview'))
    }

    static async activity(days: number) {
        return (await call<ActivityDayRow[]>('admin_activity', { p_days: days })).map(activityFromRow)
    }

    static async signups(days: number) {
        return (await call<SignupDayRow[]>('admin_signups', { p_days: days })).map(signupFromRow)
    }

    static async learnedDistribution() {
        return (await call<LearnedBucketRow[]>('admin_learned_distribution')).map(bucketFromRow)
    }

    static async languageStats() {
        return (await call<LanguageStatRow[]>('admin_language_stats')).map(languageStatFromRow)
    }

    static async popularWords(limit = 10) {
        return (await call<PopularWordRow[]>('admin_popular_words', { p_limit: limit })).map(popularWordFromRow)
    }

    static async topLearners(limit = 10) {
        return (await call<TopLearnerRow[]>('admin_top_learners', { p_limit: limit })).map(topLearnerFromRow)
    }

    static async teachers() {
        return (await call<TeacherStatRow[]>('admin_teachers')).map(teacherStatFromRow)
    }

    static async users() {
        return (await call<AdminUserRow[]>('admin_list_users')).map(adminUserFromRow)
    }

    static async addRole(userId: string, role: UserRole): Promise<void> {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role })
        if (error) throw error
    }

    static async removeRole(userId: string, role: UserRole): Promise<void> {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role)
        if (error) throw error
    }

    static async deleteUser(userId: string): Promise<void> {
        await call<null>('admin_delete_user', { p_user: userId })
    }
}
