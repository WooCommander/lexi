export type RandomFn = () => number

/** Fisher–Yates; возвращает новый массив. */
export const shuffle = <T>(items: readonly T[], random: RandomFn = Math.random): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
