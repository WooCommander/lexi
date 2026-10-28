import { beforeEach, describe, expect, it } from 'vitest'
import { OfflineAnswerQueue } from './OfflineAnswerQueue'
import { SpacedRepetitionService } from '../lib/SpacedRepetitionService'
import { TrainingDirection, TrainingResult } from '../domain/Training'
import type { AnswerRecord } from './ProgressService'

/** Окружение vitest — node, поэтому localStorage подменяем простым Map. */
const installLocalStorage = () => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, v),
            removeItem: (k: string) => void store.delete(k),
        },
    })
    return store
}

const record = (itemId: string): AnswerRecord => ({
    progress: { ...SpacedRepetitionService.initialState(), studentId: 'st', vocabularyItemId: itemId },
    direction: TrainingDirection.Forward,
    result: TrainingResult.Correct,
    answeredAt: '2026-10-02T10:00:00Z',
})

const ids = () => OfflineAnswerQueue.all().map(r => r.progress.vocabularyItemId)

describe('OfflineAnswerQueue', () => {
    let store: Map<string, string>

    beforeEach(() => {
        store = installLocalStorage()
    })

    it('keeps answers in order and clears storage when empty', async () => {
        OfflineAnswerQueue.push(record('a'))
        OfflineAnswerQueue.push(record('b'))
        expect(ids()).toEqual(['a', 'b'])
        expect(OfflineAnswerQueue.count()).toBe(2)

        const sent: string[] = []
        const count = await OfflineAnswerQueue.flush(async r => void sent.push(r.progress.vocabularyItemId))
        expect(count).toBe(2)
        expect(sent).toEqual(['a', 'b'])
        expect(store.size).toBe(0)
    })

    it('stops at the first failure and keeps the rest in order', async () => {
        ;['a', 'b', 'c'].forEach(id => OfflineAnswerQueue.push(record(id)))
        const count = await OfflineAnswerQueue.flush(async r => {
            if (r.progress.vocabularyItemId === 'b') throw new Error('offline')
        })
        expect(count).toBe(1)
        expect(ids()).toEqual(['b', 'c'])
    })

    it('does not lose an answer recorded while the queue is being sent', async () => {
        OfflineAnswerQueue.push(record('a'))
        OfflineAnswerQueue.push(record('b'))

        await OfflineAnswerQueue.flush(async r => {
            // ученик отвечает на следующую карточку, пока уходит очередь
            if (r.progress.vocabularyItemId === 'a') OfflineAnswerQueue.push(record('late'))
        })

        expect(ids()).toEqual(['late'])
    })

    it('sends each answer once when flush is called concurrently', async () => {
        ;['a', 'b'].forEach(id => OfflineAnswerQueue.push(record(id)))
        const sent: string[] = []
        const send = async (r: AnswerRecord) => {
            await Promise.resolve()
            sent.push(r.progress.vocabularyItemId)
        }
        const [first, second] = await Promise.all([OfflineAnswerQueue.flush(send), OfflineAnswerQueue.flush(send)])
        expect(sent).toEqual(['a', 'b'])
        expect(first).toBe(2)
        expect(second).toBe(2)
        expect(OfflineAnswerQueue.count()).toBe(0)
    })

    it('survives unavailable or corrupted storage', () => {
        store.set('lx_pending_answers', '{not json')
        expect(OfflineAnswerQueue.all()).toEqual([])
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: {
                getItem: () => {
                    throw new Error('blocked')
                },
                setItem: () => {
                    throw new Error('blocked')
                },
                removeItem: () => {
                    throw new Error('blocked')
                },
            },
        })
        expect(() => OfflineAnswerQueue.push(record('a'))).not.toThrow()
        expect(OfflineAnswerQueue.count()).toBe(0)
    })
})
