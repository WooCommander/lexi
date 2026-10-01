/**
 * Upload APK + version.json to Supabase Storage (bucket "releases").
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env or .env.local (never commit it!)
 * Run: npm run upload-release
 *
 * Кладёт два файла APK:
 *   app-latest.apk       — на него ссылается version.json (стабильная ссылка)
 *   lexi-<version>.apk   — архив конкретной версии, можно откатиться
 */
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { root, readPackageVersion, versionCodeOf } from './version.js'

const BUCKET = 'releases'

// ── Parse env files ──────────────────────────────────────────────────────────
function parseEnvFile(filePath) {
    if (!existsSync(filePath)) return {}
    return Object.fromEntries(
        readFileSync(filePath, 'utf-8')
            .split(/\r?\n/)
            .filter(l => l && !l.startsWith('#') && l.includes('='))
            .map(l => { const idx = l.indexOf('='); return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] })
    )
}

const env = {
    ...parseEnvFile(resolve(root, '.env')),
    ...parseEnvFile(resolve(root, '.env.local')),
    ...process.env,
}

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

console.log('ℹ️   Supabase URL:', SUPABASE_URL || '(not set)')
console.log('ℹ️   Service key: ', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.slice(0, 12) + '...' : '(NOT SET ❌)')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('\n❌  SUPABASE_SERVICE_ROLE_KEY not found.')
    console.error('    Supabase → Project Settings → API Keys → service_role (secret)')
    console.error('    Add it to .env.local:  SUPABASE_SERVICE_ROLE_KEY=eyJ...')
    process.exit(1)
}

// ── Version ──────────────────────────────────────────────────────────────────
const version = readPackageVersion()
const versionCode = versionCodeOf(version)
console.log(`ℹ️   Version: ${version} (code ${versionCode})`)

// ── Release notes from changelog.ts ──────────────────────────────────────────
function getChangelogNotes(ver) {
    try {
        const src = readFileSync(resolve(root, 'src/modules/updates/changelog.ts'), 'utf-8')
        const versionBlockRe = new RegExp(`version:\\s*['"\`]${ver.replace(/\./g, '\\.')}['"\`][\\s\\S]*?(?=\\{\\s*version:|\\]\\s*$)`)
        const block = src.match(versionBlockRe)?.[0] || ''

        const extractList = (field) => {
            const m = block.match(new RegExp(`${field}:\\s*\\[([\\s\\S]*?)\\]`))
            if (!m) return []
            return [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map(x => x[1])
        }

        const highlights = extractList('highlights')
        const features = extractList('features')
        const fixes = extractList('fixes')
        if (!highlights.length && !features.length && !fixes.length) return null

        return [...highlights, ...features.map(f => `+ ${f}`), ...fixes.map(f => `✓ ${f}`)].join('\n')
    } catch {
        return null
    }
}

const changelogNotes = getChangelogNotes(version)
if (!changelogNotes && !env.RELEASE_NOTES) {
    console.warn(`⚠️   В src/modules/updates/changelog.ts нет записи для ${version} — заметки будут пустыми`)
}
const releaseNotes = env.RELEASE_NOTES || changelogNotes || `Версия ${version}`
console.log(`ℹ️   Notes: ${releaseNotes.split('\n')[0]}${releaseNotes.includes('\n') ? '...' : ''}`)

// ── Supabase client with service role (bypasses RLS) ─────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

console.log('\n📦  Checking bucket...')
const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
if (listErr) {
    console.error('❌  Cannot list buckets:', listErr.message)
    console.error('    Probably the service role key is wrong or missing.')
    process.exit(1)
}
if (!buckets.some(b => b.name === BUCKET)) {
    console.log(`    Creating bucket "${BUCKET}" (public)...`)
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (error) { console.error('❌  Cannot create bucket:', error.message); process.exit(1) }
    console.log('    ✓ Bucket created')
} else {
    console.log(`    ✓ Bucket "${BUCKET}" exists`)
}

// ── Upload APK ───────────────────────────────────────────────────────────────
const apkPath = resolve(root, 'android/app/build/outputs/apk/debug/app-debug.apk')
if (!existsSync(apkPath)) {
    console.error('\n❌  APK not found:', apkPath)
    console.error('    Run: npm run build-debug-apk  first')
    process.exit(1)
}

const apkBuffer = readFileSync(apkPath)
const upload = (name, body, contentType) =>
    supabase.storage.from(BUCKET).upload(name, body, { contentType, upsert: true, cacheControl: '60' })

console.log(`\n⬆️   Uploading APK v${version} (${(apkBuffer.length / 1024 / 1024).toFixed(1)} MB)...`)
for (const name of [`lexi-${version}.apk`, 'app-latest.apk']) {
    const { error } = await upload(name, apkBuffer, 'application/vnd.android.package-archive')
    if (error) { console.error(`❌  ${name} upload failed:`, error.message); process.exit(1) }
    console.log(`✓  ${name}`)
}

// ── Upload version.json (последним — клиенты увидят версию только когда APK уже на месте) ──
const publicBase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`
const apkUrl = `${publicBase}/lexi-${version}.apk`
const manifest = JSON.stringify(
    { version, versionCode, apkUrl, notes: releaseNotes, publishedAt: new Date().toISOString() },
    null,
    2,
)

const { error: vErr } = await upload('version.json', Buffer.from(manifest), 'application/json')
if (vErr) { console.error('❌  version.json upload failed:', vErr.message); process.exit(1) }

console.log(`✓  version.json updated → v${version}`)
console.log(`\n🚀  Done! APK: ${apkUrl}`)
console.log(`    Latest:   ${publicBase}/app-latest.apk`)
