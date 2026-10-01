import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

/**
 * Тактильный отклик: в Android-приложении — Capacitor Haptics (как в fair price),
 * в браузере — Vibration API. Неподдерживаемые платформы молча игнорируются.
 */
const vibrate = (pattern: number | number[]) => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(pattern)
  } catch {
    // ignore
  }
}

const native = (fn: () => Promise<void>, fallback: number | number[]) => {
  if (Capacitor.isNativePlatform()) fn().catch(() => undefined)
  else vibrate(fallback)
}

export const LxHaptics = {
  /** Микро-взаимодействия: табы, выбор пункта. */
  light: () => native(() => Haptics.impact({ style: ImpactStyle.Light }), 8),
  /** Значимое действие: открыть ответ, добавить слово. */
  medium: () => native(() => Haptics.impact({ style: ImpactStyle.Medium }), 16),
  /** «Знаю», сохранение. */
  success: () => native(() => Haptics.notification({ type: NotificationType.Success }), [10, 40, 10]),
  /** Подтверждение удаления. */
  warning: () => native(() => Haptics.notification({ type: NotificationType.Warning }), [20, 60, 20]),
  /** «Не знаю», ошибка сохранения. */
  error: () => native(() => Haptics.notification({ type: NotificationType.Error }), [30, 50, 30]),
}
