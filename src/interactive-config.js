#!/usr/bin/env node

// Minimal interactive config (stub)
// Prints guidance and exits successfully so CLI flows don't break.

const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'daemon.config.json');

function main() {
  console.log('Storage Management Daemon — Interactive Config (stub)');
  console.log('');
  console.log('Interactive configuration UI is not implemented yet.');
  console.log('You can edit the JSON config directly at:');
  console.log(`  ${CONFIG_PATH}`);
  console.log('');
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    console.log('Current dashboard config:');
    console.log(JSON.stringify(cfg.dashboard || {}, null, 2));
  } catch (err) {
    console.warn(`Could not read config: ${err.message}`);
  }
}

if (require.main === module) main();

