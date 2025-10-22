const fs = require('fs')
const path = require('path')
const os = require('os')
const si = require('systeminformation')
const axios = require('axios')
const { ensureDir } = require('./utils/file-utils')
const NotionIntegration = require('./integrations/notion')

class Alerts {
  constructor (options = {}) {
    this.config = options.config || {}
    this.root = options.root || path.join(__dirname, '..')
    this.logger = options.logger || console
    this.getState = options.getState || (() => ({ errors: 0 }))
    this.interval = null
    this.prevErrorCount = 0
    this.alertsPath = path.join(this.root, 'data', 'alerts.log')
    ensureDir(path.dirname(this.alertsPath))
    this._refreshNotifiers()
    this.notion = new NotionIntegration({})
  }

  updateConfig (cfg) {
    this.config = cfg || {}
    this._refreshNotifiers()
    try { this.notion.updateConfig(cfg) } catch (_) {}
  }

  start () {
    const checkMs = (this.config.monitoring && this.config.monitoring.checkInterval) || 5 * 60 * 1000
    if (this.interval) clearInterval(this.interval)
    this.prevErrorCount = this.getState().errors || 0
    this.interval = setInterval(() => this._tick().catch(() => {}), Math.max(10_000, checkMs))
    // run one immediately
    this._tick().catch(() => {})
  }

  stop () {
    if (this.interval) clearInterval(this.interval)
  }

  async _tick () {
    const cfg = this.config.monitoring || {}
    const alertsCfg = (cfg.alerts) || {}
    if (alertsCfg.lowSpace) await this._checkDisk(cfg)
    if (alertsCfg.syncErrors) this._checkErrors()
  }

  async _checkDisk (cfg) {
    try {
      const list = await si.fsSize()
      const rootEntry = list.find(d => d.mount === '/') || list[0]
      if (!rootEntry) return
      const use = rootEntry.use || (rootEntry.used && rootEntry.size ? 100 * rootEntry.used / rootEntry.size : 0)
      const threshold = cfg.diskThreshold || 90
      if (use >= threshold) {
        this._alert('low-space', `Disk usage ${use.toFixed(2)}% >= ${threshold}% on ${rootEntry.fs || rootEntry.mount}`)
      }
    } catch (err) {
      this.logger.warn(`Disk check failed: ${err.message}`)
    }
  }

  _checkErrors () {
    try {
      const state = this.getState()
      const cur = state.errors || 0
      if (cur > this.prevErrorCount) {
        const inc = cur - this.prevErrorCount
        this._alert('errors', `New errors detected: +${inc} (total ${cur})`)
      }
      this.prevErrorCount = cur
    } catch (_) {}
  }

  _alert (type, message) {
    const entry = { ts: Date.now(), host: os.hostname(), type, message }
    try {
      fs.appendFileSync(this.alertsPath, JSON.stringify(entry) + '\n')
    } catch (_) {}
    this.logger.warn(`ALERT [${type}] ${message}`)
    this._notifyOS(type, message)
    this._notifySlack(entry)
    this._notifyChatGPT(entry)
    this._notifyEmail(entry)
    this._notifyIMessage(entry)
    try { this.notion.appendAlert(entry) } catch (_) {}
  }

  _notifyOS (type, message) {
    if (process.platform !== 'darwin') return
    try {
      const { spawn } = require('child_process')
      spawn('osascript', ['-e', `display notification ${JSON.stringify(message)} with title "Storage Daemon" subtitle ${JSON.stringify(type)}`], { detached: true, stdio: 'ignore' }).unref()
    } catch (_) {}
  }
}

