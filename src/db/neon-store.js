let PgClient
try { PgClient = require('pg').Client } catch (_) { PgClient = null }

class NeonStore {
  constructor (cfg) {
    this.cfg = cfg || {}
    this.url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || (this.cfg.integrations && this.cfg.integrations.neon && this.cfg.integrations.neon.databaseUrl) || null
  }

  updateConfig (cfg) {
    this.cfg = cfg || {}
    this.url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || (this.cfg.integrations && this.cfg.integrations.neon && this.cfg.integrations.neon.databaseUrl) || this.url
  }

  get configured () { return !!(this.url && PgClient) }

  async withClient (fn) {
    if (!this.configured) return null
    const client = new PgClient({ connectionString: this.url, ssl: { rejectUnauthorized: false } })
    await client.connect()
    try { return await fn(client) } finally { try { await client.end() } catch (_) {} }
  }

  async ensureSchema () {
    if (!this.configured) return false
    await this.withClient(async (c) => {
      await c.query(`
        create table if not exists emails (
          id bigserial primary key,
          message_id text unique,
          subject text,
          from_addr text,
          to_addrs jsonb,
          cc_addrs jsonb,
          date timestamptz,
          routed_to jsonb,
          plus_tags jsonb,
          eml_path text,
          created_at timestamptz default now()
        );
        create table if not exists email_attachments (
          id bigserial primary key,
          email_id bigint references emails(id) on delete cascade,
          filename text,
          mime text,
          size bigint,
          sha256 text,
          path text
        );
        create index if not exists ix_email_attachments_sha on email_attachments(sha256);
      `)
    })
    return true
  }

  async upsertEmail (meta, attachments, routes) {
    if (!this.configured) return null
    return this.withClient(async (c) => {
      await this.ensureSchema()
      const toAddr = JSON.stringify(meta.to || [])
      const ccAddr = JSON.stringify(meta.cc || [])
      const routed = JSON.stringify(routes.categories || [])
      const plus = JSON.stringify(routes.plusTags || [])
      const res = await c.query(`
        insert into emails (message_id, subject, from_addr, to_addrs, cc_addrs, date, routed_to, plus_tags, eml_path)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        on conflict (message_id) do update set subject=excluded.subject, from_addr=excluded.from_addr,
          to_addrs=excluded.to_addrs, cc_addrs=excluded.cc_addrs, date=excluded.date, routed_to=excluded.routed_to,
          plus_tags=excluded.plus_tags, eml_path=excluded.eml_path
        returning id
      `, [meta.messageId, meta.subject, (meta.from && meta.from[0] && meta.from[0].address) || null, toAddr, ccAddr, meta.date, routed, plus, meta.emlPath])
      const emailId = res.rows[0].id
      if (Array.isArray(attachments)) {
        for (const a of attachments) {
          await c.query(`
            insert into email_attachments (email_id, filename, mime, size, sha256, path)
            values ($1,$2,$3,$4,$5,$6)
          `, [emailId, a.filename, a.mime, a.size, a.sha256, a.path])
        }
      }
      return { emailId }
    })
  }
}

module.exports = NeonStore

