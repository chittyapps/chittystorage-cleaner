const axios = require('axios')

class NotionIntegration {
  constructor (opts = {}) {
    this.token = opts.token || process.env.NOTION_API_KEY || null
    this.version = opts.version || '2022-06-28'
    this.actionsDb = opts.actionsDb || process.env.NOTION_ACTIONS_DB_ID || null
    this.alertsDb = opts.alertsDb || process.env.NOTION_ALERTS_DB_ID || null
    this.statusDb = opts.statusDb || process.env.NOTION_STATUS_DB_ID || null
    this.statusPage = opts.statusPage || process.env.NOTION_STATUS_PAGE_ID || null
    this.parentPage = opts.parentPage || process.env.NOTION_PARENT_PAGE_ID || null
    this.host = opts.host || require('os').hostname()
    this.base = 'https://api.notion.com/v1'
  }

  updateConfig (cfg) {
    const notion = (cfg && cfg.notifications && cfg.notifications.notion) || {}
    this.token = process.env.NOTION_API_KEY || notion.apiKey || this.token
    this.actionsDb = process.env.NOTION_ACTIONS_DB_ID || notion.actionsDatabaseId || this.actionsDb
    this.alertsDb = process.env.NOTION_ALERTS_DB_ID || notion.alertsDatabaseId || this.alertsDb
    this.statusDb = process.env.NOTION_STATUS_DB_ID || notion.statusDatabaseId || this.statusDb
    this.statusPage = process.env.NOTION_STATUS_PAGE_ID || notion.statusPageId || this.statusPage
    this.parentPage = process.env.NOTION_PARENT_PAGE_ID || notion.parentPageId || this.parentPage
  }

  get headers () {
    return {
      'Notion-Version': this.version,
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    }
  }

  async createDatabasesUnderParent () {
    if (!this.token || !this.parentPage) throw new Error('NOTION_API_KEY and NOTION_PARENT_PAGE_ID required')
    const alerts = await axios.post(`${this.base}/databases`, {
      parent: { type: 'page_id', page_id: this.parentPage },
      title: [{ type: 'text', text: { content: 'Storage Alerts' } }],
      properties: {
        Name: { title: {} },
        Type: { select: { options: [{ name: 'low-space', color: 'orange' }, { name: 'errors', color: 'red' }, { name: 'test', color: 'blue' }] } },
        Host: { rich_text: {} },
        Time: { date: {} }
      }
    }, { headers: this.headers }).then(r => r.data)

    const actions = await axios.post(`${this.base}/databases`, {
      parent: { type: 'page_id', page_id: this.parentPage },
      title: [{ type: 'text', text: { content: 'Storage Actions' } }],
      properties: {
        Name: { title: {} },
        From: { rich_text: {} },
        To: { rich_text: {} },
        Size: { number: {} },
        Time: { date: {} }
      }
    }, { headers: this.headers }).then(r => r.data)

    const status = await axios.post(`${this.base}/databases`, {
      parent: { type: 'page_id', page_id: this.parentPage },
      title: [{ type: 'text', text: { content: 'Storage Status Snapshots' } }],
      properties: {
        Name: { title: {} },
        Host: { rich_text: {} },
        CPU_Load: { number: {} },
        Mem_UsedPct: { number: {} },
        Disk_UsePct: { number: {} },
        Files_Processed: { number: {} },
        Errors: { number: {} },
        Sync_Operations: { number: {} },
        Time: { date: {} }
      }
    }, { headers: this.headers }).then(r => r.data)

    return { alertsDbId: alerts.id, actionsDbId: actions.id, statusDbId: status.id }
  }

