import type { VocabularyItemInput } from '../domain/VocabularyItem'

/** Стартовые наборы для ученика без учителя: язык задаётся кодами, а не полями. */
export interface StarterSet {
    sourceCode: string
    targetCode: string
    name: string
    words: VocabularyItemInput[]
}

const w = (sourceText: string, targetText: string, sourceTranscription?: string, exampleSource?: string, exampleTarget?: string): VocabularyItemInput => ({
    sourceText,
    targetText,
    sourceTranscription,
    exampleSource,
    exampleTarget,
})

/** Как читается слово русскими буквами — по исходному слову. Приблизительно, для первых шагов. */
const READINGS: Record<string, string> = {
    // English
    apple: 'эпл', dog: 'дог', cat: 'кэт', house: 'хаус', school: 'скул', book: 'бук', friend: 'фрэнд',
    family: 'фэмили', water: 'уотэ', beautiful: 'бьютифул', because: 'бикоз', through: 'сру', thought: 'сот',
    teacher: 'тичэ', window: 'уиндоу',
    // Română
    măr: 'мэр', câine: 'кынэ', pisică: 'писикэ', casă: 'каса', școală: 'шкоалэ', carte: 'карте',
    prieten: 'приетен', familie: 'фамилие', mamă: 'мамэ', tată: 'тата', mulțumesc: 'мулцумеск', învățător: 'ынвэцэтор',
}

const withReadings = (words: VocabularyItemInput[]): VocabularyItemInput[] =>
    words.map(word => ({ ...word, sourceReading: READINGS[word.sourceText] }))

export const STARTER_SETS: StarterSet[] = [
    {
        sourceCode: 'en',
        targetCode: 'ru',
        name: 'English — Первые слова',
        words: withReadings([
            w('apple', 'яблоко', '/ˈæp.əl/', 'I eat an apple.', 'Я ем яблоко.'),
            w('dog', 'собака', '/dɒɡ/', 'My dog is funny.', 'Моя собака смешная.'),
            w('cat', 'кошка', '/kæt/'),
            w('house', 'дом', '/haʊs/'),
            w('school', 'школа', '/skuːl/', 'I go to school.', 'Я хожу в школу.'),
            w('book', 'книга', '/bʊk/'),
            w('friend', 'друг', '/frend/'),
            w('family', 'семья', '/ˈfæm.əl.i/'),
            w('water', 'вода', '/ˈwɔː.tər/'),
            w('beautiful', 'красивый', '/ˈbjuː.tɪ.fəl/', 'It is a beautiful day.', 'Сегодня прекрасный день.'),
            w('because', 'потому что', '/bɪˈkɒz/'),
            w('through', 'через', '/θruː/'),
            w('thought', 'мысль', '/θɔːt/'),
            w('teacher', 'учитель', '/ˈtiː.tʃər/'),
            w('window', 'окно', '/ˈwɪn.dəʊ/'),
        ]),
    },
    {
        sourceCode: 'ro',
        targetCode: 'ru',
        name: 'Română — Familia și școala',
        words: withReadings([
            w('măr', 'яблоко'),
            w('câine', 'собака'),
            w('pisică', 'кошка'),
            w('casă', 'дом'),
            w('școală', 'школа'),
            w('carte', 'книга'),
            w('prieten', 'друг'),
            w('familie', 'семья'),
            w('mamă', 'мама'),
            w('tată', 'папа'),
            w('mulțumesc', 'спасибо', undefined, 'Mulțumesc mult!', 'Большое спасибо!'),
            w('învățător', 'учитель'),
        ]),
    },
    {
        sourceCode: 'uk',
        targetCode: 'ru',
        name: 'Українська — Родина',
        words: [
            w('яблуко', 'яблоко'),
            w('собака', 'собака'),
            w('кіт', 'кот'),
            w('будинок', 'дом'),
            w('школа', 'школа'),
            w('книжка', 'книга'),
            w('друг', 'друг'),
            w('родина', 'семья'),
            w('мати', 'мать'),
            w('батько', 'отец'),
            w('дякую', 'спасибо'),
            w('вчитель', 'учитель'),
        ],
    },
]
