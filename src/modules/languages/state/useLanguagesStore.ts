import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { LanguageService, type LanguageInput } from '../services/LanguageService'
import { languageLabel, type Language, type LanguagePair } from '../domain/Language'
import type { LxSelectOption } from '@/design-system'

export const useLanguagesStore = defineStore('languages', () => {
    const languages = ref<Language[]>([])
    const isLoaded = ref(false)
    let loading: Promise<void> | null = null

    const byId = computed(() => new Map(languages.value.map(l => [l.id, l])))
    const byCode = computed(() => new Map(languages.value.map(l => [l.code, l])))

    const options = computed<LxSelectOption[]>(() =>
        languages.value.map(l => ({ value: l.id, label: `${l.flag ?? ''} ${languageLabel(l)}`.trim() })),
    )

    const load = (force = false) => {
        if (isLoaded.value && !force) return Promise.resolve()
        if (loading) return loading
        loading = LanguageService.fetchAll()
            .then(list => {
                languages.value = list
                isLoaded.value = true
            })
            .finally(() => {
                loading = null
            })
        return loading
    }

    const get = (id: string | null | undefined) => (id ? byId.value.get(id) : undefined)
    const label = (id: string | null | undefined) => languageLabel(get(id))
    const flag = (id: string | null | undefined) => get(id)?.flag ?? '🌐'
    const pairLabel = (pair: LanguagePair) => `${label(pair.sourceLanguageId)} → ${label(pair.targetLanguageId)}`

    const create = async (input: LanguageInput) => {
        const lang = await LanguageService.create(input)
        languages.value = [...languages.value, lang].sort((a, b) => a.name.localeCompare(b.name))
        return lang
    }

    return { languages, isLoaded, byId, byCode, options, load, get, label, flag, pairLabel, create }
})
