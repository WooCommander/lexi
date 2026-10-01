/**
 * Общие хелперы версий для скриптов релиза.
 *
 * Улучшение относительно fair price: versionCode не «+1 при каждом запуске»,
 * а детерминированно выводится из semver — 1.2.3 → 10203. Повторный запуск
 * update-android не раздувает номер, а новая версия всегда больше старой.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

export const root = resolve(import.meta.dirname, '..')
export const buildGradlePath = resolve(root, 'android', 'app', 'build.gradle')

export function readPackageVersion() {
    return JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
}

export function versionCodeOf(version) {
    const [major = 0, minor = 0, patch = 0] = version.split('-')[0].split('.').map(Number)
    if ([major, minor, patch].some(n => !Number.isInteger(n) || n < 0) || minor > 99 || patch > 99) {
        throw new Error(`Версия "${version}" должна быть вида MAJOR.MINOR.PATCH, MINOR и PATCH ≤ 99`)
    }
    return major * 10000 + minor * 100 + patch
}
