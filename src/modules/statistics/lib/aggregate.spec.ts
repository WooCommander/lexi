import { describe, expect, it } from 'vitest'
import { activityByDay, byDirection, streakDays, summarize } from './aggregate'
import { TrainingDirection, TrainingResult, WordLearningStatus, type ReviewHistoryItem, type WordProgress } from '@/modules/training/domain/Training'
import { SpacedRepetitionService } from '@/modules/training/lib/SpacedRepetitionService'

const NOW = new Date('2026-10-02T12:00:00')

const p = (id: string, patch: Partial<WordProgress>): WordProgress => ({
    ...SpacedRepetitionService.initialState(),
    studentId: 's',
    vocabularyItemId: id,
    ...patch,
})

const h = (createdAt: string, result: TrainingResult): ReviewHistoryItem => ({
    id: createdAt + result,
    studentId: 's',
    vocabularyItemId: 'a',
    direction: TrainingDirection.Forward,
    result,
    createdAt,
})

describe('statistics aggregate', () => {
    it('summarizes statuses; words without progress are new', () => {
        const progress = new Map([
            ['a', p('a', { status: WordLearningStatus.Learned, correctAnswers: 8, wrongAnswers: 2 })],
            ['b', p('b', { status: WordLearningStatus.Learning, correctAnswers: 0, wrongAnswers: 2 })],
        ])
        const s = summarize(['a', 'b', 'c', 'c'], progress)
        expect(s).toMatchObject({ total: 3, learned: 1, learning: 1, fresh: 1, correct: 8, wrong: 4 })
        expect(s.accuracy).toBeCloseTo(8 / 12)
    })

    it('splits accuracy by direction', () => {
        const [fwd, rev] = byDirection([p('a', { forwardCorrect: 9, forwardWrong: 1, reverseCorrect: 1, reverseWrong: 1 })])
        expect(fwd.accuracy).toBeCloseTo(0.9)
        expect(rev.accuracy).toBeCloseTo(0.5)
    })

    it('buckets activity by day and counts the streak', () => {
        const history = [
            h('2026-10-02T09:00:00', TrainingResult.Correct),
            h('2026-10-01T09:00:00', TrainingResult.Wrong),
            h('2026-09-30T09:00:00', TrainingResult.Correct),
            h('2026-09-20T09:00:00', TrainingResult.Correct),
        ]
        const days = activityByDay(history, 3, NOW)
        expect(days.map(d => [d.date, d.correct, d.wrong])).toEqual([
            ['2026-09-30', 1, 0],
            ['2026-10-01', 0, 1],
            ['2026-10-02', 1, 0],
        ])
        expect(streakDays(history, NOW)).toBe(3)
    })
})