  async createDashboardPage ({ alertsDbId, actionsDbId, statusDbId } = {}) {
    if (!this.token || !this.parentPage) throw new Error('NOTION_API_KEY and NOTION_PARENT_PAGE_ID required')
    const children = []
    if (alertsDbId) children.push({ object: 'block', type: 'link_to_page', link_to_page: { type: 'database_id', database_id: alertsDbId } })
    if (actionsDbId) children.push({ object: 'block', type: 'link_to_page', link_to_page: { type: 'database_id', database_id: actionsDbId } })
    if (statusDbId) children.push({ object: 'block', type: 'link_to_page', link_to_page: { type: 'database_id', database_id: statusDbId } })
    children.unshift({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: 'Storage Daemon Dashboard' } }] } })
    children.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Local dashboard: http://localhost:3456' } }] } })
    const page = await axios.post(`${this.base}/pages`, {
      parent: { type: 'page_id', page_id: this.parentPage },
      properties: {
        title: { title: [{ type: 'text', text: { content: 'Storage Daemon Dashboard' } }] }
      },
      children
    }, { headers: this.headers }).then(r => r.data)
    return page
  }

  async appendAlert (entry) {
    if (!this.token || !this.alertsDb) return
    const name = `${entry.type.toUpperCase()} — ${new Date(entry.ts || Date.now()).toLocaleString()}`
    await axios.post(`${this.base}/pages`, {
      parent: { database_id: this.alertsDb },
      properties: {
        Name: { title: [{ type: 'text', text: { content: name } }] },
        Type: { select: { name: entry.type } },
        Host: { rich_text: [{ type: 'text', text: { content: this.host } }] },
        Time: { date: { start: new Date(entry.ts || Date.now()).toISOString() } }
      },
      children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: entry.message || '' } }] } }]
    }, { headers: this.headers }).catch(() => {})
  }

  async appendActions (moves) {
    if (!this.token || !this.actionsDb) return
    for (const m of moves || []) {
      const name = `Move — ${require('path').basename(m.from)} → ${require('path').basename(m.to)}`
      await axios.post(`${this.base}/pages`, {
        parent: { database_id: this.actionsDb },
        properties: {
          Name: { title: [{ type: 'text', text: { content: name } }] },
          From: { rich_text: [{ type: 'text', text: { content: String(m.from).slice(0, 2000) } }] },
          To: { rich_text: [{ type: 'text', text: { content: String(m.to).slice(0, 2000) } }] },
          Size: { number: Number(m.size || 0) },
          Time: { date: { start: new Date().toISOString() } }
        }
      }, { headers: this.headers }).catch(() => {})
    }
  }

  async appendStatusSnapshot (snap) {
    // Prefer status database if configured; otherwise append a paragraph to a status page if provided
    if (this.token && this.statusDb) {
      const name = `Status — ${new Date(snap.ts || Date.now()).toLocaleString()}`
      await axios.post(`${this.base}/pages`, {
        parent: { database_id: this.statusDb },
        properties: {
          Name: { title: [{ type: 'text', text: { content: name } }] },
          Host: { rich_text: [{ type: 'text', text: { content: this.host } }] },
          CPU_Load: { number: Number(snap.cpuLoad || 0) },
          Mem_UsedPct: { number: Number(snap.memUsedPct || 0) },
          Disk_UsePct: { number: Number(snap.diskUsePct || 0) },
          Files_Processed: { number: Number(snap.filesProcessed || 0) },
          Errors: { number: Number(snap.errors || 0) },
          Sync_Operations: { number: Number(snap.syncOperations || 0) },
          Time: { date: { start: new Date(snap.ts || Date.now()).toISOString() } }
        }
      }, { headers: this.headers }).catch(() => {})
      return
    }
    if (this.token && this.statusPage) {
      const text = `CPU: ${snap.cpuLoad}%  Mem: ${snap.memUsedPct}%  Disk: ${snap.diskUsePct}%  Files: ${snap.filesProcessed}  Errors: ${snap.errors}  Sync: ${snap.syncOperations}`
      await axios.patch(`${this.base}/blocks/${this.statusPage}/children`, {
        children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: `${new Date().toLocaleString()} — ${text}` } }] } }]
      }, { headers: this.headers }).catch(() => {})
    }
  }
}

module.exports = NotionIntegration
