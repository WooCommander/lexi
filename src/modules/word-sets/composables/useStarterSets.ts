import { computed, ref } from 'vue'
import { useWordSetsStore } from '../state/useWordSetsStore'
import { WordSetService } from '../services/WordSetService'
import { WordSource } from '../domain/WordSet'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { UserRole } from '@/modules/auth/domain/User'
import { useLanguagesStore } from '@/modules/languages/state/useLanguagesStore'
import { useStudyStore } from '@/modules/training/state/useStudyStore'
import { GRADE_LABELS } from '@/modules/vocabulary/lib/catalog/topics'
import type { StarterSet } from '@/modules/vocabulary/lib/starterSets'

/** Добавление готовых наборов в библиотеку пользователя (ученик, родитель или учитель). */
export function useStarterSets() {
    const sets = useWordSetsStore()
    const auth = useAuthStore()
    const languages = useLanguagesStore()
    const addingId = ref<string | null>(null)

    const source = computed(() =>
        auth.activeRole === UserRole.Teacher
            ? WordSource.Teacher
            : auth.activeRole === UserRole.Parent
              ? WordSource.Parent
              : WordSource.Personal,
    )

    const isAdded = (starter: StarterSet) => sets.sets.some(s => s.name === starter.name)

    /** Создаёт набор и наполняет словами. Бросает ошибку — показать её должен вызывающий. */
    const add = async (starter: StarterSet) => {
        const sourceLanguage = languages.byCode.get(starter.sourceCode)
        const targetLanguage = languages.byCode.get(starter.targetCode)
        if (!sourceLanguage || !targetLanguage) throw new Error('Язык набора не найден в справочнике')
        addingId.value = starter.id
        try {
            const set = await sets.create({
                name: starter.name,
                description: `Готовый набор · ${GRADE_LABELS[starter.grades]}`,
                sourceLanguageId: sourceLanguage.id,
                targetLanguageId: targetLanguage.id,
                source: source.value,
            })
            try {
                await WordSetService.addWords(set, starter.words, 0)
            } catch (e) {
                // не оставляем пустой набор: иначе он считался бы добавленным, а слов в нём нет
                await sets.remove(set.id).catch(() => undefined)
                throw e
            }
            sets.setItemCount(set.id, starter.words.length)
            // у ученика новые слова должны сразу попасть на главный экран
            if (auth.activeRole === UserRole.Student) await useStudyStore().load(true)
            return set
        } finally {
            addingId.value = null
        }
    }

    return { add, isAdded, addingId }
}
