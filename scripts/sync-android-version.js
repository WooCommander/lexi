/**
 * package.json version → android/app/build.gradle (versionName + versionCode).
 * Run: npm run sync-android-version
 */
import fs from 'fs'
import { buildGradlePath, readPackageVersion, versionCodeOf } from './version.js'

try {
    const version = readPackageVersion()
    const versionCode = versionCodeOf(version)
    let buildGradle = fs.readFileSync(buildGradlePath, 'utf8')

    const nameRe = /versionName\s+"([^"]+)"/
    const codeRe = /versionCode\s+(\d+)/
    const currentName = buildGradle.match(nameRe)?.[1]
    const currentCode = Number(buildGradle.match(codeRe)?.[1])

    if (!currentName || !currentCode) {
        console.error('Could not find versionName/versionCode in build.gradle')
        process.exit(1)
    }
    if (versionCode < currentCode) {
        console.error(`versionCode ${versionCode} (${version}) меньше текущего ${currentCode} — Android не установит такое обновление.`)
        console.error('Поднимите версию в package.json: npm version patch|minor|major')
        process.exit(1)
    }

    buildGradle = buildGradle.replace(nameRe, `versionName "${version}"`).replace(codeRe, `versionCode ${versionCode}`)
    fs.writeFileSync(buildGradlePath, buildGradle)
    console.log(`versionName ${currentName} → ${version}`)
    console.log(`versionCode ${currentCode} → ${versionCode}`)
} catch (error) {
    console.error('Error syncing Android version:', error.message)
    process.exit(1)
}
