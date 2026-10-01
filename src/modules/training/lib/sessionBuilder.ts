import {
    TrainingDirection,
    WordLearningStatus,
    type StudyItem,
    type TrainingCard,
    type TrainingMode,
    type WordProgress,
} from '../domain/Training'
import { SpacedRepetitionService } from './SpacedRepetitionService'
import { DifficultWordsService } from './DifficultWordsService'
import { shuffle, type RandomFn } from '@/shared/lib/random'

export interface BuildSessionInput {
    items: StudyItem[]
    progress: ReadonlyMap<string, WordProgress>
    size: number
    mode: TrainingMode
    now?: Date
    random?: RandomFn
    /** Явный список слов — «Повторить ошибки», «Сложные слова». */
    itemIds?: string[]
    /** Сколько новых слов можно взять в эту тренировку (дневная цель). */
    maxNew?: number
}

export interface SessionPlan {
    cards: TrainingCard[]
    dueCount: number
    newCount: number
    practiceCount: number
}

let cardSeq = 0

export const makeCard = (study: StudyItem, direction: TrainingDirection, isPractice: boolean): TrainingCard => ({
    key: `${study.item.id}:${direction}:${++cardSeq}`,
    item: study.item,
    direction,
    assignmentId: study.assignmentId,
    isPractice,
})

/**
 * Смешанный режим: новое слово сначала показываем в прямом направлении (узнавание проще),
 * дальше в 70% случаев — в более слабом направлении, иначе случайно.
 */
export const pickDirection = (mode: TrainingMode, progress: WordProgress | undefined, random: RandomFn): TrainingDirection => {
    if (mode !== 'mixed') return mode
    if (!progress || progress.status === WordLearningStatus.New) return TrainingDirection.Forward
    const weaker = DifficultWordsService.weakerDirection(progress)
    if (weaker && random() < 0.7) return weaker
    return random() < 0.5 ? TrainingDirection.Forward : TrainingDirection.Reverse
}

/**
 * План тренировки:
 *   1. слова к повторению (сложные и просроченные — первыми);
 *   2. новые слова в порядке набора;
 *   3. если не хватает — «практика» уже изучаемых слов (без продвижения интервала).
 */
export const buildSession = (input: BuildSessionInput): SessionPlan => {
    const { items, progress, size, mode } = input
    const now = input.now ?? new Date()
    const random = input.random ?? Math.random

    if (input.itemIds?.length) {
        const wanted = new Set(input.itemIds)
        const picked = items.filter(s => wanted.has(s.item.id))
        const cards = shuffle(picked, random).map(s => {
            const p = progress.get(s.item.id)
            return makeCard(s, pickDirection(mode, p, random), !SpacedRepetitionService.isDue(p, now))
        })
        return { cards, dueCount: 0, newCount: 0, practiceCount: cards.length }
    }

    const open = items.filter(s => !s.locked)
    const due: StudyItem[] = []
    const fresh: StudyItem[] = []
    const practice: StudyItem[] = []

    for (const study of open) {
        const p = progress.get(study.item.id)
        if (!p || p.status === WordLearningStatus.New) fresh.push(study)
        else if (SpacedRepetitionService.isDue(p, now)) due.push(study)
        else practice.push(study)
    }

    const byPriority = (a: StudyItem, b: StudyItem) =>
        DifficultWordsService.priority(progress.get(b.item.id), now) -
        DifficultWordsService.priority(progress.get(a.item.id), now)

    due.sort(byPriority)
    practice.sort(byPriority)

    const pickedDue = due.slice(0, size)
    const newLimit = Math.max(0, Math.min(size - pickedDue.length, input.maxNew ?? Infinity))
    const pickedNew = fresh.slice(0, newLimit)
    const pickedPractice = practice.slice(0, Math.max(0, size - pickedDue.length - pickedNew.length))

    const cards = shuffle(
        [
            ...pickedDue.map(s => makeCard(s, pickDirection(mode, progress.get(s.item.id), random), false)),
            ...pickedNew.map(s => makeCard(s, pickDirection(mode, progress.get(s.item.id), random), false)),
            ...pickedPractice.map(s => makeCard(s, pickDirection(mode, progress.get(s.item.id), random), true)),
        ],
        random,
    )

    return {
        cards,
        dueCount: pickedDue.length,
        newCount: pickedNew.length,
        practiceCount: pickedPractice.length,
    }
}

/** Куда вернуть карточку после ошибки: через 3 карточки, но не дальше конца очереди. */
export const requeuePosition = (currentIndex: number, queueLength: number): number =>
    Math.min(queueLength, currentIndex + 4)
