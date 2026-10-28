import type { VocabularyItemInput } from '../domain/VocabularyItem'
import { TOPICS, parseTopicLines, type GradeBand, type TopicId, type TopicWords } from './catalog/topics'
import { EN_WORDS } from './catalog/en'
import { RO_WORDS } from './catalog/ro'
import { UK_WORDS } from './catalog/uk'
import { ukrainianReading } from './catalog/ukReading'

/**
 * Готовые наборы: язык × тема. Язык задаётся кодами, а не полями — каталог не привязан к английскому.
 * Все наборы идут «изучаемый язык → русский».
 */
export interface StarterSet {
    id: string
    sourceCode: string
    targetCode: string
    name: string
    topicId: TopicId
    topicTitle: string
    grades: GradeBand
    words: VocabularyItemInput[]
}

export interface CatalogLanguage {
    code: string
    /** Название на самом языке — по нему узнаёт его ученик и так называются наборы. */
    title: string
    words: TopicWords
    /**
     * Своё правило чтения вместо поля из словаря. Нужно, когда оно механическое (украинский):
     * так чтение одинаково у всех слов, а не зависит от того, не забыл ли его автор.
     */
    reading?: (word: string) => string | undefined
}

export const CATALOG_LANGUAGES: CatalogLanguage[] = [
    { code: 'en', title: 'English', words: EN_WORDS },
    { code: 'ro', title: 'Română', words: RO_WORDS },
    { code: 'uk', title: 'Українська', words: UK_WORDS, reading: ukrainianReading },
]

export const CATALOG_TARGET_CODE = 'ru'

export const STARTER_SETS: StarterSet[] = CATALOG_LANGUAGES.flatMap(language =>
    TOPICS.map(topic => ({
        id: `${language.code}-${topic.id}`,
        sourceCode: language.code,
        targetCode: CATALOG_TARGET_CODE,
        name: `${language.title} — ${topic.title}`,
        topicId: topic.id,
        topicTitle: topic.title,
        grades: topic.grades,
        words: parseTopicLines(language.words[topic.id] ?? '').map(word =>
            language.reading ? { ...word, sourceReading: language.reading(word.sourceText) } : word,
        ),
    })),
).filter(set => set.words.length > 0)
