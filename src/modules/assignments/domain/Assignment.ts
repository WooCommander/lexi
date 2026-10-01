export enum AssignmentStatus {
    Draft = 'draft',
    Active = 'active',
    Completed = 'completed',
    Archived = 'archived',
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
    [AssignmentStatus.Draft]: 'Черновик',
    [AssignmentStatus.Active]: 'Активно',
    [AssignmentStatus.Completed]: 'Завершено',
    [AssignmentStatus.Archived]: 'В архиве',
}

export type AssignmentSource = 'teacher' | 'parent'

export interface LearningAssignment {
    id: string

    /** teacherId из ТЗ; назначить может и родитель (source = 'parent'). */
    teacherId: string
    wordSetId: string
    groupId?: string
    source: AssignmentSource

    startAt?: string
    dueAt?: string

    newWordsPerDay?: number

    status: AssignmentStatus

    studentIds: string[]
    createdAt: string
}

export interface AssignmentInput {
    wordSetId: string
    studentIds: string[]
    groupId?: string
    source: AssignmentSource
    startAt?: string
    dueAt?: string
    newWordsPerDay?: number
}

export interface AssignmentRow {
    id: string
    assigned_by: string
    word_set_id: string
    group_id: string | null
    source: AssignmentSource
    start_at: string | null
    due_at: string | null
    new_words_per_day: number | null
    status: AssignmentStatus
    created_at: string
    assignment_students?: { student_id: string }[]
}

export const ASSIGNMENT_SELECT = '*, assignment_students(student_id)'

export const assignmentFromRow = (row: AssignmentRow): LearningAssignment => ({
    id: row.id,
    teacherId: row.assigned_by,
    wordSetId: row.word_set_id,
    groupId: row.group_id ?? undefined,
    source: row.source,
    startAt: row.start_at ?? undefined,
    dueAt: row.due_at ?? undefined,
    newWordsPerDay: row.new_words_per_day ?? undefined,
    status: row.status,
    studentIds: (row.assignment_students ?? []).map(s => s.student_id),
    createdAt: row.created_at,
})
