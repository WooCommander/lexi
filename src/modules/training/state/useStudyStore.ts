import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
    TrainingDirection,
    TrainingResult,
    WordLearningStatus,
    type StudyItem,
    type TrainingCard,
    type WordProgress,
} from '../domain/Training'
import { StudyMaterialService, type StudyMaterial } from '../services/StudyMaterialService'
import { ProgressService, type AnswerRecord } from '../services/ProgressService'
import { FavoriteService } from '../services/FavoriteService'
import { OfflineAnswerQueue } from '../services/OfflineAnswerQueue'
import { buildStudyItems } from '../lib/studyMaterial'
import { SpacedRepetitionService } from '../lib/SpacedRepetitionService'
import { DifficultWordsService } from '../lib/DifficultWordsService'
import { studiedLanguageId } from '@/modules/languages/domain/Language'
import { isLanguageAllowed } from '@/modules/settings/domain/UserSettings'
import { useAuthStore } from '@/modules/auth/state/useAuthStore'
import { useSettingsStore } from '@/modules/settings/state/useSettingsStore'

export interface LanguageSummary {
    languageId: string
    total: number
    newCount: number
    dueCount: number
    difficultCount: number
    learnedCount: number
    lockedCount: number
}

/**
 * Всё, что нужно ученику для занятий: доступные слова, его прогресс, избранное,
 * счётчик дневной цели. Источник правды для экрана «Мои языки» и тренировки.
 */
