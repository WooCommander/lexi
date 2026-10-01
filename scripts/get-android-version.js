import fs from 'fs'
import { buildGradlePath } from './version.js'

try {
    const fileContent = fs.readFileSync(buildGradlePath, 'utf8')
    const versionCode = fileContent.match(/versionCode\s+(\d+)/)?.[1]
    const versionName = fileContent.match(/versionName\s+"([^"]+)"/)?.[1]

    if (!versionCode || !versionName) {
        console.error('Could not find versionCode or versionName in build.gradle')
        process.exit(1)
    }
    console.log(JSON.stringify({ versionCode: parseInt(versionCode, 10), versionName }, null, 2))
} catch (error) {
    console.error('Error reading build.gradle:', error.message)
    process.exit(1)
}
