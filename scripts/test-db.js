/**
 * Тесты схемы БД и RLS на настоящем PostgreSQL (без Supabase и Docker).
 *
 *   npm run test:db
 *
 * Без параметров поднимает временный кластер из установленного PostgreSQL (initdb в temp-папке),
 * прогоняет db/01–04 дважды (скрипты должны быть повторно запускаемыми), затем db/tests/*.
 * С TEST_DATABASE_URL (пустая база, например service-контейнер в CI) использует её вместо кластера.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const exe = name => (process.platform === 'win32' ? `${name}.exe` : name)

const SCHEMA_FILES = ['01_schema.sql', '02_functions.sql', '03_rls.sql', '04_seed.sql'].map(f => join(root, 'db', f))
const TEST_FILES = readdirSync(join(root, 'db', 'tests'))
  .filter(f => f.endsWith('.sql'))
  .sort()
  .map(f => join(root, 'db', 'tests', f))

/** Каталог bin установленного PostgreSQL: PG_BIN, затем PATH, затем типичные места установки. */
const findPgBin = () => {
  const candidates = []
  if (process.env.PG_BIN) candidates.push(process.env.PG_BIN)
  for (const dir of (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':')) candidates.push(dir)
  const roots = ['C:\\Program Files\\PostgreSQL', '/usr/lib/postgresql', '/opt/homebrew/opt']
  for (const base of roots) {
    if (!existsSync(base)) continue
    for (const version of readdirSync(base).sort().reverse()) {
      candidates.push(join(base, version, 'bin'), join(base, version))
    }
  }
  return candidates.find(dir => dir && existsSync(join(dir, exe('initdb'))) && existsSync(join(dir, exe('psql'))))
}

const run = (command, args, options = {}) =>
  spawnSync(command, args, { encoding: 'utf8', env: { ...process.env, PGCLIENTENCODING: 'UTF8', PGOPTIONS: '-c lc_messages=C' }, ...options })

const freePort = () =>
  new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolvePort(port))
    })
  })

const fail = message => {
  console.error(`\n${message}`)
  process.exitCode = 1
}

const main = async () => {
  let connection // аргументы psql для подключения
  let cleanup = () => {}
  let psql

  const databaseUrl = process.env.TEST_DATABASE_URL
  if (databaseUrl) {
    psql = process.env.PSQL ?? 'psql'
    connection = [databaseUrl]
  } else {
    const bin = findPgBin()
    if (!bin) return fail('PostgreSQL не найден. Установите его или задайте PG_BIN (папка bin) либо TEST_DATABASE_URL.')

    psql = join(bin, exe('psql'))
    const dataDir = mkdtempSync(join(tmpdir(), 'lexi-pg-'))
    const port = await freePort()

    const init = run(join(bin, exe('initdb')), ['-D', dataDir, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C'])
    if (init.status !== 0) {
      rmSync(dataDir, { recursive: true, force: true })
      return fail(`initdb: ${init.stderr || init.stdout}`)
    }

    const pgCtl = join(bin, exe('pg_ctl'))
    const start = run(pgCtl, [
      'start', '-D', dataDir, '-w', '-l', join(dataDir, 'server.log'),
      '-o', `-p ${port} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off`,
    ], { stdio: 'ignore' }) // иначе сервер наследует pipe и spawnSync ждёт его завершения вечно
    cleanup = () => {
      run(pgCtl, ['stop', '-D', dataDir, '-m', 'immediate'])
      rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    }
    if (start.status !== 0) {
      cleanup()
      return fail(`pg_ctl start: ${start.stderr || start.stdout}`)
    }
    connection = ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres']
  }

  const execFile = file => {
    // шумный вывод фикстур не нужен — показываем только отчёт
    const quiet = file.endsWith('99_report.sql') ? [] : ['-o', process.platform === 'win32' ? 'NUL' : '/dev/null']
    return run(psql, ['-X', '-q', '-P', 'pager=off', '-v', 'ON_ERROR_STOP=1', ...quiet, ...connection, '-f', file])
  }

  try {
    const steps = [
      ['Supabase-шим', [TEST_FILES.find(f => f.endsWith('00_supabase_shim.sql'))]],
      ['Схема (первый запуск)', SCHEMA_FILES],
      ['Схема (повторный запуск — идемпотентность)', SCHEMA_FILES],
      ['Тесты', TEST_FILES.filter(f => !f.endsWith('00_supabase_shim.sql'))],
    ]
    for (const [title, files] of steps) {
      console.log(`▸ ${title}`)
      for (const file of files) {
        const result = execFile(file)
        if (result.stdout.trim()) console.log(result.stdout.trim())
        if (result.status !== 0) {
          console.error(result.stderr.trim())
          return fail(`✗ ${file} завершился с ошибкой`)
        }
      }
    }
    console.log('\n✓ БД: схема и RLS проверены')
  } finally {
    cleanup()
  }
}

main().catch(error => fail(error.stack ?? String(error)))
