import type { StudyItem } from '../domain/Training'
import type { LearningAssignment } from '@/modules/assignments/domain/Assignment'
import { AssignmentStatus } from '@/modules/assignments/domain/Assignment'
import type { WordSetEntry } from '@/modules/word-sets/domain/WordSet'
import { daysBetween, parseISODate } from '@/shared/lib/dates'

/**
 * Сколько новых слов задания уже «открыто» на сегодня.
 * Дозированное изучение: newWordsPerDay × (дней с начала + 1).
 * Слова предыдущих дней остаются в интервальном повторении.
 */
export const unlockedCount = (assignment: Pick<LearningAssignment, 'startAt' | 'newWordsPerDay'>, total: number, now: Date): number => {
    const start = assignment.startAt ? parseISODate(assignment.startAt) : null
    if (start && daysBetween(start, now) < 0) return 0
    if (!assignment.newWordsPerDay) return total
    const days = start ? daysBetween(start, now) + 1 : 1
    return Math.min(total, assignment.newWordsPerDay * days)
}

export interface StudyMaterialInput {
    ownSetIds: string[]
    assignments: LearningAssignment[]
    entries: WordSetEntry[]
    /** id слов, по которым у ученика уже есть прогресс — они не блокируются. */
    startedItemIds: Set<string>
    now: Date
}

/**
 * Собирает список слов ученика из личных наборов и активных заданий.
 * Одно слово может прийти из нескольких наборов — оно будет одно, с объединёнными источниками.
 */
export const buildStudyItems = ({ ownSetIds, assignments, entries, startedItemIds, now }: StudyMaterialInput): StudyItem[] => {
    const entriesBySet = new Map<string, WordSetEntry[]>()
    for (const entry of entries) {
        const list = entriesBySet.get(entry.wordSetId) ?? []
        list.push(entry)
        entriesBySet.set(entry.wordSetId, list)
    }
    for (const list of entriesBySet.values()) list.sort((a, b) => a.position - b.position)

    const result = new Map<string, StudyItem>()

    const add = (entry: WordSetEntry, locked: boolean, assignmentId?: string) => {
        const existing = result.get(entry.item.id)
        if (!existing) {
            result.set(entry.item.id, { item: entry.item, setIds: [entry.wordSetId], assignmentId, locked })
            return
        }
        if (!existing.setIds.includes(entry.wordSetId)) existing.setIds.push(entry.wordSetId)
        // открыто хотя бы одним источником — значит открыто
        if (existing.locked && !locked) {
            existing.locked = false
            existing.assignmentId = assignmentId ?? existing.assignmentId
        }
        existing.assignmentId ??= assignmentId
    }

    for (const setId of ownSetIds) {
        for (const entry of entriesBySet.get(setId) ?? []) add(entry, false)
    }

    for (const assignment of assignments) {
        if (assignment.status !== AssignmentStatus.Active) continue
        const list = entriesBySet.get(assignment.wordSetId) ?? []
        const open = unlockedCount(assignment, list.length, now)
        list.forEach((entry, index) => {
            const locked = index >= open && !startedItemIds.has(entry.item.id)
            add(entry, locked, assignment.id)
        })
    }

    return [...result.values()]
}
