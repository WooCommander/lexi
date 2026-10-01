/**
 * Тактильный отклик через Vibration API.
 * Браузеры без поддержки (iOS Safari, десктоп) просто игнорируют вызовы.
 */
const vibrate = (pattern: number | number[]) => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Игнорируем ошибки неподдерживаемых платформ
  }
}

export const LxHaptics = {
  /** Микро-взаимодействия: табы, выбор пункта. */
  light: () => vibrate(8),
  /** Значимое действие: открыть ответ, добавить слово. */
  medium: () => vibrate(16),
  /** «Знаю», сохранение. */
  success: () => vibrate([10, 40, 10]),
  /** Подтверждение удаления. */
  warning: () => vibrate([20, 60, 20]),
  /** «Не знаю», ошибка сохранения. */
  error: () => vibrate([30, 50, 30]),
}
