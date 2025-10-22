const fs = require('fs')
const path = require('path')
const os = require('os')
const { ensureDir } = require('./utils/file-utils')

function readRecentIntake(n = 500, root) {
  const p = path.join(root, 'data', 'intake', 'email.jsonl')
  if (!fs.existsSync(p)) return []
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean)
  return lines.slice(-n).map(l=>{ try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
}

function summarize(items) {
  const byCat = new Map()
  for (const it of items) {
    const cats = (it.routes && it.routes.categories) || ['Unassigned']
    const cat = cats[0]
    byCat.set(cat, (byCat.get(cat) || 0) + 1)
  }
  const summary = Array.from(byCat.entries()).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}: ${v}`).join(', ')
  return { total: items.length, byCategory: Object.fromEntries(byCat), text: summary }
}

function formatDigest(items, sum) {
  const lines = []
  lines.push(`# Storage Intake Digest — ${new Date().toLocaleString()}`)
  lines.push(`Host: ${os.hostname()}`)
  lines.push(`Total: ${sum.total}`)
  lines.push(`By Category: ${sum.text}`)
  lines.push('')
  for (const it of items.slice(-20).reverse()) {
    const cats = (it.routes && it.routes.categories && it.routes.categories.join(', ')) || 'Unassigned'
    const subj = (it.meta && it.meta.subject) || ''
    const from = (it.meta && it.meta.from && it.meta.from[0] && it.meta.from[0].address) || ''
    lines.push(`- [${new Date(it.ts).toLocaleString()}] ${cats} — ${subj} (from ${from})`)
  }
  return lines.join('\n')
}

function writeDigest(root, content) {
  const dir = path.join(root, 'data', 'digests')
  ensureDir(dir)
  const name = `digest-${new Date().toISOString().replace(/[:T]/g,'-').slice(0,16)}.md`
  const p = path.join(dir, name)
  fs.writeFileSync(p, content)
  return p
}

async function runDigest(root) {
  const items = readRecentIntake(500, root)
  const sum = summarize(items)
  const md = formatDigest(items, sum)
  const file = writeDigest(root, md)
  return { file, total: sum.total, summary: sum.text }
}

module.exports = { runDigest }

