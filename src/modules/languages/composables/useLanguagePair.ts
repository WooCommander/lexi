import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useLanguagesStore } from '../state/useLanguagesStore'
import type { LanguagePair } from '../domain/Language'
import { TrainingDirection } from '@/modules/training/domain/Training'

/**
 * Подписи и флаги для языковой пары — чтобы формы и карточки не знали,
 * какой конкретно язык в них используется.
 */
export function useLanguagePair(pair: MaybeRefOrGetter<LanguagePair | null | undefined>) {
    const languages = useLanguagesStore()

    const source = computed(() => languages.get(toValue(pair)?.sourceLanguageId))
    const target = computed(() => languages.get(toValue(pair)?.targetLanguageId))

    const sourceLabel = computed(() => languages.label(source.value?.id))
    const targetLabel = computed(() => languages.label(target.value?.id))
    const sourceFlag = computed(() => languages.flag(source.value?.id))
    const targetFlag = computed(() => languages.flag(target.value?.id))
    const label = computed(() => `${sourceLabel.value} → ${targetLabel.value}`)

    const directionLabel = (direction: TrainingDirection) =>
        direction === TrainingDirection.Forward
            ? `${sourceLabel.value} → ${targetLabel.value}`
            : `${targetLabel.value} → ${sourceLabel.value}`

    return { source, target, sourceLabel, targetLabel, sourceFlag, targetFlag, label, directionLabel }
}
