import { defineStore } from 'pinia'
import { ref } from 'vue'
import { WordSetService } from '../services/WordSetService'
import type { WordSet, WordSetInput } from '../domain/WordSet'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'

/** Наборы, которыми владеет текущий пользователь (библиотека учителя / родителя / личные). */
export const useWordSetsStore = defineStore('wordSets', () => {
    const sets = ref<WordSet[]>([])
    const isLoading = ref(false)
    const loadedFor = ref<string | null>(null)

    const load = async (force = false) => {
        const auth = useAuthStore()
        if (!auth.userId) {
            sets.value = []
            return
        }
        if (!force && loadedFor.value === auth.userId) return
        isLoading.value = true
        try {
            sets.value = await WordSetService.fetchOwned(auth.userId)
            loadedFor.value = auth.userId
        } finally {
            isLoading.value = false
        }
    }

    const create = async (input: WordSetInput) => {
        const set = await WordSetService.create(input)
        sets.value = [set, ...sets.value]
        return set
    }

    const update = async (id: string, patch: { name?: string; description?: string }) => {
        await WordSetService.update(id, patch)
        sets.value = sets.value.map(s =>
            s.id === id
                ? { ...s, name: patch.name ?? s.name, description: patch.description ?? s.description }
                : s,
        )
    }

    const remove = async (id: string) => {
        await WordSetService.remove(id)
        sets.value = sets.value.filter(s => s.id !== id)
    }

    const setItemCount = (id: string, count: number) => {
        sets.value = sets.value.map(s => (s.id === id ? { ...s, itemCount: count } : s))
    }

    const reset = () => {
        sets.value = []
        loadedFor.value = null
    }

    return { sets, isLoading, load, create, update, remove, setItemCount, reset }
})
