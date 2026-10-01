import { supabase } from '@/api/supabase'
import { languageFromRow, type Language, type LanguageRow } from '../domain/Language'

export interface LanguageInput {
    code: string
    name: string
    nativeName?: string
    displayName?: string
    flag?: string
}

export class LanguageService {
    static async fetchAll(): Promise<Language[]> {
        const { data, error } = await supabase.from('languages').select('*').order('name')
        if (error) throw error
        return (data as LanguageRow[]).map(languageFromRow)
    }

    static async create(input: LanguageInput): Promise<Language> {
        const { data, error } = await supabase
            .from('languages')
            .insert({
                code: input.code.trim().toLowerCase(),
                name: input.name.trim(),
                native_name: input.nativeName?.trim() || null,
                display_name: input.displayName?.trim() || null,
                flag: input.flag?.trim() || null,
            })
            .select()
            .single()
        if (error) throw error
        return languageFromRow(data as LanguageRow)
    }
}
