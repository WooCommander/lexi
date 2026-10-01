import type { VocabularyItem } from '@/modules/vocabulary/domain/VocabularyItem'
import type { LanguagePair } from '@/modules/languages/domain/Language'

export enum WordSource {
    Personal = 'personal',
    Parent = 'parent',
    Teacher = 'teacher',
}

export const WORD_SOURCE_LABELS: Record<WordSource, string> = {
    [WordSource.Personal]: 'Личный',
    [WordSource.Parent]: 'От родителя',
    [WordSource.Teacher]: 'От учителя',
}

export interface WordSet extends LanguagePair {
    id: string
    name: string
    description?: string

    sourceLanguageId: string
    targetLanguageId: string

    ownerId: string
    source: WordSource
    itemCount: number
    createdAt: string
}

export interface WordSetInput extends LanguagePair {
    name: string
    description?: string
    source: WordSource
}

export interface WordSetRow {
    id: string
    name: string
    description: string | null
    source_language_id: string
    target_language_id: string
    owner_id: string
    source: WordSource
    created_at: string
    word_set_items?: { count: number }[]
}

/** select-строка, включающая счётчик слов */
export const WORD_SET_SELECT = '*, word_set_items(count)'

export const wordSetFromRow = (row: WordSetRow): WordSet => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    sourceLanguageId: row.source_language_id,
    targetLanguageId: row.target_language_id,
    ownerId: row.owner_id,
    source: row.source,
    itemCount: row.word_set_items?.[0]?.count ?? 0,
    createdAt: row.created_at,
})

/** Слово внутри конкретного набора с его позицией. */
export interface WordSetEntry {
    wordSetId: string
    position: number
    item: VocabularyItem
}
