import { supabase } from '@/api/supabase'
import { ProgressService } from '@/modules/training/services/ProgressService'
import { WordSetService } from '@/modules/word-sets/services/WordSetService'
import { VocabularyService } from '@/modules/vocabulary/services/VocabularyService'
import { WORD_SET_SELECT, wordSetFromRow, type WordSet, type WordSetEntry, type WordSetRow } from '@/modules/word-sets/domain/WordSet'
import { ASSIGNMENT_SELECT, assignmentFromRow, type AssignmentRow, type LearningAssignment } from '@/modules/assignments/domain/Assignment'
import type { ReviewHistoryItem, WordProgress } from '@/modules/training/domain/Training'
import type { VocabularyItem } from '@/modules/vocabulary/domain/VocabularyItem'
import { addDays } from '@/shared/lib/dates'

export interface StudentsStatsData {
    studentIds: string[]
    sets: WordSet[]
    entries: WordSetEntry[]
    assignments: LearningAssignment[]
    items: Map<string, VocabularyItem>
    progress: WordProgress[]
    history: ReviewHistoryItem[]
}

/** Сколько дней истории ответов загружаем для графиков и фильтра по периоду. */
export const HISTORY_DAYS = 90

export class StatisticsService {
    /**
     * Всё для статистики одного или нескольких учеников: их наборы, задания,
     * прогресс и историю. RLS гарантирует, что чужих учеников мы не увидим.
     */
    static async loadForStudents(studentIds: string[]): Promise<StudentsStatsData> {
        const ids = [...new Set(studentIds)]
        if (!ids.length) {
            return { studentIds: [], sets: [], entries: [], assignments: [], items: new Map(), progress: [], history: [] }
        }

        const [ownSetsRes, assignmentRes, progress, history] = await Promise.all([
            supabase.from('word_sets').select(WORD_SET_SELECT).in('owner_id', ids),
            supabase.from('assignment_students').select(`student_id, assignments(${ASSIGNMENT_SELECT})`).in('student_id', ids),
            ProgressService.fetchForStudents(ids),
            ProgressService.fetchHistory(ids, addDays(new Date(), -HISTORY_DAYS)),
        ])
        if (ownSetsRes.error) throw ownSetsRes.error
        if (assignmentRes.error) throw assignmentRes.error

        const ownSets = (ownSetsRes.data as WordSetRow[]).map(wordSetFromRow)
        const assignmentsById = new Map<string, LearningAssignment>()
        for (const row of assignmentRes.data as unknown as { assignments: AssignmentRow | null }[]) {
            if (row.assignments) assignmentsById.set(row.assignments.id, assignmentFromRow(row.assignments))
        }
        const assignments = [...assignmentsById.values()]

        const ownIds = new Set(ownSets.map(s => s.id))
        const assignedSets = await WordSetService.fetchByIds(assignments.map(a => a.wordSetId).filter(id => !ownIds.has(id)))
        const sets = [...ownSets, ...assignedSets]
        const entries = await WordSetService.fetchEntries(sets.map(s => s.id))

        const items = new Map(entries.map(e => [e.item.id, e.item]))
        const missing = progress.map(p => p.vocabularyItemId).filter(id => !items.has(id))
        if (missing.length) {
            for (const item of await VocabularyService.fetchByIds(missing)) items.set(item.id, item)
        }

        return { studentIds: ids, sets, entries, assignments, items, progress, history }
    }
}

/** id слов, доступных ученику: личные наборы + наборы из его заданий. */
export const studentItemIds = (data: StudentsStatsData, studentId: string, setFilter?: string | null): Set<string> => {
    const setIds = new Set(
        data.sets.filter(s => s.ownerId === studentId).map(s => s.id),
    )
    for (const a of data.assignments) {
        if (a.studentIds.includes(studentId)) setIds.add(a.wordSetId)
    }
    const result = new Set<string>()
    for (const e of data.entries) {
        if (!setIds.has(e.wordSetId)) continue
        if (setFilter && e.wordSetId !== setFilter) continue
        result.add(e.item.id)
    }
    return result
}

export const progressMapFor = (data: StudentsStatsData, studentId: string) =>
    new Map(data.progress.filter(p => p.studentId === studentId).map(p => [p.vocabularyItemId, p]))