Alerts.prototype._refreshNotifiers = function () {
  const slackUrl = process.env.SLACK_WEBHOOK_URL || (this.config && this.config.notifications && this.config.notifications.slack && this.config.notifications.slack.webhookUrl)
  this._slackWebhook = slackUrl || null
  this._openaiKey = process.env.OPENAI_API_KEY || null
  const chatgptCfg = (this.config && this.config.notifications && this.config.notifications.chatgpt) || {}
  this._assistantId = process.env.OPENAI_ASSISTANT_ID || chatgptCfg.assistantId || null
  this._threadId = process.env.OPENAI_THREAD_ID || chatgptCfg.threadId || null
  this._openaiBase = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const emailCfg = (this.config && this.config.notifications && this.config.notifications.email) || {}
  this._emailTo = process.env.EMAIL_TO || emailCfg.to || null
  this._emailFrom = process.env.EMAIL_FROM || emailCfg.from || `daemon@${os.hostname()}`
  this._sendmailPath = process.env.EMAIL_SENDMAIL || emailCfg.sendmailPath || '/usr/sbin/sendmail'
  const imCfg = (this.config && this.config.notifications && this.config.notifications.imessage) || {}
  this._imessageTo = process.env.IMESSAGE_TO || imCfg.to || null
}

Alerts.prototype._notifySlack = async function (entry) {
  if (!this._slackWebhook) return
  try {
    const text = `[*${entry.type.toUpperCase()}*] ${entry.message}  (host: ${entry.host})`
    await axios.post(this._slackWebhook, { text })
  } catch (e) {
    // Do not crash on notification errors
  }
}

Alerts.prototype._ensureChatGPTThread = async function () {
  if (!this._openaiKey || !this._assistantId) return null
  if (this._threadId) return this._threadId
  try {
    const resp = await axios.post(`${this._openaiBase}/threads`, {}, { headers: { Authorization: `Bearer ${this._openaiKey}` } })
    const id = resp && resp.data && resp.data.id
    if (id) {
      this._threadId = id
      // persist so restarts reuse it
      try { fs.writeFileSync(path.join(this.root, 'data', 'chatgpt-thread.txt'), id) } catch (_) {}
      return id
    }
  } catch (_) {}
  return null
}

Alerts.prototype._notifyChatGPT = async function (entry) {
  try {
    if (!this._openaiKey || !this._assistantId) return
    const threadId = await this._ensureChatGPTThread()
    if (!threadId) return
    const headers = { Authorization: `Bearer ${this._openaiKey}`, 'Content-Type': 'application/json' }
    const text = `ALERT [${entry.type}] ${entry.message} (host: ${entry.host})`
    await axios.post(`${this._openaiBase}/threads/${threadId}/messages`, { role: 'user', content: text }, { headers })
    await axios.post(`${this._openaiBase}/threads/${threadId}/runs`, { assistant_id: this._assistantId }, { headers })
  } catch (_) {
    // ignore errors
  }
}

Alerts.prototype._notifyEmail = function (entry) {
  try {
    if (!this._emailTo) return
    const subject = `Storage Daemon Alert: ${entry.type}`
    const body = `${entry.message}\nHost: ${entry.host}\nTime: ${new Date(entry.ts).toISOString()}\n`
    // Prefer sendmail
    if (fs.existsSync(this._sendmailPath)) {
      const { spawn } = require('child_process')
      const proc = spawn(this._sendmailPath, ['-t'])
      proc.stdin.write(`To: ${this._emailTo}\nFrom: ${this._emailFrom}\nSubject: ${subject}\n\n${body}`)
      proc.stdin.end()
      proc.on('error', () => {})
    } else {
      // Try 'mail' command
      const { spawnSync } = require('child_process')
      spawnSync('mail', ['-s', subject, this._emailTo], { input: body })
    }
  } catch (_) { /* ignore */ }
}

Alerts.prototype._notifyIMessage = function (entry) {
  if (process.platform !== 'darwin') return
  if (!this._imessageTo) return
  try {
    const { spawn } = require('child_process')
    const text = `ALERT [${entry.type}] ${entry.message}`.replace(/"/g, '\\"')
    const script = `tell application "Messages"\nset targetService to 1st service whose service type = iMessage\nsend "${text}" to buddy "${this._imessageTo}" of targetService\nend tell`
    spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' }).unref()
  } catch (_) { /* ignore */ }
}

module.exports = Alerts
