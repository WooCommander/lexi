import { supabase } from '@/api/supabase'
import {
    ASSIGNMENT_SELECT,
    AssignmentStatus,
    assignmentFromRow,
    type AssignmentInput,
    type AssignmentRow,
    type LearningAssignment,
} from '../domain/Assignment'

export class AssignmentService {
    static async fetchCreatedBy(userId: string): Promise<LearningAssignment[]> {
        const { data, error } = await supabase
            .from('assignments')
            .select(ASSIGNMENT_SELECT)
            .eq('assigned_by', userId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return (data as AssignmentRow[]).map(assignmentFromRow)
    }

    /** Задания конкретного ученика — для родителя («видеть задания учителя»). */
    static async fetchForStudent(studentId: string): Promise<LearningAssignment[]> {
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

    static async create(input: AssignmentInput): Promise<LearningAssignment> {
        const { data, error } = await supabase
            .from('assignments')
            .insert({
                word_set_id: input.wordSetId,
                group_id: input.groupId ?? null,
                source: input.source,
                start_at: input.startAt || null,
                due_at: input.dueAt || null,
                new_words_per_day: input.newWordsPerDay || null,
                status: AssignmentStatus.Active,
            })
            .select('*')
            .single()
        if (error) throw error

        const assignment = assignmentFromRow(data as AssignmentRow)
        const studentIds = [...new Set(input.studentIds)]
        if (studentIds.length) {
            const { error: linkError } = await supabase
                .from('assignment_students')
                .insert(studentIds.map(student_id => ({ assignment_id: assignment.id, student_id })))
            if (linkError) {
                // не оставляем «пустое» задание
                await supabase.from('assignments').delete().eq('id', assignment.id)
                throw linkError
            }
        }
        return { ...assignment, studentIds }
    }

    static async setStatus(id: string, status: AssignmentStatus): Promise<void> {
        const { error } = await supabase.from('assignments').update({ status }).eq('id', id)
        if (error) throw error
    }

    static async remove(id: string): Promise<void> {
        const { error } = await supabase.from('assignments').delete().eq('id', id)
        if (error) throw error
    }
}
