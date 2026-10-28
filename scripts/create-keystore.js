/**
 * Создаёт release-ключ для подписи APK и android/keystore.properties.
 *
 *   npm run android:keystore
 *
 * Ключ создаётся ОДИН раз. Потеряете его — установленные приложения больше не смогут
 * обновиться поверх (придётся удалять и ставить заново), поэтому сразу сделайте копию
 * android/lexi-release.jks и пароля из android/keystore.properties в надёжное место.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const androidDir = resolve(import.meta.dirname, '..', 'android')
const keystorePath = join(androidDir, 'lexi-release.jks')
const propsPath = join(androidDir, 'keystore.properties')

if (existsSync(keystorePath) || existsSync(propsPath)) {
  console.error('Ключ уже есть (android/lexi-release.jks или keystore.properties). Не перезаписываю — потеря ключа необратима.')
  process.exit(1)
}

/** JDK берём из org.gradle.java.home (jbr Android Studio), иначе keytool из PATH. */
const keytool = (() => {
  const exe = process.platform === 'win32' ? 'keytool.exe' : 'keytool'
  try {
    const props = readFileSync(join(androidDir, 'gradle.properties'), 'utf8')
    const home = props.match(/^org\.gradle\.java\.home\s*=\s*(.+)$/m)?.[1]?.trim().replace(/\\\\/g, '\\')
    if (home && existsSync(join(home, 'bin', exe))) return join(home, 'bin', exe)
  } catch {
    // gradle.properties нет — пробуем PATH
  }
  return exe
})()

const password = randomBytes(18).toString('base64url')
const alias = 'lexi'

const result = spawnSync(
  keytool,
  [
    '-genkeypair', '-v',
    '-keystore', keystorePath,
    '-alias', alias,
    '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-storepass', password, '-keypass', password,
    '-dname', 'CN=Lexi, O=Lexi, C=MD',
  ],
  { encoding: 'utf8' },
)
if (result.error || result.status !== 0) {
  console.error(`keytool не сработал: ${result.error?.message ?? result.stderr}`)
  process.exit(1)
}

writeFileSync(
  propsPath,
  `storeFile=lexi-release.jks\nstorePassword=${password}\nkeyAlias=${alias}\nkeyPassword=${password}\n`,
)

console.log('✓ Создано: android/lexi-release.jks и android/keystore.properties (оба в .gitignore)')
console.log('⚠ Сделайте копию обоих файлов сейчас. Без них обновлять установленные приложения невозможно.')
