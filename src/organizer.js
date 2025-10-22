const fs = require('fs')
const path = require('path')
const os = require('os')
const { ensureDir, uniquePath, moveAtomic, parseByteSize, isHiddenPath, expandHome } = require('./utils/file-utils')

const DEFAULT_ROOT = path.join(os.homedir(), 'organized')

const EXT_CATEGORIES = {
  // Documents
  '.pdf': 'Documents', '.doc': 'Documents', '.docx': 'Documents', '.rtf': 'Documents', '.txt': 'Documents',
  '.ppt': 'Documents', '.pptx': 'Documents', '.xls': 'Documents', '.xlsx': 'Documents', '.csv': 'Documents',
  // Media
  '.jpg': 'Media/Images', '.jpeg': 'Media/Images', '.png': 'Media/Images', '.gif': 'Media/Images', '.webp': 'Media/Images', '.tiff': 'Media/Images', '.heic': 'Media/Images',
  '.mp4': 'Media/Videos', '.mov': 'Media/Videos', '.mkv': 'Media/Videos', '.avi': 'Media/Videos',
  '.mp3': 'Media/Audio', '.wav': 'Media/Audio', '.m4a': 'Media/Audio', '.flac': 'Media/Audio',
  // Archives / installers
  '.zip': 'Archives', '.rar': 'Archives', '.7z': 'Archives', '.gz': 'Archives', '.bz2': 'Archives',
  '.dmg': 'Archives', '.pkg': 'Archives',
  // Code / dev
  '.js': 'Development', '.ts': 'Development', '.tsx': 'Development', '.jsx': 'Development', '.py': 'Development', '.rb': 'Development', '.go': 'Development', '.rs': 'Development', '.java': 'Development', '.c': 'Development', '.cpp': 'Development', '.h': 'Development', '.hpp': 'Development', '.sh': 'Development', '.json': 'Development', '.yml': 'Development', '.yaml': 'Development'
}

class Organizer {
  constructor (options = {}) {
    this.config = options.config || {}
    this.root = expandHome(options.root || DEFAULT_ROOT)
    this.external = this._loadExternal()
    this.actionsLog = options.actionsLog || path.join(path.dirname(this.root), 'storage-daemon-actions.log')
    ensureDir(this.root)
  }

  _loadExternal () {
    try {
      const p = path.join(__dirname, '..', 'config', 'external-drive.json')
      if (!fs.existsSync(p)) return null
      const data = JSON.parse(fs.readFileSync(p, 'utf8'))
      return data && data.externalDrive && data.externalDrive.enabled ? data.externalDrive : null
    } catch (_) {
      return null
    }
  }

  _appendAction (entry) {
    try {
      fs.appendFileSync(this.actionsLog, JSON.stringify({ ts: Date.now(), ...entry }) + '\n')
    } catch (_) {}
  }

  categorize (filePath) {
    const ext = path.extname(filePath).toLowerCase()
    return EXT_CATEGORIES[ext] || 'Documents'
  }

  shouldMove (stat, opts) {
    // Respect moveAfterDays unless force
    const days = (this.config.autoOrganize && this.config.autoOrganize.rules && this.config.autoOrganize.rules.moveAfterDays) || 0
    if (opts && opts.force) return true
    if (!days || days <= 0) return true
    const ageMs = Date.now() - stat.mtimeMs
    const minAgeMs = days * 24 * 60 * 60 * 1000
    return ageMs >= minAgeMs
  }

  externalDestination (srcPath, stat) {
    if (!this.external) return null
    const basePath = expandHome(this.external.path)
    if (!basePath || !fs.existsSync(basePath)) return null
    // Match simple patterns like *.ext
    const rules = Array.isArray(this.external.rules) ? this.external.rules : []
    for (const rule of rules) {
      const patt = (rule.pattern || '').trim()
      const minSize = parseByteSize(rule.minSize)
      if (Number.isFinite(minSize) && stat.size < minSize) continue
      if (patt.startsWith('*.')) {
        const ext = patt.slice(1).toLowerCase() // '.mp4'
        if (srcPath.toLowerCase().endsWith(ext)) {
          const key = rule.destination
          const destDir = this.external.categories && this.external.categories[key]
          if (destDir) return expandHome(destDir)
        }
      } else if (patt === '*' && Number.isFinite(minSize)) {
        // Catch-all by size
        const key = rule.destination
        const destDir = this.external.categories && this.external.categories[key]
        if (destDir) return expandHome(destDir)
      }
    }
    return null
  }

  planDestination (srcPath) {
    const category = this.categorize(srcPath)
    const destDir = path.join(this.root, category)
    return destDir
  }

  organizePaths (pathsInput, options = {}) {
    const dryRun = !!options.dryRun
    const force = !!options.force
    const results = { moved: [], skipped: [], errors: [] }
    const inputs = (pathsInput && pathsInput.length ? pathsInput : ((this.config.autoOrganize && this.config.autoOrganize.paths) || [])).map(expandHome)

    for (const p of inputs) {
      if (!p || !fs.existsSync(p)) continue
      if (isProtectedPath(p)) { results.skipped.push({ path: p, reason: 'protected-root' }); continue }
      const entries = safeReadDir(p)
      for (const name of entries) {
        const srcPath = path.join(p, name)
        let st
        try { st = fs.statSync(srcPath) } catch { continue }
        if (!st.isFile()) continue
        if (isHiddenPath(srcPath)) { results.skipped.push({ path: srcPath, reason: 'hidden' }); continue }
        if (isProtectedPath(srcPath)) { results.skipped.push({ path: srcPath, reason: 'protected' }); continue }

        try {
          if (!this.shouldMove(st, { force })) { results.skipped.push({ path: srcPath, reason: 'age' }); continue }

          // External offload first
          let destDir = this.externalDestination(srcPath, st)
          if (!destDir) destDir = this.planDestination(srcPath)
          ensureDir(destDir)
          const finalPath = uniquePath(path.join(destDir, path.basename(srcPath)))

          if (!dryRun) moveAtomic(srcPath, finalPath)

          const action = { from: srcPath, to: finalPath, size: st.size }
          this._appendAction({ type: 'move', ...action })
          results.moved.push(action)
        } catch (err) {
          const e = { path: srcPath, error: err.message }
          this._appendAction({ type: 'error', ...e })
          results.errors.push(e)
        }
      }
    }
    return results
  }
}

function safeReadDir (dir) {
  try {
    return fs.readdirSync(dir)
  } catch (_) {
    return []
  }
}

function isWithin (parent, p) {
  try {
    const rel = path.relative(parent, p)
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel)
  } catch (_) { return false }
}

function isProtectedPath (p) {
  try {
    const home = os.homedir()
    const prefixes = [
      path.join(home, 'Library', 'Mobile Documents'),
      path.join(home, 'Library', 'CloudStorage'),
      path.join(home, 'Library', 'Keychains'),
      path.join(home, 'Library', 'Application Support', 'CloudDocs'),
      path.join(home, 'Library', 'Accounts')
    ]
    const ap = expandHome(p)
    return prefixes.some(pref => ap === pref || isWithin(pref, ap))
  } catch (_) {
    return false
  }
}

module.exports = Organizer
