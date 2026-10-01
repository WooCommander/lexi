import type { LanguagePair } from '@/modules/languages/domain/Language'

/** Словарная единица — всегда языковая пара, никаких полей english/russian. */
export interface VocabularyItem {
    id: string

    sourceLanguageId: string
    targetLanguageId: string

    sourceText: string
    targetText: string

    sourceTranscription?: string
    targetTranscription?: string

    exampleSource?: string
    exampleTarget?: string

    createdBy: string
    createdAt: string
}

export interface VocabularyItemInput {
    sourceText: string
    targetText: string
    sourceTranscription?: string
    targetTranscription?: string
    exampleSource?: string
    exampleTarget?: string
}

export interface VocabularyItemRow {
    id: string
    source_language_id: string
    target_language_id: string
    source_text: string
    target_text: string
    source_transcription: string | null
    target_transcription: string | null
    example_source: string | null
    example_target: string | null
    created_by: string
    created_at: string
}

export const vocabularyItemFromRow = (row: VocabularyItemRow): VocabularyItem => ({
    id: row.id,
    sourceLanguageId: row.source_language_id,
    targetLanguageId: row.target_language_id,
    sourceText: row.source_text,
    targetText: row.target_text,
    sourceTranscription: row.source_transcription ?? undefined,
    targetTranscription: row.target_transcription ?? undefined,
    exampleSource: row.example_source ?? undefined,
    exampleTarget: row.example_target ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
})

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null)

export const vocabularyItemToRow = (pair: LanguagePair, input: VocabularyItemInput) => ({
    source_language_id: pair.sourceLanguageId,
    target_language_id: pair.targetLanguageId,
    source_text: input.sourceText.trim(),
    target_text: input.targetText.trim(),
    source_transcription: clean(input.sourceTranscription),
    target_transcription: clean(input.targetTranscription),
    example_source: clean(input.exampleSource),
    example_target: clean(input.exampleTarget),
})
