import { supabase } from '@/api/supabase'

export class FavoriteService {
    static async fetchIds(studentId: string): Promise<string[]> {
        const { data, error } = await supabase.from('favorites').select('vocabulary_item_id').eq('student_id', studentId)
        if (error) throw error
        return (data ?? []).map(r => r.vocabulary_item_id as string)
    }

    static async add(studentId: string, itemId: string): Promise<void> {
        const { error } = await supabase
            .from('favorites')
            .upsert({ student_id: studentId, vocabulary_item_id: itemId }, { ignoreDuplicates: true })
        if (error) throw error
    }

    static async remove(studentId: string, itemId: string): Promise<void> {
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('student_id', studentId)
            .eq('vocabulary_item_id', itemId)
        if (error) throw error
    }
}
