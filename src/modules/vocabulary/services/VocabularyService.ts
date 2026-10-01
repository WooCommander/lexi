import { supabase } from '@/api/supabase'
import type { LanguagePair } from '@/modules/languages/domain/Language'
import {
    vocabularyItemFromRow,
    vocabularyItemToRow,
    type VocabularyItem,
    type VocabularyItemInput,
    type VocabularyItemRow,
} from '../domain/VocabularyItem'

const CHUNK = 200

export class VocabularyService {
    static async createMany(pair: LanguagePair, inputs: VocabularyItemInput[]): Promise<VocabularyItem[]> {
        if (!inputs.length) return []
        const { data, error } = await supabase
            .from('vocabulary_items')
            .insert(inputs.map(input => vocabularyItemToRow(pair, input)))
            .select()
        if (error) throw error
        return (data as VocabularyItemRow[]).map(vocabularyItemFromRow)
    }

    static async update(id: string, pair: LanguagePair, input: VocabularyItemInput): Promise<VocabularyItem> {
        const { data, error } = await supabase
            .from('vocabulary_items')
            .update({ ...vocabularyItemToRow(pair, input), updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return vocabularyItemFromRow(data as VocabularyItemRow)
    }

    static async remove(id: string): Promise<void> {
        const { error } = await supabase.from('vocabulary_items').delete().eq('id', id)
        if (error) throw error
    }

    static async fetchByIds(ids: string[]): Promise<VocabularyItem[]> {
        const unique = [...new Set(ids)]
        const result: VocabularyItem[] = []
        // длинный список id не влезает в URL — режем на части
        for (let i = 0; i < unique.length; i += CHUNK) {
            const { data, error } = await supabase
                .from('vocabulary_items')
                .select('*')
                .in('id', unique.slice(i, i + CHUNK))
            if (error) throw error
            result.push(...(data as VocabularyItemRow[]).map(vocabularyItemFromRow))
        }
        return result
    }
}
