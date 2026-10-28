import { describe, expect, it } from 'vitest'
import {
    avgLearnedPerStudent,
    avgStudentsPerTeacher,
    isRecent,
    percentText,
    periodAccuracy,
    periodAnswers,
    teacherAccuracy,
    teacherActiveShare,
} from './dashboard'
import { adminUserFromRow, overviewFromRow } from '../domain/Admin'
import { UserRole } from '@/modules/auth/domain/User'

describe('dashboard helpers', () => {
    it('считает точность и ответы за период', () => {
        const days = [
            { day: '2026-10-28', activeUsers: 3, answers: 10, correct: 8 },
            { day: '2026-10-29', activeUsers: 2, answers: 10, correct: 6 },
        ]
        expect(periodAnswers(days)).toBe(20)
        expect(periodAccuracy(days)).toBeCloseTo(0.7)
        expect(periodAccuracy([])).toBeNull()
    })

    it('форматирует проценты и пустые значения', () => {
        expect(percentText(0.843)).toBe('84%')
        expect(percentText(null)).toBe('—')
    })

    it('считает средние по ученикам и учителям', () => {
        expect(avgLearnedPerStudent({ learnedWords: 90, byRole: { student: 30 } })).toBe(3)
        expect(avgLearnedPerStudent({ learnedWords: 5, byRole: {} })).toBe(0)
        expect(avgStudentsPerTeacher([])).toBe(0)
    })

    it('показатели учителя: точность и доля активных учеников', () => {
        expect(teacherAccuracy({ correct: 3, wrong: 1 })).toBe(0.75)
        expect(teacherActiveShare({ students: 4, activeStudents7d: 1 })).toBe(0.25)
        expect(teacherActiveShare({ students: 0, activeStudents7d: 0 })).toBeNull()
    })

    it('isRecent: входил недавно', () => {
        const now = new Date('2026-10-29T12:00:00Z')
        expect(isRecent('2026-10-28T12:00:00Z', 7, now)).toBe(true)
        expect(isRecent('2026-09-01T12:00:00Z', 7, now)).toBe(false)
        expect(isRecent(undefined, 7, now)).toBe(false)
    })
})

describe('мапперы строк', () => {
    it('приводит bigint-строки к числам, а неизвестные роли отбрасывает', () => {
        const overview = overviewFromRow({
            users: '12' as unknown as number,
            by_role: { student: '9' as unknown as number },
            active_7d: 3,
            answers_7d: 40,
            learned_words: 7,
            vocabulary_items: 100,
            word_sets: 5,
            assignments: 2,
            groups: 1,
        })
        expect(overview.users).toBe(12)
        expect(overview.byRole.student).toBe(9)

        const user = adminUserFromRow({
            id: 'u',
            name: 'Аня',
            email: null,
            roles: ['teacher', 'hacker', 'admin'],
            created_at: '2026-10-01T00:00:00Z',
            last_sign_in_at: null,
        })
        expect(user.roles).toEqual([UserRole.Teacher, UserRole.Admin])
        expect(user.email).toBeUndefined()
    })
})
