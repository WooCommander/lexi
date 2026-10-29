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
import { chunk, fetchAllRows } from '@/api/paginate'

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
        const rows: WordProgressRow[] = []
        for (const ids of chunk([...new Set(studentIds)], 100)) {
            rows.push(
                ...(await fetchAllRows<WordProgressRow>((from, to) =>
                    supabase.from('word_progress').select('*').in('student_id', ids).order('id').range(from, to),
                )),
            )
        }
        return rows.map(wordProgressFromRow)
    }

    static async fetchHistory(studentIds: string[], since?: Date): Promise<ReviewHistoryItem[]> {
        if (!studentIds.length) return []
        const rows: ReviewHistoryRow[] = []
        for (const ids of chunk([...new Set(studentIds)], 100)) {
            rows.push(
                ...(await fetchAllRows<ReviewHistoryRow>((from, to) => {
                    let query = supabase.from('review_history').select('*').in('student_id', ids)
                    if (since) query = query.gte('created_at', since.toISOString())
                    return query.order('created_at', { ascending: false }).order('id').range(from, to)
                })),
            )
        }
        return rows.map(reviewFromRow)
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
