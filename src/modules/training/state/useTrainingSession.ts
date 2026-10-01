import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { TrainingResult, type TrainingCard, type TrainingMode } from '../domain/Training'
import { buildSession, requeuePosition } from '../lib/sessionBuilder'
import { useStudyStore } from './useStudyStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'

export interface SessionConfig {
    languageId: string
    size: number
    mode: TrainingMode
    /** Явный список слов: повтор ошибок / сложные / избранное. */
    itemIds?: string[]
}

/** Сколько раз неверную карточку возвращаем в текущую тренировку. */
const MAX_REQUEUE = 2

/**
 * Состояние одной тренировки. Логика выбора слов и интервалов — в lib/,
 * здесь только очередь карточек и учёт ответов.
 */
export const useTrainingSession = defineStore('trainingSession', () => {
    const config = ref<SessionConfig | null>(null)
    const queue = ref<TrainingCard[]>([])
    const index = ref(0)
    const revealed = ref(false)
    /** Первый ответ по каждому слову — для итогов «Знаю / Не знаю». */
    const firstResults = ref(new Map<string, TrainingResult>())
    const doneItemIds = ref(new Set<string>())
    const requeues = ref(new Map<string, number>())
    const status = ref<'idle' | 'active' | 'finished'>('idle')

    const current = computed(() => queue.value[index.value] ?? null)
    /** «4 / 10»: считаем слова, а не карточки — повторы после ошибки не раздувают итог. */
    const total = computed(() => new Set(queue.value.map(c => c.item.id)).size)
    const answered = computed(() => doneItemIds.value.size)
    const isRetry = computed(() => !!current.value && firstResults.value.has(current.value.item.id))

    const knownCount = computed(() => [...firstResults.value.values()].filter(r => r === TrainingResult.Correct).length)
    const unknownCount = computed(() => firstResults.value.size - knownCount.value)
    const mistakeItemIds = computed(() =>
        [...firstResults.value.entries()].filter(([, r]) => r !== TrainingResult.Correct).map(([id]) => id),
    )
    const accuracyPercent = computed(() =>
        firstResults.value.size ? Math.round((knownCount.value / firstResults.value.size) * 100) : 0,
    )

    const start = (next: SessionConfig): number => {
        const study = useStudyStore()
        const settings = useSettingsStore()
        const goalLeft = Math.max(0, settings.goalFor(next.languageId) - study.todayCountFor(next.languageId))
        const plan = buildSession({
            items: study.itemsForLanguage(next.languageId),
            progress: study.progress,
            size: next.size,
            mode: next.mode,
            itemIds: next.itemIds,
            // новые слова — в пределах дневной цели, но хотя бы половина тренировки
            maxNew: Math.max(goalLeft, Math.ceil(next.size / 2)),
        })
        config.value = next
        queue.value = plan.cards
        index.value = 0
        revealed.value = false
        firstResults.value = new Map()
        doneItemIds.value = new Set()
        requeues.value = new Map()
        status.value = plan.cards.length ? 'active' : 'idle'
        return plan.cards.length
    }

    const reveal = () => {
        revealed.value = true
    }

    const answer = (result: TrainingResult) => {
        const card = current.value
        if (!card || !revealed.value) return
        const study = useStudyStore()
        void study.recordAnswer(card, result)

        const id = card.item.id
        if (!firstResults.value.has(id)) firstResults.value.set(id, result)

        const times = requeues.value.get(id) ?? 0
        if (result !== TrainingResult.Correct && times < MAX_REQUEUE) {
            // вернуть слово в текущую тренировку чуть позже, в том же направлении
            requeues.value.set(id, times + 1)
            const retry: TrainingCard = { ...card, key: `${card.key}:r${times + 1}`, isPractice: false }
            queue.value.splice(requeuePosition(index.value, queue.value.length), 0, retry)
        } else {
            doneItemIds.value.add(id)
        }

        revealed.value = false
        index.value++
        if (index.value >= queue.value.length) status.value = 'finished'
    }

    const repeatMistakes = () => {
        if (!config.value || !mistakeItemIds.value.length) return 0
        return start({ ...config.value, itemIds: mistakeItemIds.value, size: mistakeItemIds.value.length })
    }

    const moreWords = () => {
        if (!config.value) return 0
        return start({ ...config.value, itemIds: undefined })
    }

    const finishEarly = () => {
        status.value = firstResults.value.size ? 'finished' : 'idle'
    }

    return {
        config,
        queue,
        index,
        revealed,
        status,
        current,
        total,
        answered,
        isRetry,
        knownCount,
        unknownCount,
        mistakeItemIds,
        accuracyPercent,
        start,
        reveal,
        answer,
        repeatMistakes,
        moreWords,
        finishEarly,
    }
})
