const fs = require('fs')
const path = require('path')
const os = require('os')
const { ensureDir, isHiddenPath, expandHome } = require('./utils/file-utils')

function nowStamp () {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function matchRules (filename, rules) {
  if (!rules) return true
  const ext = path.extname(filename).toLowerCase()
  const name = path.basename(filename).toLowerCase()
  const okExt = !rules.extensions || rules.extensions.length === 0 || rules.extensions.map(e => e.toLowerCase()).includes(ext)
  const okPat = !rules.patterns || rules.patterns.length === 0 || rules.patterns.some(p => name.includes(String(p).toLowerCase()))
  return okExt || okPat
}

class BackupEngine {
  constructor (options = {}) {
    this.config = options.config || {}
    this.root = options.root || path.join(path.join(__dirname, '..'), 'backups')
    ensureDir(this.root)
  }

  backupCritical (opts = {}) {
    const dryRun = !!opts.dryRun
    const cfg = this.config.backup || {}
    const critical = Array.isArray(cfg.critical) ? cfg.critical : []
    const rules = cfg.rules || {}
    const stamp = nowStamp()
    const snapshotRoot = path.join(this.root, 'critical', stamp)

    // Google Drive staging (if enabled and basePath exists)
    let stageRoot = null
    try {
      if (this.config.sync && this.config.sync.googleDrive && this.config.sync.googleDrive.enabled) {
        const basePath = this.config.sync.googleDrive.basePath && expandHome(this.config.sync.googleDrive.basePath)
        if (basePath && fs.existsSync(basePath)) {
          const host = os.hostname().replace(/[^A-Za-z0-9_.-]/g, '_')
          stageRoot = path.join(basePath, 'STORAGE_DAEMON_BACKUPS', host, 'critical', stamp)
        }
      }
    } catch (_) {}
    const results = { copied: 0, bytes: 0, files: [], skipped: 0 }
    for (const rawSrc of critical) {
      const src = expandHome(rawSrc)
      if (!src || !fs.existsSync(src)) continue
      const baseName = path.basename(src)
      const destBase = path.join(snapshotRoot, baseName)
      const stageBase = stageRoot ? path.join(stageRoot, baseName) : null
      this._copyTree(src, destBase, { dryRun, rules, results, snapshotRoot, stageRoot }, stageBase)
    }
    return results
  }

  _copyTree (srcDir, destDir, ctx, stageDir) {
    let entries
    try { entries = fs.readdirSync(srcDir, { withFileTypes: true }) } catch { return }

    for (const ent of entries) {
      const srcPath = path.join(srcDir, ent.name)
      if (isHiddenPath(srcPath)) { ctx.results.skipped++; continue }
      const destPath = path.join(destDir, ent.name)
      if (ent.isDirectory()) {
        const nextStageDir = stageDir ? path.join(stageDir, ent.name) : null
        this._copyTree(srcPath, destPath, ctx, nextStageDir)
      } else if (ent.isFile()) {
        if (!matchRules(ent.name, ctx.rules)) { ctx.results.skipped++; continue }
        try {
          const st = fs.statSync(srcPath)
          if (!ctx.dryRun) {
            ensureDir(path.dirname(destPath))
            fs.copyFileSync(srcPath, destPath)
            if (stageDir) {
              const stageDest = path.join(stageDir, ent.name)
              ensureDir(path.dirname(stageDest))
              fs.copyFileSync(srcPath, stageDest)
            }
          }
          ctx.results.copied++
          ctx.results.bytes += st.size
          ctx.results.files.push({ from: srcPath, to: destPath, size: st.size })
        } catch (err) {
          // Skip on error
        }
      }
    }
  }
}

module.exports = BackupEngine
