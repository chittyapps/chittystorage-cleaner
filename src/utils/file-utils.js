const fs = require('fs')
const path = require('path')

function expandHome (p) {
  if (!p) return p
  if (p.startsWith('~')) return path.join(process.env.HOME || process.env.USERPROFILE, p.slice(1))
  return p
}

function ensureDir (dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true })
  } catch (_) {}
}

function splitExt (filename) {
  const ext = path.extname(filename).toLowerCase()
  const base = path.basename(filename, ext)
  return { base, ext }
}

function uniquePath (targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath
  const dir = path.dirname(targetPath)
  const { base, ext } = splitExt(path.basename(targetPath))
  let i = 1
  // Try suffixes like "filename (1).ext"
  while (true) {
    const candidate = path.join(dir, `${base} (${i})${ext}`)
    if (!fs.existsSync(candidate)) return candidate
    i++
  }
}

function moveAtomic (src, dest) {
  try {
    fs.renameSync(src, dest)
  } catch (err) {
    // Cross-device or other rename error: fallback to copy + unlink
    if (err && (err.code === 'EXDEV' || err.code === 'EACCES' || err.code === 'EPERM')) {
      fs.copyFileSync(src, dest)
      fs.unlinkSync(src)
    } else {
      throw err
    }
  }
}

function parseByteSize (val) {
  if (typeof val === 'number') return val
  if (!val || typeof val !== 'string') return NaN
  const m = val.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(B|KB|MB|GB|TB)?$/i)
  if (!m) return NaN
  const n = parseFloat(m[1])
  const unit = (m[2] || 'B').toUpperCase()
  const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[unit]
  return Math.round(n * mult)
}

function isHiddenPath (p) {
  return path.basename(p).startsWith('.')
}

module.exports = {
  expandHome,
  ensureDir,
  uniquePath,
  moveAtomic,
  parseByteSize,
  isHiddenPath
}

