import type { VocabularyItemInput } from '@/modules/vocabulary/domain/VocabularyItem'

/** Слово идентифицируется парой «слово + перевод» без учёта регистра и лишних пробелов. */
export const wordKey = (word: Pick<VocabularyItemInput, 'sourceText' | 'targetText'>): string =>
    `${word.sourceText.trim().toLowerCase().replace(/\s+/g, ' ')}|${word.targetText.trim().toLowerCase().replace(/\s+/g, ' ')}`

export interface PickResult {
    /** Что действительно добавится. */
    fresh: VocabularyItemInput[]
    /** Сколько слов пропущено, потому что уже есть в наборе. */
    skipped: number
}

/** Отбирает из выбранных слов те, которых ещё нет в наборе; повторы среди самих выбранных тоже убираются. */
export const pickNewWords = (
    selected: readonly VocabularyItemInput[],
    existing: readonly Pick<VocabularyItemInput, 'sourceText' | 'targetText'>[],
): PickResult => {
    const seen = new Set(existing.map(wordKey))
    const fresh: VocabularyItemInput[] = []
    for (const word of selected) {
        const key = wordKey(word)
        if (seen.has(key)) continue
        seen.add(key)
        fresh.push(word)
    }
    return { fresh, skipped: selected.length - fresh.length }
}
