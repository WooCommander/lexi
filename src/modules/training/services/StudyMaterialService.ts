import { supabase } from '@/api/supabase'
import { WordSetService } from '@/modules/word-sets/services/WordSetService'
import type { WordSet } from '@/modules/word-sets/domain/WordSet'
import type { WordSetEntry } from '@/modules/word-sets/domain/WordSet'
import { ASSIGNMENT_SELECT, assignmentFromRow, type AssignmentRow, type LearningAssignment } from '@/modules/assignments/domain/Assignment'

export interface StudyMaterial {
    ownSets: WordSet[]
    assignedSets: WordSet[]
    assignments: LearningAssignment[]
    entries: WordSetEntry[]
}

export class StudyMaterialService {
    /** Задания, в которых участвует ученик (RLS отдаёт только его строки). */
    static async fetchStudentAssignments(studentId: string): Promise<LearningAssignment[]> {
        const { data, error } = await supabase
            .from('assignment_students')
            .select(`assignments(${ASSIGNMENT_SELECT})`)
            .eq('student_id', studentId)
        if (error) throw error
        return (data as unknown as { assignments: AssignmentRow | null }[])
            .map(r => r.assignments)
            .filter((r): r is AssignmentRow => !!r)
            .map(assignmentFromRow)
    }

    /** Всё, что ученик может тренировать: личные наборы + наборы из заданий. */
    static async load(studentId: string): Promise<StudyMaterial> {
        const [ownSets, assignments] = await Promise.all([
            WordSetService.fetchOwned(studentId),
            StudyMaterialService.fetchStudentAssignments(studentId),
        ])
        const ownIds = new Set(ownSets.map(s => s.id))
        const assignedIds = [...new Set(assignments.map(a => a.wordSetId))].filter(id => !ownIds.has(id))
        const assignedSets = await WordSetService.fetchByIds(assignedIds)
        const entries = await WordSetService.fetchEntries([...ownIds, ...assignedIds])
        return { ownSets, assignedSets, assignments, entries }
    }
}
