/** Человекочитаемое сообщение из ошибки Supabase / JS. */
export const errorMessage = (err: unknown, fallback = 'Что-то пошло не так'): string => {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return fallback
}
