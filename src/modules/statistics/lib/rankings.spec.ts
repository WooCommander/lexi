import { describe, expect, it } from 'vitest'
import { bestKnownWords, daysSince, groupRows, inactiveStudents, rankStudents, type StudentMetrics } from './rankings'

const NOW = new Date('2026-10-29T12:00:00Z')

const student = (id: string, patch: Partial<StudentMetrics> = {}): StudentMetrics => ({
    studentId: id,
    name: id,
    learned: 0,
    total: 10,
    correct: 0,
    wrong: 0,
    activeDays: 0,
    streak: 0,
    ...patch,
})

describe('rankStudents', () => {
    it('puts the student with the most learned words first, then by accuracy and answers', () => {
        const ranked = rankStudents([
            student('b', { learned: 5, correct: 5, wrong: 5 }),
            student('a', { learned: 8 }),
            student('c', { learned: 5, correct: 9, wrong: 1 }),
        ])
        expect(ranked.map(r => r.studentId)).toEqual(['a', 'c', 'b'])
        expect(ranked.map(r => r.rank)).toEqual([1, 2, 3])
    })

    it('gives tied students the same place and skips the next one', () => {
        const ranked = rankStudents([student('a', { learned: 4 }), student('b', { learned: 4 }), student('c', { learned: 1 })])
        expect(ranked.map(r => r.rank)).toEqual([1, 1, 3])
    })

    it('handles an empty class', () => {
        expect(rankStudents([])).toEqual([])
    })
})

describe('groupRows', () => {
    const metrics = [
        student('s1', { learned: 10, correct: 8, wrong: 2, lastActiveAt: '2026-10-28T10:00:00Z' }),
        student('s2', { learned: 2, correct: 1, wrong: 1, lastActiveAt: '2026-10-01T10:00:00Z' }),
        student('s3', { learned: 6, correct: 6, wrong: 0, lastActiveAt: '2026-10-29T08:00:00Z' }),
        student('s4', { learned: 1 }),
    ]

    it('compares groups by average learned words per student and counts active share', () => {
        const rows = groupRows(
            [
                { id: 'g1', name: '6А', studentIds: ['s1', 's2'] },
                { id: 'g2', name: '6Б', studentIds: ['s3'] },
            ],
            metrics,
            NOW,
        )
        expect(rows.map(r => r.name)).toEqual(['6Б', '6А', 'Без группы'])
        const a = rows.find(r => r.id === 'g1')!
        expect(a.avgLearned).toBe(6)
        expect(a.accuracy).toBeCloseTo(0.75)
        expect(a.activeShare).toBe(0.5) // s1 занимался вчера, s2 — 4 недели назад
        expect(rows.find(r => r.id === 'no-group')!.students).toBe(1)
    })

    it('skips groups whose students are not in the current filter', () => {
        expect(groupRows([{ id: 'g', name: 'Пустая', studentIds: ['zzz'] }], [], NOW)).toEqual([])
    })
})

describe('inactiveStudents', () => {
    it('lists students silent for a week or more, the longest first; never active counts as inactive', () => {
        const list = inactiveStudents(
            [
                student('fresh', { lastActiveAt: '2026-10-29T08:00:00Z' }),
                student('week', { lastActiveAt: '2026-10-20T08:00:00Z' }),
                student('never'),
            ],
            NOW,
        )
        expect(list.map(s => s.studentId)).toEqual(['never', 'week'])
        expect(list[0].daysAgo).toBe(Infinity)
        expect(list[1].daysAgo).toBe(9)
    })

    it('daysSince measures full days', () => {
        expect(daysSince('2026-10-29T08:00:00Z', NOW)).toBe(0)
        expect(daysSince(undefined, NOW)).toBe(Infinity)
    })
})

describe('bestKnownWords', () => {
    it('orders by how many students learned the word and ignores words with too few answers', () => {
        const top = bestKnownWords([
            { itemId: 'a', learnedBy: 2, students: 3, correct: 6, wrong: 0 },
            { itemId: 'b', learnedBy: 3, students: 3, correct: 8, wrong: 2 },
            { itemId: 'c', learnedBy: 3, students: 3, correct: 9, wrong: 1 },
            { itemId: 'rare', learnedBy: 1, students: 1, correct: 1, wrong: 0 },
            { itemId: 'none', learnedBy: 0, students: 2, correct: 5, wrong: 5 },
        ])
        expect(top.map(w => w.itemId)).toEqual(['c', 'b', 'a'])
    })
})
