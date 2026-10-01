import { describe, expect, it } from 'vitest'
import { LEARNED_INTERVAL_DAYS, SpacedRepetitionService as Srs } from './SpacedRepetitionService'
import { DifficultWordsService } from './DifficultWordsService'
import { buildSession, pickDirection } from './sessionBuilder'
import { buildStudyItems, unlockedCount } from './studyMaterial'
import {
    TrainingDirection,
    TrainingResult,
    WordLearningStatus,
    type StudyItem,
    type WordProgress,
} from '../domain/Training'
import { AssignmentStatus, type LearningAssignment } from '@/modules/assignments/domain/Assignment'
import type { VocabularyItem } from '@/modules/vocabulary/domain/VocabularyItem'

const NOW = new Date('2026-10-02T10:00:00')
const { Correct, Wrong } = TrainingResult
const { Forward, Reverse } = TrainingDirection

const item = (id: string): VocabularyItem => ({
    id,
    sourceLanguageId: 'en',
    targetLanguageId: 'ru',
    sourceText: `w-${id}`,
    targetText: `t-${id}`,
    createdBy: 'u',
    createdAt: NOW.toISOString(),
})

const study = (id: string, locked = false): StudyItem => ({ item: item(id), setIds: ['s1'], locked })

const progressOf = (id: string, patch: Partial<WordProgress>): WordProgress => ({
    ...Srs.initialState(),
    studentId: 'st',
    vocabularyItemId: id,
    ...patch,
})

describe('SpacedRepetitionService', () => {
    it('climbs the interval ladder on correct answers and marks word learned', () => {
        let s = Srs.applyAnswer(null, Correct, Forward, NOW)
        expect(s.intervalDays).toBe(1)
        expect(s.status).toBe(WordLearningStatus.Learning)
        s = Srs.applyAnswer(s, Correct, Reverse, NOW)
        expect(s.intervalDays).toBe(3)
        s = Srs.applyAnswer(s, Correct, Forward, NOW)
        expect(s.intervalDays).toBe(LEARNED_INTERVAL_DAYS)
        expect(s.status).toBe(WordLearningStatus.Learned)
        expect([s.forwardCorrect, s.reverseCorrect]).toEqual([2, 1])
    })

    it('caps at 60 days', () => {
        expect(Srs.nextInterval(60)).toBe(60)
        expect(Srs.nextInterval(30)).toBe(60)
    })

    it('reduces the interval after a wrong answer and makes the word due', () => {
        const s = Srs.applyAnswer(progressOf('a', { intervalDays: 30, status: WordLearningStatus.Learned }), Wrong, Reverse, NOW)
        expect(s.intervalDays).toBe(7)
        expect(s.status).toBe(WordLearningStatus.Learning)
        expect(s.reverseWrong).toBe(1)

        const fresh = Srs.applyAnswer(null, Wrong, Forward, NOW)
        expect(fresh.intervalDays).toBe(0)
        expect(Srs.isDue(fresh, NOW)).toBe(true)
    })

    it('does not advance the interval for practice answers', () => {
        const prev = progressOf('a', { intervalDays: 3, status: WordLearningStatus.Learning })
        const s = Srs.applyAnswer(prev, Correct, Forward, NOW, true)
        expect(s.intervalDays).toBe(3)
        expect(s.correctAnswers).toBe(1)
    })
})

describe('DifficultWordsService', () => {
    it('detects difficult words and the weaker direction', () => {
        const p = progressOf('a', { correctAnswers: 3, wrongAnswers: 3, forwardCorrect: 3, reverseWrong: 3 })
        expect(DifficultWordsService.isDifficult(p)).toBe(true)
        expect(DifficultWordsService.weakerDirection(p)).toBe(Reverse)
        expect(DifficultWordsService.isDifficult(progressOf('b', { correctAnswers: 10, wrongAnswers: 2 }))).toBe(false)
    })
})

describe('buildSession', () => {
    const fixedRandom = () => 0.1

    it('takes due words first, then new, then practice', () => {
        const items = ['due', 'new1', 'new2', 'later'].map(id => study(id))
        const progress = new Map<string, WordProgress>([
            ['due', progressOf('due', { status: WordLearningStatus.Learning, intervalDays: 1, nextReviewAt: '2026-10-01T00:00:00Z' })],
            ['later', progressOf('later', { status: WordLearningStatus.Learning, intervalDays: 3, nextReviewAt: '2026-10-09T00:00:00Z' })],
        ])
        const plan = buildSession({ items, progress, size: 3, mode: 'mixed', now: NOW, random: fixedRandom })
        expect(plan.dueCount).toBe(1)
        expect(plan.newCount).toBe(2)
        expect(plan.practiceCount).toBe(0)
        expect(plan.cards.map(c => c.item.id).sort()).toEqual(['due', 'new1', 'new2'])

        const more = buildSession({ items, progress, size: 10, mode: 'mixed', now: NOW, random: fixedRandom })
        expect(more.practiceCount).toBe(1)
        expect(more.cards.find(c => c.item.id === 'later')?.isPractice).toBe(true)
    })

    it('skips locked items and respects maxNew', () => {
        const items = [study('a'), study('b'), study('c', true)]
        const plan = buildSession({ items, progress: new Map(), size: 10, mode: Reverse, now: NOW, maxNew: 1 })
        expect(plan.cards).toHaveLength(1)
        expect(plan.cards[0].direction).toBe(Reverse)
    })

    it('builds a session from explicit item ids (repeat mistakes)', () => {
        const items = ['a', 'b', 'c'].map(id => study(id))
        const plan = buildSession({ items, progress: new Map(), size: 10, mode: 'mixed', itemIds: ['b', 'c'], now: NOW })
        expect(plan.cards.map(c => c.item.id).sort()).toEqual(['b', 'c'])
    })

    it('shows new words forward in mixed mode', () => {
        expect(pickDirection('mixed', undefined, () => 0.99)).toBe(Forward)
    })
})

describe('study material / dosed learning', () => {
    const assignment = (patch: Partial<LearningAssignment>): LearningAssignment => ({
        id: 'as1',
        teacherId: 't',
        wordSetId: 'set-t',
        source: 'teacher',
        status: AssignmentStatus.Active,
        studentIds: ['st'],
        createdAt: NOW.toISOString(),
        ...patch,
    })

    it('unlocks newWordsPerDay for each day since start', () => {
        expect(unlockedCount({ startAt: '2026-10-01', newWordsPerDay: 10 }, 60, NOW)).toBe(20)
        expect(unlockedCount({ startAt: '2026-10-05', newWordsPerDay: 10 }, 60, NOW)).toBe(0)
        expect(unlockedCount({}, 60, NOW)).toBe(60)
    })

    it('merges sources and keeps started words open', () => {
        const entries = ['a', 'b', 'c'].map((id, position) => ({ wordSetId: 'set-t', position, item: item(id) }))
        entries.push({ wordSetId: 'own', position: 0, item: item('c') })
        const result = buildStudyItems({
            ownSetIds: ['own'],
            assignments: [assignment({ startAt: '2026-10-02', newWordsPerDay: 1 })],
            entries,
            startedItemIds: new Set(['b']),
            now: NOW,
        })
        const byId = new Map(result.map(s => [s.item.id, s]))
        expect(byId.get('a')?.locked).toBe(false) // открыто сегодня
        expect(byId.get('b')?.locked).toBe(false) // уже изучается
        expect(byId.get('c')?.locked).toBe(false) // есть в личном наборе
        expect(byId.get('c')?.setIds.sort()).toEqual(['own', 'set-t'])
    })
})
