import { accuracy } from '@/modules/training/lib/DifficultWordsService'

/**
 * Рейтинги и сравнения для учителя: кто освоил больше слов, какой класс (группа) впереди,
 * кому нужно внимание. Чистая логика — данные считает экран, здесь только сортировка и агрегация.
 */

export interface StudentMetrics {
    studentId: string
    name: string
    /** Освоено слов (статус «Изучено»). */
    learned: number
    /** Назначено слов. */
    total: number
    /** Ответы за выбранный период. */
    correct: number
    wrong: number
    /** Сколько разных дней в периоде занимался. */
    activeDays: number
    /** Дней подряд с занятиями до сегодня. */
    streak: number
    /** Последний ответ (ISO) в загруженной истории. */
    lastActiveAt?: string
}

export interface RankedStudent extends StudentMetrics {
    rank: number
    accuracy: number | null
    answers: number
}

const withDerived = (m: StudentMetrics) => ({
    ...m,
    accuracy: accuracy(m.correct, m.wrong),
    answers: m.correct + m.wrong,
})

/**
 * Рейтинг по числу освоенных слов; при равенстве — точность, затем число ответов.
 * Места при полном равенстве общие (1, 1, 3): честнее, чем случайный порядок.
 */
export const rankStudents = (metrics: readonly StudentMetrics[]): RankedStudent[] => {
    const sorted = metrics
        .map(withDerived)
        .sort(
            (a, b) =>
                b.learned - a.learned ||
                (b.accuracy ?? -1) - (a.accuracy ?? -1) ||
                b.answers - a.answers ||
                a.name.localeCompare(b.name, 'ru'),
        )
    let previous: RankedStudent | undefined
    return sorted.map((m, index) => {
        const tied =
            previous && previous.learned === m.learned && previous.accuracy === m.accuracy && previous.answers === m.answers
        const rank = tied ? previous!.rank : index + 1
        const ranked = { ...m, rank }
        previous = ranked
        return ranked
    })
}

export interface GroupInput {
    id: string
    name: string
    studentIds: readonly string[]
}

export interface GroupRow {
    id: string
    name: string
    students: number
    learned: number
    /** Среднее число освоенных слов на ученика. */
    avgLearned: number
    accuracy: number | null
    /** Доля учеников, занимавшихся за последние `activeWithinDays` дней (0..1). */
    activeShare: number
    answers: number
}

/** Сравнение классов (групп) между собой. Ученики без группы попадают в отдельную строку. */
export const groupRows = (
    groups: readonly GroupInput[],
    metrics: readonly StudentMetrics[],
    now: Date = new Date(),
    activeWithinDays = 7,
): GroupRow[] => {
    const byId = new Map(metrics.map(m => [m.studentId, m]))
    const grouped = new Set(groups.flatMap(g => g.studentIds))
    const buckets: { id: string; name: string; members: StudentMetrics[] }[] = groups.map(g => ({
        id: g.id,
        name: g.name,
        members: g.studentIds.map(id => byId.get(id)).filter((m): m is StudentMetrics => !!m),
    }))
    const ungrouped = metrics.filter(m => !grouped.has(m.studentId))
    if (ungrouped.length) buckets.push({ id: 'no-group', name: 'Без группы', members: ungrouped })

    const rows = buckets
        .filter(b => b.members.length > 0)
        .map(b => {
            const learned = b.members.reduce((n, m) => n + m.learned, 0)
            const correct = b.members.reduce((n, m) => n + m.correct, 0)
            const wrong = b.members.reduce((n, m) => n + m.wrong, 0)
            const active = b.members.filter(m => daysSince(m.lastActiveAt, now) <= activeWithinDays).length
            return {
                id: b.id,
                name: b.name,
                students: b.members.length,
                learned,
                avgLearned: learned / b.members.length,
                accuracy: accuracy(correct, wrong),
                activeShare: active / b.members.length,
                answers: correct + wrong,
            }
        })
    return rows.sort((a, b) => b.avgLearned - a.avgLearned || (b.accuracy ?? -1) - (a.accuracy ?? -1))
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Сколько полных дней прошло с момента `iso`; Infinity, если занятий не было. */
export const daysSince = (iso: string | undefined, now: Date = new Date()): number =>
    iso ? Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS)) : Infinity

/** Ученики, которые давно не занимались — кому стоит напомнить. Дольше всех молчащие — первыми. */
export const inactiveStudents = (
    metrics: readonly StudentMetrics[],
    now: Date = new Date(),
    days = 7,
): (StudentMetrics & { daysAgo: number })[] =>
    metrics
        .map(m => ({ ...m, daysAgo: daysSince(m.lastActiveAt, now) }))
        .filter(m => m.daysAgo >= days)
        .sort((a, b) => b.daysAgo - a.daysAgo || a.name.localeCompare(b.name, 'ru'))

export interface WordKnowledge {
    itemId: string
    /** Сколько учеников освоили слово. */
    learnedBy: number
    /** Сколько учеников его вообще изучают. */
    students: number
    correct: number
    wrong: number
}

/**
 * Слова, которые лучше всего знают ученики: по числу освоивших, затем по точности.
 * Слова с малым числом ответов отсекаются, чтобы случайное «знаю» не попадало в топ.
 */
export const bestKnownWords = (words: readonly WordKnowledge[], limit = 10, minAnswers = 3): WordKnowledge[] =>
    words
        .filter(w => w.learnedBy > 0 && w.correct + w.wrong >= minAnswers)
        .sort(
            (a, b) =>
                b.learnedBy - a.learnedBy ||
                (accuracy(b.correct, b.wrong) ?? 0) - (accuracy(a.correct, a.wrong) ?? 0) ||
                b.correct - a.correct,
        )
        .slice(0, limit)
