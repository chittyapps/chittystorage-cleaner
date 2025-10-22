#!/usr/bin/env node

const path = require('path')
const fs = require('fs')
const BackupEngine = require('./backup')

const ROOT = path.join(__dirname, '..')
const CONFIG_PATH = path.join(ROOT, 'config', 'daemon.config.json')

function loadConfig () {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) } catch { return {} }
}

function parseArgs (argv) {
  const args = { dryRun: false }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run' || a === '-n') args.dryRun = true
  }
  return args
}

function main () {
  const cfg = loadConfig()
  const args = parseArgs(process.argv)
  const engine = new BackupEngine({ config: cfg, root: process.env.BACKUP_DIR || path.join(ROOT, 'backups') })
  const res = engine.backupCritical({ dryRun: args.dryRun })
  console.log(JSON.stringify({ ok: true, ...res }, null, 2))
}

if (require.main === module) main()