export const useStudyStore = defineStore('study', () => {
    const material = ref<StudyMaterial | null>(null)
    const progress = ref(new Map<string, WordProgress>())
    const favorites = ref(new Set<string>())
    const todayItemIds = ref(new Set<string>())
    const pendingCount = ref(OfflineAnswerQueue.count())
    const isLoading = ref(false)
    const loadedFor = ref<string | null>(null)
    const error = ref<string | null>(null)

    const nativeLanguageId = computed(() => useSettingsStore().settings?.nativeLanguageId ?? null)

    const studyItems = computed<StudyItem[]>(() => {
        if (!material.value) return []
        const settings = useSettingsStore().settings
        return buildStudyItems({
            ownSetIds: material.value.ownSets.map(s => s.id),
            assignments: material.value.assignments,
            entries: material.value.entries,
            startedItemIds: new Set(progress.value.keys()),
            now: new Date(),
        }).filter(s => isLanguageAllowed(settings, languageOf(s)))
    })

    const allSets = computed(() => (material.value ? [...material.value.ownSets, ...material.value.assignedSets] : []))

    function languageOf(study: StudyItem) {
        return studiedLanguageId(study.item, nativeLanguageId.value)
    }

    const itemsForLanguage = (languageId: string) => studyItems.value.filter(s => languageOf(s) === languageId)

    const summarize = (languageId: string, items: StudyItem[]): LanguageSummary => {
        const now = new Date()
        const summary: LanguageSummary = {
            languageId,
            total: items.length,
            newCount: 0,
            dueCount: 0,
            difficultCount: 0,
            learnedCount: 0,
            lockedCount: 0,
        }
        for (const s of items) {
            if (s.locked) {
                summary.lockedCount++
                continue
            }
            const p = progress.value.get(s.item.id)
            if (!p || p.status === WordLearningStatus.New) summary.newCount++
            else if (SpacedRepetitionService.isDue(p, now)) summary.dueCount++
            if (p?.status === WordLearningStatus.Learned) summary.learnedCount++
            if (DifficultWordsService.isDifficult(p)) summary.difficultCount++
        }
        return summary
    }

    const languageSummaries = computed<LanguageSummary[]>(() => {
        const groups = new Map<string, StudyItem[]>()
        for (const s of studyItems.value) {
            const id = languageOf(s)
            const list = groups.get(id) ?? []
            list.push(s)
            groups.set(id, list)
        }
        return [...groups.entries()].map(([id, items]) => summarize(id, items))
    })

    const summaryFor = (languageId: string) => summarize(languageId, itemsForLanguage(languageId))

    const difficultItems = (languageId?: string) =>
        DifficultWordsService.rank(
            (languageId ? itemsForLanguage(languageId) : studyItems.value)
                .map(s => ({ study: s, progress: progress.value.get(s.item.id)! }))
                .filter(e => !!e.progress),
        )

    const todayCount = computed(() => todayItemIds.value.size)
    const todayCountFor = (languageId: string) =>
        itemsForLanguage(languageId).filter(s => todayItemIds.value.has(s.item.id)).length

    const flushPending = async () => {
        if (!OfflineAnswerQueue.count()) return 0
        const sent = await OfflineAnswerQueue.flush(ProgressService.saveAnswer)
        pendingCount.value = OfflineAnswerQueue.count()
        return sent
    }

    const load = async (force = false) => {
        const auth = useAuthStore()
        const studentId = auth.userId
        if (!studentId) return
        if (!force && loadedFor.value === studentId) return
        isLoading.value = true
        error.value = null
        try {
            await useSettingsStore().load()
            await flushPending()
            const [m, p, fav, today] = await Promise.all([
                StudyMaterialService.load(studentId),
                ProgressService.fetchForStudents([studentId]),
                FavoriteService.fetchIds(studentId),
                ProgressService.fetchTodayItemIds(studentId),
            ])
            material.value = m
            progress.value = new Map(p.map(x => [x.vocabularyItemId, x]))
            // ответы из офлайн-очереди новее серверных
            for (const record of OfflineAnswerQueue.all()) {
                progress.value.set(record.progress.vocabularyItemId, record.progress)
                today.push(record.progress.vocabularyItemId)
            }
            favorites.value = new Set(fav)
            todayItemIds.value = new Set(today)
            loadedFor.value = studentId
        } catch (e) {
            console.error('Study material load failed:', e)
            error.value = 'Не удалось загрузить слова'
        } finally {
            isLoading.value = false
        }
    }

    /** Применяет SRS локально сразу, отправляет на сервер в фоне (с офлайн-очередью). */
    const recordAnswer = async (card: TrainingCard, result: TrainingResult) => {
        const auth = useAuthStore()
        if (!auth.userId) return
        const prev = progress.value.get(card.item.id)
        const now = new Date()
        const next: WordProgress = {
            ...SpacedRepetitionService.applyAnswer(prev, result, card.direction, now, card.isPractice),
            id: prev?.id,
            studentId: auth.userId,
            vocabularyItemId: card.item.id,
        }
        progress.value.set(card.item.id, next)
        todayItemIds.value.add(card.item.id)

        const record: AnswerRecord = {
            progress: next,
            direction: card.direction,
            result,
            assignmentId: card.assignmentId,
            answeredAt: now.toISOString(),
        }
        try {
            if (OfflineAnswerQueue.count()) throw new Error('queue not empty')
            await ProgressService.saveAnswer(record)
        } catch {
            OfflineAnswerQueue.push(record)
            pendingCount.value = OfflineAnswerQueue.count()
        }
    }

    const toggleFavorite = async (itemId: string) => {
        const auth = useAuthStore()
        if (!auth.userId) return
        const had = favorites.value.has(itemId)
        if (had) favorites.value.delete(itemId)
        else favorites.value.add(itemId)
        try {
            if (had) await FavoriteService.remove(auth.userId, itemId)
            else await FavoriteService.add(auth.userId, itemId)
        } catch (e) {
            // откат оптимистичного изменения
            if (had) favorites.value.add(itemId)
            else favorites.value.delete(itemId)
            throw e
        }
    }

    const directionAccuracy = (itemId: string, direction: TrainingDirection) => {
        const p = progress.value.get(itemId)
        if (!p) return null
        const [c, w] = direction === TrainingDirection.Forward ? [p.forwardCorrect, p.forwardWrong] : [p.reverseCorrect, p.reverseWrong]
        return c + w > 0 ? c / (c + w) : null
    }

    const reset = () => {
        material.value = null
        progress.value = new Map()
        favorites.value = new Set()
        todayItemIds.value = new Set()
        loadedFor.value = null
    }

    return {
        material,
        progress,
        favorites,
        pendingCount,
        isLoading,
        error,
        studyItems,
        allSets,
        nativeLanguageId,
        languageSummaries,
        todayCount,
        languageOf,
        itemsForLanguage,
        summaryFor,
        difficultItems,
        todayCountFor,
        load,
        flushPending,
        recordAnswer,
        toggleFavorite,
        directionAccuracy,
        reset,
    }
})
