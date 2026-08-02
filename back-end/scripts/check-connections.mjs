/**
 * Check active database connections
 *
 * For Turso/libSQL we can:
 *  1. Query PRAGMA stats to see internal DB state
 *  2. Check local processes that have open Prisma/libSQL clients
 */

import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

console.log('=== Database Connection Diagnostics ===\n')

// 1. List databases (libSQL supports attached databases)
const dbs = await client.execute('PRAGMA database_list')
console.log('📂 Attached databases:')
for (const row of dbs.rows) {
  console.log(`   seq: ${row.seq} | name: ${row.name} | file: ${row.file}`)
}
console.log('')

// 2. Internal stats (libSQL/turso)
try {
  const stats = await client.execute('PRAGMA stats')
  console.log('📊 PRAGMA stats:')
  for (const row of stats.rows) {
    for (const [k, v] of Object.entries(row)) {
      console.log(`   ${k}: ${v}`)
    }
  }
  console.log('')
} catch (e) {
  console.log('⚠️  PRAGMA stats not available:', e.message)
  console.log('')
}

// 3. Try to inspect libSQL connection URL details
console.log('🔗 Connection URL:', process.env.TURSO_DATABASE_URL?.replace(/:[^:@/]+@/, ':***@'))
console.log('   Has auth token:', !!process.env.TURSO_AUTH_TOKEN)
console.log('')

// 4. Heartbeat — verify connection is alive
try {
  const ping = await client.execute('SELECT 1 as alive')
  console.log('💓 Connection alive:', ping.rows[0].alive === 1 ? 'YES' : 'NO')
} catch (e) {
  console.log('❌ Connection failed:', e.message)
}
