import { defineStore } from 'pinia'
import { ref } from 'vue'
import { SettingsService } from '../services/SettingsService'
import { defaultSettings, type UserSettings } from '../domain/UserSettings'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'

export const useSettingsStore = defineStore('settings', () => {
    const settings = ref<UserSettings | null>(null)
    const isLoading = ref(false)

    const load = async (force = false) => {
        const auth = useAuthStore()
        if (!auth.userId) {
            settings.value = null
            return
        }
        if (!force && settings.value?.userId === auth.userId) return
        isLoading.value = true
        try {
            const loaded = await SettingsService.fetch(auth.userId)
            // родной язык по умолчанию — русский (язык перевода из ТЗ)
            if (!loaded.nativeLanguageId) {
                const languages = useLanguagesStore()
                await languages.load()
                loaded.nativeLanguageId = languages.byCode.get('ru')?.id ?? null
            }
            settings.value = loaded
        } finally {
            isLoading.value = false
        }
    }

    const save = async (patch: Partial<Omit<UserSettings, 'userId'>>) => {
        const auth = useAuthStore()
        if (!auth.userId) return
        const next = { ...(settings.value ?? defaultSettings(auth.userId)), ...patch }
        await SettingsService.save(next, true)
        settings.value = next
    }

    const goalFor = (languageId?: string) => {
        const s = settings.value
        if (!s) return 10
        return (languageId && s.languageGoals[languageId]) || s.dailyGoal
    }

    return { settings, isLoading, load, save, goalFor }
})
