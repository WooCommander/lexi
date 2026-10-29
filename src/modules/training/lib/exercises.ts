import { TrainingDirection, TrainingResult, type TrainingCard } from '../domain/Training'
import type { VocabularyItem } from '@/modules/vocabulary/domain/VocabularyItem'
import { shuffle, type RandomFn } from '@/shared/lib/random'

/**
 * Упражнения поверх карточек: выбор перевода и ввод слова.
 * Чистая логика без Vue и без привязки к языку.
 */

/** Сколько вариантов показываем в «Выбери перевод» (правильный + отвлекающие). */
export const CHOICE_OPTIONS = 4

/** Минимум отвлекающих вариантов; иначе упражнение вырождается — показываем карточку. */
const MIN_DISTRACTORS = 2

/** Сторона слова, которая служит вопросом / ответом для данного направления. */
export const questionText = (item: VocabularyItem, direction: TrainingDirection): string =>
    direction === TrainingDirection.Forward ? item.sourceText : item.targetText

export const answerText = (item: VocabularyItem, direction: TrainingDirection): string =>
    direction === TrainingDirection.Forward ? item.targetText : item.sourceText

const answerLanguage = (item: VocabularyItem, direction: TrainingDirection): string =>
    direction === TrainingDirection.Forward ? item.targetLanguageId : item.sourceLanguageId

/**
 * Нижний регистр, без диакритики у латиницы (ă → a, ș → s), ё → е, без знаков препинания, пробелы схлопнуты.
 * У кириллицы диакритику не снимаем: й ≠ и, ї ≠ і — в украинском это разные буквы и разные слова.
 */
export const fold = (text: string): string =>
    text
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\p{Script=Latin}/gu, ch => ch.normalize('NFD').replace(/\p{M}/gu, ''))
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()

/** Точное совпадение (с диакритикой): отличает «exact» от «close», где диакритика пропущена. */
const exactNormalize = (text: string): string =>
    text.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?]+$/u, '')

/** Правильный ответ может содержать несколько вариантов: «яблоко, плод» / «a; b». */
export const answerVariants = (answer: string): string[] => {
    const parts = answer
        .split(/[;,/|]/)
        .map(p => p.trim())
        .filter(Boolean)
    // сам ответ целиком тоже принимаем: «to be, being» набранное полностью
    return [...new Set([answer.trim(), ...parts])]
}

const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
        const row = [i]
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
        }
        prev = row
    }
    return prev[b.length]
}

export type TypedVerdict = 'exact' | 'close' | 'typo' | 'wrong'

/**
 * exact — совпало; close — отличается только регистром/диакритикой/пунктуацией (засчитываем);
 * typo — одна опечатка в слове от 5 букв («почти»); wrong — неверно.
 */
export const checkTypedAnswer = (input: string, answer: string): TypedVerdict => {
    const typed = input.trim()
    if (!fold(typed)) return 'wrong'
    const variants = answerVariants(answer)
    if (variants.some(v => exactNormalize(v) === exactNormalize(typed))) return 'exact'
    const foldedTyped = fold(typed)
    if (variants.some(v => fold(v) === foldedTyped)) return 'close'
    if (variants.some(v => fold(v).length >= 5 && levenshtein(fold(v), foldedTyped) === 1)) return 'typo'
    return 'wrong'
}

/** Вердикт → результат ответа. Опечатка — «Сомневаюсь»: слово почти знакомо, повторим скоро. */
export const verdictToResult = (verdict: TypedVerdict): TrainingResult => {
    if (verdict === 'exact' || verdict === 'close') return TrainingResult.Correct
    return verdict === 'typo' ? TrainingResult.Unsure : TrainingResult.Wrong
}

export interface ChoiceSet {
    options: string[]
    correctIndex: number
}

/**
 * Варианты ответа для карточки. Отвлекающие берутся из слов того же языка ответа,
 * без повторов и без совпадения с правильным ответом. null — слов не хватает.
 */
export const buildChoiceSet = (
    card: Pick<TrainingCard, 'item' | 'direction'>,
    pool: readonly VocabularyItem[],
    random: RandomFn = Math.random,
    optionCount = CHOICE_OPTIONS,
): ChoiceSet | null => {
    const { item, direction } = card
    const correct = answerText(item, direction)
    const language = answerLanguage(item, direction)
    const taken = new Set(answerVariants(correct).map(fold))

    const distractors: string[] = []
    for (const candidate of shuffle(pool, random)) {
        if (candidate.id === item.id || answerLanguage(candidate, direction) !== language) continue
        const text = answerText(candidate, direction)
        const key = fold(text)
        if (!key || taken.has(key)) continue
        taken.add(key)
        distractors.push(text)
        if (distractors.length === optionCount - 1) break
    }
    if (distractors.length < MIN_DISTRACTORS) return null

    const options = shuffle([correct, ...distractors], random)
    return { options, correctIndex: options.indexOf(correct) }
}
