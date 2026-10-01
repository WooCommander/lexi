import {
    TrainingDirection,
    TrainingResult,
    WordLearningStatus,
    type ReviewHistoryItem,
    type WordProgress,
} from '@/modules/training/domain/Training'
import { DifficultWordsService, accuracy } from '@/modules/training/lib/DifficultWordsService'
import type { VocabularyItem } from '@/modules/vocabulary/domain/VocabularyItem'
import { addDays, startOfDay, toISODate } from '@/shared/lib/dates'

export interface ProgressSummary {
    total: number
    learned: number
    learning: number
    fresh: number
    correct: number
    wrong: number
    /** 0..1 или null, если ответов не было */
    accuracy: number | null
}

/** Сводка по набору слов: слова без прогресса считаются новыми. */
export const summarize = (itemIds: Iterable<string>, progress: ReadonlyMap<string, WordProgress>): ProgressSummary => {
    const s: ProgressSummary = { total: 0, learned: 0, learning: 0, fresh: 0, correct: 0, wrong: 0, accuracy: null }
    for (const id of new Set(itemIds)) {
        s.total++
        const p = progress.get(id)
        if (!p || p.status === WordLearningStatus.New) s.fresh++
        else if (p.status === WordLearningStatus.Learned) s.learned++
        else s.learning++
        if (p) {
            s.correct += p.correctAnswers
            s.wrong += p.wrongAnswers
        }
    }
    s.accuracy = accuracy(s.correct, s.wrong)
    return s
}

export interface DirectionStats {
    direction: TrainingDirection
    correct: number
    wrong: number
    accuracy: number | null
}

export const byDirection = (list: Iterable<WordProgress>): DirectionStats[] => {
    let fc = 0, fw = 0, rc = 0, rw = 0
    for (const p of list) {
        fc += p.forwardCorrect
        fw += p.forwardWrong
        rc += p.reverseCorrect
        rw += p.reverseWrong
    }
    return [
        { direction: TrainingDirection.Forward, correct: fc, wrong: fw, accuracy: accuracy(fc, fw) },
        { direction: TrainingDirection.Reverse, correct: rc, wrong: rw, accuracy: accuracy(rc, rw) },
    ]
}

export interface WordStatsRow {
    item: VocabularyItem
    progress?: WordProgress
    status: WordLearningStatus
    forwardAccuracy: number | null
    reverseAccuracy: number | null
    difficult: boolean
}

export const wordStats = (item: VocabularyItem, progress?: WordProgress): WordStatsRow => ({
    item,
    progress,
    status: progress?.status ?? WordLearningStatus.New,
    forwardAccuracy: progress ? accuracy(progress.forwardCorrect, progress.forwardWrong) : null,
    reverseAccuracy: progress ? accuracy(progress.reverseCorrect, progress.reverseWrong) : null,
    difficult: DifficultWordsService.isDifficult(progress),
})

export interface DayActivity {
    date: string
    correct: number
    wrong: number
}

/** Активность по дням за последние `days` дней (включая сегодня), от старых к новым. */
export const activityByDay = (history: Iterable<ReviewHistoryItem>, days: number, now: Date = new Date()): DayActivity[] => {
    const first = addDays(startOfDay(now), -(days - 1))
    const buckets = new Map<string, DayActivity>()
    for (let i = 0; i < days; i++) {
        const date = toISODate(addDays(first, i))
        buckets.set(date, { date, correct: 0, wrong: 0 })
    }
    for (const h of history) {
        const bucket = buckets.get(toISODate(new Date(h.createdAt)))
        if (!bucket) continue
        if (h.result === TrainingResult.Correct) bucket.correct++
        else bucket.wrong++
    }
    return [...buckets.values()]
}

export const historyAccuracy = (history: Iterable<ReviewHistoryItem>): number | null => {
    let c = 0, w = 0
    for (const h of history) {
        if (h.result === TrainingResult.Correct) c++
        else w++
    }
    return accuracy(c, w)
}

/** Дней подряд с занятиями, заканчивая сегодня (или вчера, если сегодня ещё не занимались). */
export const streakDays = (history: Iterable<ReviewHistoryItem>, now: Date = new Date()): number => {
    const days = new Set<string>()
    for (const h of history) days.add(toISODate(new Date(h.createdAt)))
    let cursor = startOfDay(now)
    if (!days.has(toISODate(cursor))) cursor = addDays(cursor, -1)
    let streak = 0
    while (days.has(toISODate(cursor))) {
        streak++
        cursor = addDays(cursor, -1)
    }
    return streak
}

export const formatPercent = (value: number | null | undefined): string =>
    value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`
