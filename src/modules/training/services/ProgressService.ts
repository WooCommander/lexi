import { supabase } from '@/api/supabase'
import {
    reviewFromRow,
    wordProgressFromRow,
    wordProgressToRow,
    type ReviewHistoryItem,
    type ReviewHistoryRow,
    type TrainingDirection,
    type TrainingResult,
    type WordProgress,
    type WordProgressRow,
} from '../domain/Training'
import { startOfDay } from '@/shared/lib/dates'

export interface AnswerRecord {
    progress: WordProgress
    direction: TrainingDirection
    result: TrainingResult
    assignmentId?: string
    answeredAt: string
}

export class ProgressService {
    static async fetchForStudents(studentIds: string[]): Promise<WordProgress[]> {
        if (!studentIds.length) return []
        const { data, error } = await supabase.from('word_progress').select('*').in('student_id', studentIds)
        if (error) throw error
        return (data as WordProgressRow[]).map(wordProgressFromRow)
    }

    static async fetchHistory(studentIds: string[], since?: Date): Promise<ReviewHistoryItem[]> {
        if (!studentIds.length) return []
        let query = supabase
            .from('review_history')
            .select('*')
            .in('student_id', studentIds)
            .order('created_at', { ascending: false })
            .limit(5000)
        if (since) query = query.gte('created_at', since.toISOString())
        const { data, error } = await query
        if (error) throw error
        return (data as ReviewHistoryRow[]).map(reviewFromRow)
    }

    /** Сколько разных слов ученик повторил сегодня — для дневной цели. */
    static async fetchTodayItemIds(studentId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('review_history')
            .select('vocabulary_item_id')
            .eq('student_id', studentId)
            .gte('created_at', startOfDay(new Date()).toISOString())
        if (error) throw error
        return [...new Set((data ?? []).map(r => r.vocabulary_item_id as string))]
    }

    /** Сохраняет ответ: обновляет прогресс и пишет строку в историю. */
    static async saveAnswer(record: AnswerRecord): Promise<void> {
        const { progress } = record
        const { error: progressError } = await supabase
            .from('word_progress')
            .upsert(wordProgressToRow(progress), { onConflict: 'student_id,vocabulary_item_id' })
        if (progressError) throw progressError

        const { error: historyError } = await supabase.from('review_history').insert({
            student_id: progress.studentId,
            vocabulary_item_id: progress.vocabularyItemId,
            direction: record.direction,
            result: record.result,
            assignment_id: record.assignmentId ?? null,
            created_at: record.answeredAt,
        })
        if (historyError) throw historyError
    }
}
