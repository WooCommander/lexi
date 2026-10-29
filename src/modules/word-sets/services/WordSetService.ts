import { supabase } from '@/api/supabase'
import { chunk, fetchAllRows } from '@/api/paginate'
import { VocabularyService } from '@/modules/vocabulary/services/VocabularyService'
import {
    vocabularyItemFromRow,
    type VocabularyItemInput,
    type VocabularyItemRow,
} from '@/modules/vocabulary/domain/VocabularyItem'
import {
    WORD_SET_SELECT,
    wordSetFromRow,
    type WordSet,
    type WordSetEntry,
    type WordSetInput,
    type WordSetRow,
} from '../domain/WordSet'

export type { WordSetEntry }

interface WordSetItemRow {
    word_set_id: string
    position: number
    vocabulary_items: VocabularyItemRow | null
}

export const entryFromRow = (row: WordSetItemRow): WordSetEntry | null =>
    row.vocabulary_items
        ? { wordSetId: row.word_set_id, position: row.position, item: vocabularyItemFromRow(row.vocabulary_items) }
        : null

export class WordSetService {
    static async fetchOwned(ownerId: string): Promise<WordSet[]> {
        const { data, error } = await supabase
            .from('word_sets')
            .select(WORD_SET_SELECT)
            .eq('owner_id', ownerId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return (data as WordSetRow[]).map(wordSetFromRow)
    }

    static async fetchByIds(ids: string[]): Promise<WordSet[]> {
        if (!ids.length) return []
        const result: WordSet[] = []
        for (const part of chunk([...new Set(ids)], 100)) {
            const { data, error } = await supabase.from('word_sets').select(WORD_SET_SELECT).in('id', part)
            if (error) throw error
            result.push(...(data as WordSetRow[]).map(wordSetFromRow))
        }
        return result
    }

    static async fetch(id: string): Promise<WordSet | null> {
        const { data, error } = await supabase.from('word_sets').select(WORD_SET_SELECT).eq('id', id).maybeSingle()
        if (error) throw error
        return data ? wordSetFromRow(data as WordSetRow) : null
    }

    static async create(input: WordSetInput): Promise<WordSet> {
        const { data, error } = await supabase
            .from('word_sets')
            .insert({
                name: input.name.trim(),
                description: input.description?.trim() || null,
                source_language_id: input.sourceLanguageId,
                target_language_id: input.targetLanguageId,
                source: input.source,
            })
            .select(WORD_SET_SELECT)
            .single()
        if (error) throw error
        return wordSetFromRow(data as WordSetRow)
    }

    /** Языковую пару набора после создания не меняем — слова уже привязаны к ней. */
    static async update(id: string, patch: { name?: string; description?: string }): Promise<void> {
        const { error } = await supabase
            .from('word_sets')
            .update({
                ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
                ...(patch.description !== undefined ? { description: patch.description.trim() || null } : {}),
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
        if (error) throw error
    }

    static async remove(id: string): Promise<void> {
        const { error } = await supabase.from('word_sets').delete().eq('id', id)
        if (error) throw error
    }

    static async fetchEntries(setIds: string[]): Promise<WordSetEntry[]> {
        if (!setIds.length) return []
        const rows: WordSetItemRow[] = []
        for (const part of chunk([...new Set(setIds)], 50)) {
            rows.push(
                ...((await fetchAllRows<unknown>((from, to) =>
                    supabase
                        .from('word_set_items')
                        .select('word_set_id, position, vocabulary_items(*)')
                        .in('word_set_id', part)
                        // составной первичный ключ: порядок однозначный, страницы не пересекаются
                        .order('word_set_id')
                        .order('vocabulary_item_id')
                        .range(from, to),
                )) as WordSetItemRow[]),
            )
        }
        return rows
            .map(entryFromRow)
            .filter((e): e is WordSetEntry => !!e)
            .sort((a, b) => a.position - b.position)
    }

    /** Создаёт слова в паре набора и добавляет их в конец набора. */
    static async addWords(set: WordSet, inputs: VocabularyItemInput[], startPosition: number): Promise<WordSetEntry[]> {
        const items = await VocabularyService.createMany(set, inputs)
        if (!items.length) return []
        const links = items.map((item, i) => ({
            word_set_id: set.id,
            vocabulary_item_id: item.id,
            position: startPosition + i,
        }))
        const { error } = await supabase.from('word_set_items').insert(links)
        if (error) throw error
        return items.map((item, i) => ({ wordSetId: set.id, position: startPosition + i, item }))
    }

    static async unlink(setId: string, itemId: string): Promise<void> {
        const { error } = await supabase
            .from('word_set_items')
            .delete()
            .eq('word_set_id', setId)
            .eq('vocabulary_item_id', itemId)
        if (error) throw error
    }
}
