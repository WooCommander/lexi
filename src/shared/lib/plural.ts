/** pluralRu(5, ['слово', 'слова', 'слов']) → 'слов' */
export const pluralRu = (n: number, forms: [string, string, string]): string => {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

export const wordsLabel = (n: number) => `${n} ${pluralRu(n, ['слово', 'слова', 'слов'])}`
export const mistakesLabel = (n: number) => `${n} ${pluralRu(n, ['ошибка', 'ошибки', 'ошибок'])}`
