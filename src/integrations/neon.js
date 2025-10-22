let PgClient
try { PgClient = require('pg').Client } catch (_) { PgClient = null }

class Neon {
  constructor (opts = {}) {
    this.url = opts.url || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || null
    this.tables = opts.tables || (opts.config && opts.config.integrations && opts.config.integrations.neon && opts.config.integrations.neon.tables) || {}
  }

  updateConfig (cfg) {
    try {
      const neon = (cfg && cfg.integrations && cfg.integrations.neon) || {}
      this.url = neon.databaseUrl || process.env.NEON_DATABASE_URL || this.url
      this.tables = neon.tables || this.tables
    } catch (_) {}
  }

  get configured () { return !!(this.url && PgClient) }

  async _withClient (fn) {
    if (!this.configured) return null
    const client = new PgClient({ connectionString: this.url, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try { return await fn(client) } finally { try { await client.end() } catch (_) {} }
  }

  async testConnection () {
    if (!this.configured) return { ok: false, reason: 'not_configured' }
    try {
      const res = await this._withClient(c => c.query('select 1 as ok'))
      return { ok: true, result: res && res.rows && res.rows[0] && res.rows[0].ok === 1 }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async countRows (table) {
    if (!this.configured || !table) return null
    try {
      const res = await this._withClient(c => c.query(`select count(*)::int as n from ${table}`))
      return res.rows[0].n
    } catch (_) { return null }
  }

  async sampleRows (table, limit = 5) {
    if (!this.configured || !table) return []
    try {
      const res = await this._withClient(c => c.query(`select * from ${table} order by random() limit ${Math.max(1, Math.min(50, limit))}`))
      return res.rows
    } catch (_) { return [] }
  }
}

module.exports = Neon

