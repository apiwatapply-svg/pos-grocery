import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@libsql/client'

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue
    }

    const [key, ...valueParts] = trimmed.split('=')
    if (!process.env[key]) {
      process.env[key] = valueParts.join('=').replace(/^"|"$/g, '')
    }
  }
}

loadEnvFile('.env')
loadEnvFile('.dev.vars')

const useRuntimeUrl = process.argv.includes('--runtime')
const url =
  process.env.MIGRATION_DATABASE_URL ||
  (useRuntimeUrl
    ? process.env.DATABASE_URL
    : process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL) ||
  'file:./dev.db'
const authToken = process.env.TURSO_AUTH_TOKEN || undefined
const migrationPath = path.join('prisma', 'migrations', '20260628120000_init', 'migration.sql')
const sql = fs.readFileSync(migrationPath, 'utf8')
const client = createClient({ url, authToken })

await client.executeMultiple(sql)
console.log(`Schema applied to ${url.startsWith('file:') ? 'local file database' : 'libsql database'}`)
