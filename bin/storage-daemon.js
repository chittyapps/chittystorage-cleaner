#!/usr/bin/env node

/**
 * Storage Management Daemon CLI
 */

const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const DAEMON_DIR = path.join(__dirname, '..');
const MANAGE_SCRIPT = path.join(DAEMON_DIR, 'manage.sh');

function showUsage() {
    console.log(`
Storage Management Daemon CLI

Usage: storage-daemon <command>

Commands:
  start       Start the daemon
  stop        Stop the daemon  
  restart     Restart the daemon
  status      Show daemon status
  logs        Show daemon logs
  dashboard   Open web dashboard
  config      Configuration options (interactive/file)
  configure   Interactive configuration setup
  install     Install daemon service
  uninstall   Remove daemon service
  version     Show version

Examples:
  storage-daemon start
  storage-daemon status
  storage-daemon dashboard
`);
}

function runCommand(command, args = []) {
    const child = spawn(command, args, { 
        stdio: 'inherit',
        cwd: DAEMON_DIR
    });
    
    child.on('error', (err) => {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    });
    
    child.on('close', (code) => {
        process.exit(code);
    });
}

function main() {
    const command = process.argv[2];
    
    if (!command) {
        showUsage();
        process.exit(1);
    }
    
    switch (command) {
        case 'start':
        case 'stop':
        case 'restart':
        case 'status':
        case 'logs':
        case 'dashboard':
        case 'config':
            if (fs.existsSync(MANAGE_SCRIPT)) {
                runCommand('bash', [MANAGE_SCRIPT, command]);
            } else {
                console.error('Daemon not installed. Run: storage-daemon install');
                process.exit(1);
            }
            break;
            
        case 'configure':
        case 'interactive-config':
            const configScript = path.join(DAEMON_DIR, 'src/interactive-config.js');
            if (fs.existsSync(configScript)) {
                runCommand('node', [configScript]);
            } else {
                console.error('Interactive config not found');
                process.exit(1);
            }
            break;
            
        case 'install':
            const installScript = path.join(DAEMON_DIR, 'install.sh');
            if (fs.existsSync(installScript)) {
                runCommand('bash', [installScript]);
            } else {
                console.error('Install script not found');
                process.exit(1);
            }
            break;
            
        case 'uninstall':
            const uninstallScript = path.join(DAEMON_DIR, 'uninstall.sh');
            if (fs.existsSync(uninstallScript)) {
                runCommand('bash', [uninstallScript]);
            } else {
                console.error('Uninstall script not found');
                process.exit(1);
            }
            break;
            
        case 'version':
            const packageJson = require('../package.json');
            console.log(`Storage Management Daemon v${packageJson.version}`);
            break;
            
        case 'help':
        case '--help':
        case '-h':
            showUsage();
            break;
            
        default:
            console.error(`Unknown command: ${command}`);
            showUsage();
            process.exit(1);
    }
}

if (require.main === module) {
    main();
}