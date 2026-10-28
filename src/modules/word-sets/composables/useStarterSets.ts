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
import type { VocabularyItemInput } from '@/modules/vocabulary/domain/VocabularyItem'
import { pickNewWords } from '../lib/pickWords'

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

    /** Свои наборы с той же языковой парой, что у готового, — куда можно добавить выбранные слова. */
    const targetsFor = (starter: StarterSet) => {
        const sourceId = languages.byCode.get(starter.sourceCode)?.id
        const targetId = languages.byCode.get(starter.targetCode)?.id
        return sets.sets.filter(
            s => s.ownerId === auth.userId && s.sourceLanguageId === sourceId && s.targetLanguageId === targetId,
        )
    }

    /**
     * Собрать свой набор из выбранных слов готовой темы: в новый набор или в свой существующий
     * (слова, которые там уже есть, пропускаются).
     */
    const addSelected = async (
        starter: StarterSet,
        words: VocabularyItemInput[],
        target: { setId: string | null; name: string },
    ) => {
        const sourceLanguage = languages.byCode.get(starter.sourceCode)
        const targetLanguage = languages.byCode.get(starter.targetCode)
        if (!sourceLanguage || !targetLanguage) throw new Error('Язык набора не найден в справочнике')
        addingId.value = `${starter.id}:pick`
        try {
            let set = target.setId ? sets.sets.find(s => s.id === target.setId) : undefined
            let created = false
            let fresh = words
            let skipped = 0
            let start = 0
            if (set) {
                const existing = (await WordSetService.fetchEntries([set.id])).map(e => e.item)
                ;({ fresh, skipped } = pickNewWords(words, existing))
                start = existing.length
            } else {
                set = await sets.create({
                    name: target.name,
                    description: 'Из готовых наборов',
                    sourceLanguageId: sourceLanguage.id,
                    targetLanguageId: targetLanguage.id,
                    source: source.value,
                })
                created = true
            }
            try {
                if (fresh.length) await WordSetService.addWords(set, fresh, start)
            } catch (e) {
                if (created) await sets.remove(set.id).catch(() => undefined)
                throw e
            }
            sets.setItemCount(set.id, start + fresh.length)
            if (auth.activeRole === UserRole.Student) await useStudyStore().load(true)
            return { set, added: fresh.length, skipped }
        } finally {
            addingId.value = null
        }
    }

    return { add, addSelected, targetsFor, isAdded, addingId }
}
