import { isUserRole, UserRole } from '@/modules/auth/domain/User'

/** Строки, которые возвращают серверные функции admin_* (snake_case) и их домен (camelCase). */

export interface AdminOverview {
    users: number
    byRole: Record<string, number>
    active7d: number
    answers7d: number
    learnedWords: number
    vocabularyItems: number
    wordSets: number
    assignments: number
    groups: number
}

export interface AdminOverviewRow {
    users: number
    by_role: Record<string, number> | null
    active_7d: number
    answers_7d: number
    learned_words: number
    vocabulary_items: number
    word_sets: number
    assignments: number
    groups: number
}

export const overviewFromRow = (row: AdminOverviewRow): AdminOverview => ({
    users: Number(row.users),
    byRole: Object.fromEntries(Object.entries(row.by_role ?? {}).map(([k, v]) => [k, Number(v)])),
    active7d: Number(row.active_7d),
    answers7d: Number(row.answers_7d),
    learnedWords: Number(row.learned_words),
    vocabularyItems: Number(row.vocabulary_items),
    wordSets: Number(row.word_sets),
    assignments: Number(row.assignments),
    groups: Number(row.groups),
})

export interface ActivityDay {
    day: string
    activeUsers: number
    answers: number
    correct: number
}

export interface ActivityDayRow {
    day: string
    active_users: number
    answers: number
    correct: number
}

export const activityFromRow = (r: ActivityDayRow): ActivityDay => ({
    day: r.day,
    activeUsers: Number(r.active_users),
    answers: Number(r.answers),
    correct: Number(r.correct),
})

export interface SignupDay {
    day: string
    students: number
    teachers: number
    parents: number
}

export interface SignupDayRow {
    day: string
    students: number
    teachers: number
    parents: number
}

export const signupFromRow = (r: SignupDayRow): SignupDay => ({
    day: r.day,
    students: Number(r.students),
    teachers: Number(r.teachers),
    parents: Number(r.parents),
})

export interface LearnedBucket {
    bucket: string
    order: number
    students: number
}

export interface LearnedBucketRow {
    bucket: string
    ord: number
    students: number
}

export const bucketFromRow = (r: LearnedBucketRow): LearnedBucket => ({
    bucket: r.bucket,
    order: r.ord,
    students: Number(r.students),
})

export interface LanguageStat {
    languageId: string
    code: string
    name: string
    learners: number
    learned: number
    answers30d: number
}

export interface LanguageStatRow {
    language_id: string
    code: string
    name: string
    learners: number
    learned: number
    answers_30d: number
}

export const languageStatFromRow = (r: LanguageStatRow): LanguageStat => ({
    languageId: r.language_id,
    code: r.code,
    name: r.name,
    learners: Number(r.learners),
    learned: Number(r.learned),
    answers30d: Number(r.answers_30d),
})

export interface PopularWord {
    itemId: string
    sourceText: string
    targetText: string
    languageCode: string
    learners: number
    answers: number
    correct: number
}

export interface PopularWordRow {
    item_id: string
    source_text: string
    target_text: string
    language_code: string
    learners: number
    answers: number
    correct: number
}

export const popularWordFromRow = (r: PopularWordRow): PopularWord => ({
    itemId: r.item_id,
    sourceText: r.source_text,
    targetText: r.target_text,
    languageCode: r.language_code,
    learners: Number(r.learners),
    answers: Number(r.answers),
    correct: Number(r.correct),
})

export interface TopLearner {
    studentId: string
    name: string
    learned: number
    correct: number
    wrong: number
    lastActive?: string
}

export interface TopLearnerRow {
    student_id: string
    name: string
    learned: number
    correct: number
    wrong: number
    last_active: string | null
}

export const topLearnerFromRow = (r: TopLearnerRow): TopLearner => ({
    studentId: r.student_id,
    name: r.name,
    learned: Number(r.learned),
    correct: Number(r.correct),
    wrong: Number(r.wrong),
    lastActive: r.last_active ?? undefined,
})

export interface TeacherStat {
    teacherId: string
    name: string
    students: number
    groups: number
    sets: number
    assignments: number
    learned: number
    correct: number
    wrong: number
    activeStudents7d: number
    lastActive?: string
}

export interface TeacherStatRow {
    teacher_id: string
    name: string
    students: number
    groups: number
    sets: number
    assignments: number
    learned: number
    correct: number
    wrong: number
    active_students_7d: number
    last_active: string | null
}

export const teacherStatFromRow = (r: TeacherStatRow): TeacherStat => ({
    teacherId: r.teacher_id,
    name: r.name,
    students: Number(r.students),
    groups: Number(r.groups),
    sets: Number(r.sets),
    assignments: Number(r.assignments),
    learned: Number(r.learned),
    correct: Number(r.correct),
    wrong: Number(r.wrong),
    activeStudents7d: Number(r.active_students_7d),
    lastActive: r.last_active ?? undefined,
})

export interface AdminUser {
    id: string
    name: string
    email?: string
    roles: UserRole[]
    createdAt: string
    lastSignInAt?: string
}

export interface AdminUserRow {
    id: string
    name: string
    email: string | null
    roles: string[] | null
    created_at: string
    last_sign_in_at: string | null
}

export const adminUserFromRow = (r: AdminUserRow): AdminUser => ({
    id: r.id,
    name: r.name,
    email: r.email ?? undefined,
    roles: (r.roles ?? []).filter(isUserRole),
    createdAt: r.created_at,
    lastSignInAt: r.last_sign_in_at ?? undefined,
})
