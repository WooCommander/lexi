import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { TrainingDirection, TrainingResult, type StudyItem, type TrainingCard } from '../domain/Training'
import type { VocabularyItem } from '@/modules/vocabulary/domain/VocabularyItem'

const recordAnswer = vi.fn()
let studyItems: StudyItem[] = []

// Стор тренировки не должен знать про Supabase: подменяем зависимости целиком.
vi.mock('./useStudyStore', () => ({
    useStudyStore: () => ({
        itemsForLanguage: () => studyItems,
        progress: new Map(),
        todayCountFor: () => 0,
        recordAnswer,
    }),
}))
vi.mock('@/modules/settings/state/useSettingsStore', () => ({
    useSettingsStore: () => ({ goalFor: () => 10 }),
}))

const { useTrainingSession } = await import('./useTrainingSession')

const study = (id: string): StudyItem => {
    const item: VocabularyItem = {
        id,
        sourceLanguageId: 'en',
        targetLanguageId: 'ru',
        sourceText: `w-${id}`,
        targetText: `t-${id}`,
        createdBy: 'u',
        createdAt: '2026-10-02T00:00:00Z',
    }
    return { item, setIds: ['s'], locked: false }
}

const { Correct, Wrong, Unsure } = TrainingResult

describe('useTrainingSession', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        recordAnswer.mockReset()
        studyItems = ['a', 'b', 'c'].map(study)
    })

    const begin = (extra: Partial<Parameters<ReturnType<typeof useTrainingSession>['start']>[0]> = {}) => {
        const session = useTrainingSession()
        const count = session.start({ languageId: 'en', size: 10, mode: TrainingDirection.Forward, ...extra })
        return { session, count }
    }

    /** Ответить на текущую карточку (как это делает экран: сначала раскрыть). */
    const respond = (session: ReturnType<typeof useTrainingSession>, result: TrainingResult) => {
        session.reveal()
        session.answer(result)
    }

    it('builds a queue and defaults to the cards exercise', () => {
        const { session, count } = begin()
        expect(count).toBe(3)
        expect(session.status).toBe('active')
        expect(session.exercise).toBe('cards')
        expect(session.total).toBe(3)
        expect(begin({ exercise: 'typing' }).session.exercise).toBe('typing')
    })

    it('stays idle when there is nothing to study', () => {
        studyItems = []
        const { session, count } = begin()
        expect(count).toBe(0)
        expect(session.status).toBe('idle')
    })

    it('ignores an answer given before the card was revealed', () => {
        const { session } = begin()
        session.answer(Correct)
        expect(recordAnswer).not.toHaveBeenCalled()
        expect(session.index).toBe(0)
    })

    it('finishes after all correct answers and counts results by first attempt', () => {
        const { session } = begin()
        respond(session, Correct)
        respond(session, Unsure)
        respond(session, Wrong)

        expect(recordAnswer).toHaveBeenCalledTimes(3)
        expect(session.knownCount).toBe(1)
        expect(session.unsureCount).toBe(1)
        expect(session.unknownCount).toBe(1)
        expect(session.accuracyPercent).toBe(33)
        expect(session.mistakeItemIds).toHaveLength(2)
    })

    it('returns a wrong card to the queue at most twice, then moves on', () => {
        studyItems = [study('a')]
        const { session } = begin()
        const id = 'a'

        respond(session, Wrong) // 1-я попытка → повтор
        expect(session.status).toBe('active')
        expect(session.isRetry).toBe(true)
        respond(session, Wrong) // 2-я → ещё повтор
        expect(session.status).toBe('active')
        respond(session, Wrong) // 3-я → лимит возвратов исчерпан

        expect(session.status).toBe('finished')
        expect(recordAnswer).toHaveBeenCalledTimes(3)
        // в итогах слово считается один раз — по первому ответу
        expect(session.unknownCount).toBe(1)
        expect(session.answered).toBe(1)
        expect(session.mistakeItemIds).toEqual([id])
    })

    it('a correct retry does not rewrite the first result', () => {
        studyItems = [study('a')]
        const { session } = begin()
        respond(session, Wrong)
        respond(session, Correct)
        expect(session.status).toBe('finished')
        expect(session.knownCount).toBe(0)
        expect(session.unknownCount).toBe(1)
    })

    it('unsure answers also come back for another try', () => {
        studyItems = [study('a')]
        const { session } = begin()
        respond(session, Unsure)
        expect(session.status).toBe('active')
        expect(session.isRetry).toBe(true)
    })

    it('repeatMistakes starts a session with only the missed words and keeps the exercise', () => {
        const { session } = begin({ exercise: 'choice' })
        const answers = [Correct, Wrong, Correct]
        answers.forEach(r => respond(session, r))
        expect(session.status).toBe('active') // ошибочная карточка вернулась в очередь
        respond(session, Correct)
        expect(session.status).toBe('finished')

        const missed = session.mistakeItemIds
        expect(missed).toHaveLength(1)
        expect(session.repeatMistakes()).toBe(1)
        expect(session.exercise).toBe('choice')
        expect(session.queue.map((c: TrainingCard) => c.item.id)).toEqual(missed)
        expect(session.knownCount + session.unknownCount).toBe(0) // итоги новой тренировки обнулены
    })

    it('«Ещё N слов» после повтора ошибок возвращается к выбранному размеру', () => {
        studyItems = ['a', 'b', 'c', 'd', 'e'].map(study)
        const { session } = begin({ size: 5 })
        // отвечаем на всё, одно слово — с ошибкой (после ошибки оно вернётся в очередь ещё дважды)
        let guard = 0
        while (session.status === 'active' && guard++ < 30) respond(session, session.queue[session.index].item.id === 'a' ? Wrong : Correct)
        expect(session.repeatMistakes()).toBe(1)
        expect(session.config?.size).toBe(1)
        expect(session.config?.baseSize).toBe(5)
        session.moreWords()
        expect(session.config?.size).toBe(5)
    })

    it('reset очищает тренировку прежнего пользователя', () => {
        const { session } = begin()
        respond(session, Correct)
        session.reset()
        expect(session.status).toBe('idle')
        expect(session.queue).toEqual([])
        expect(session.config).toBeNull()
        expect(session.knownCount).toBe(0)
    })

    it('finishEarly with no answers goes back to idle, with answers shows results', () => {
        const first = begin()
        first.session.finishEarly()
        expect(first.session.status).toBe('idle')

        const second = begin()
        respond(second.session, Correct)
        second.session.finishEarly()
        expect(second.session.status).toBe('finished')
    })
})
