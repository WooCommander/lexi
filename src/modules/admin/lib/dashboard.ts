import { accuracy } from '@/modules/training/lib/DifficultWordsService'
import type { ActivityDay, AdminOverview, TeacherStat } from '../domain/Admin'

/** Чистые расчёты для плиток и подписей дашборда администратора — без Vue и Supabase. */

/** Доля 0..1 → «84%», пустое значение → «—». */
export const percentText = (value: number | null | undefined): string =>
    value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`

export const periodAccuracy = (days: readonly ActivityDay[]): number | null => {
    const answers = days.reduce((n, d) => n + d.answers, 0)
    const correct = days.reduce((n, d) => n + d.correct, 0)
    return accuracy(correct, answers - correct)
}

export const periodAnswers = (days: readonly ActivityDay[]): number => days.reduce((n, d) => n + d.answers, 0)

/** Сколько слов в среднем освоил один ученик. */
export const avgLearnedPerStudent = (overview: Pick<AdminOverview, 'learnedWords' | 'byRole'>): number => {
    const students = overview.byRole.student ?? 0
    return students ? overview.learnedWords / students : 0
}

/** Среднее число учеников на одного учителя. */
export const avgStudentsPerTeacher = (teachers: readonly TeacherStat[]): number =>
    teachers.length ? teachers.reduce((n, t) => n + t.students, 0) / teachers.length : 0

export const teacherAccuracy = (t: Pick<TeacherStat, 'correct' | 'wrong'>): number | null => accuracy(t.correct, t.wrong)

/** Доля учеников учителя, занимавшихся за 7 дней; null — учеников нет. */
export const teacherActiveShare = (t: Pick<TeacherStat, 'students' | 'activeStudents7d'>): number | null =>
    t.students ? t.activeStudents7d / t.students : null

/** Пользователь «активен», если входил или отвечал за последние `days` дней. */
export const isRecent = (iso: string | undefined, days: number, now: Date = new Date()): boolean =>
    !!iso && now.getTime() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000
