import { supabase } from '@/api/supabase'
import {
    defaultSettings,
    settingsFromRow,
    settingsToRow,
    type UserSettings,
    type UserSettingsRow,
} from '../domain/UserSettings'

export class SettingsService {
    static async fetch(userId: string): Promise<UserSettings> {
        const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
        if (error) throw error
        return data ? settingsFromRow(data as UserSettingsRow) : defaultSettings(userId)
    }

    static async fetchMany(userIds: string[]): Promise<UserSettings[]> {
        if (!userIds.length) return []
        const { data, error } = await supabase.from('user_settings').select('*').in('user_id', userIds)
        if (error) throw error
        return (data as UserSettingsRow[]).map(settingsFromRow)
    }

    /** Свои настройки — upsert; чужие (родитель → ребёнок) — только update, вставка запрещена RLS. */
    static async save(settings: UserSettings, own: boolean): Promise<void> {
        const row = { ...settingsToRow(settings), updated_at: new Date().toISOString() }
        const { error } = own
            ? await supabase.from('user_settings').upsert(row, { onConflict: 'user_id' })
            : await supabase.from('user_settings').update(row).eq('user_id', settings.userId)
        if (error) throw error
    }
}
