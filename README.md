# 🚀 Storage Management Daemon

[![npm version](https://badge.fury.io/js/storage-management-daemon.svg)](https://badge.fury.io/js/storage-management-daemon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/username/storage-management-daemon/workflows/Node.js%20CI/badge.svg)](https://github.com/username/storage-management-daemon/actions)

A sophisticated, intelligent storage management daemon that automatically organizes files, manages backups, and optimizes disk space across local storage and Google Drive.

## ✨ Features

### 🤖 **Intelligent Automation**
- **Real-time file monitoring** with automatic categorization
- **Smart duplicate detection** and resolution
- **Automatic cleanup** when disk space is low
- **Intelligent file organization** by content type and date

### ☁️ **Google Drive Integration**
- **Seamless backup** to Google Shared Drives
- **Automatic sync** with customizable schedules
- **Smart categorization** routing files to appropriate drives
- **Multi-account support**

### 📊 **Monitoring & Control**
- **Real-time web dashboard** with system metrics
- **RESTful API** for programmatic control
- **Comprehensive logging** and activity tracking
- **Health monitoring** with automated alerts

### 🔒 **Security & Reliability**
- **Secure file handling** with integrity checks
- **Backup verification** before deletion
- **Configurable retention policies**
- **Process supervision** and auto-restart

## 🚀 Quick Start

### Installation

#### Via npm (Recommended)
```bash
npm install -g storage-management-daemon
storage-daemon-install
```

#### Via GitHub
```bash
git clone https://github.com/username/storage-management-daemon.git
cd storage-management-daemon
./install.sh
```

### Usage

```bash
# Start the daemon
storage-daemon start

# Interactive configuration
storage-daemon configure

# Check status
storage-daemon status

# Open web dashboard
storage-daemon dashboard

# View logs
storage-daemon logs
```

Access the dashboard at: **http://localhost:3456**

## 📁 File Organization

The daemon automatically organizes files into a structured hierarchy:

```
~/organized/
├── Legal/          # Court docs, contracts, legal files
├── Business/       # Corporate documents, invoices
├── Development/    # Code, projects, repositories  
├── Documents/      # General documents
├── Media/         # Images, videos, audio
├── Financial/     # Receipts, taxes, statements
├── Personal/      # Personal documents
└── Archives/      # Old files by date
```

## ⚙️ Configuration

### Interactive Configuration (Recommended)
```bash
# Launch interactive configuration wizard
storage-daemon configure
```

Features:
- 🎯 **Guided setup** with clear menus
- ✅ **Input validation** and smart defaults
- 🔧 **Section-by-section** configuration
- 💾 **Safe save/cancel** options

### File-based Configuration
```bash
storage-daemon config
```

### Advanced Configuration
```javascript
{
  "autoOrganize": {
    "enabled": true,
    "moveAfterDays": 7,
    "archiveAfterDays": 30
  },
  "backup": {
    "critical": [
      "~/Documents",
      "~/Business"
    ],
    "schedule": {
      "critical": "*/15 * * * *",  // Every 15 minutes
      "regular": "0 * * * *"        // Every hour
    }
  },
  "googleDrive": {
    "enabled": true,
    "mapping": {
      "legal": "Arias V Bianchi",
      "business": "ARIBIA LLC",
      "development": "MAIN"
    }
  }
}
```

## 🔧 API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Daemon status |
| GET | `/api/stats` | System statistics |
| POST | `/api/control/sync` | Trigger sync |
| POST | `/api/control/cleanup` | Run cleanup |
| GET | `/api/config` | Get configuration |
| POST | `/api/config` | Update configuration |

### Example Usage
```javascript
// Get daemon status
const response = await fetch('http://localhost:3456/api/status');
const status = await response.json();

// Trigger manual sync
await fetch('http://localhost:3456/api/control/sync', { 
  method: 'POST' 
});
```

## 🌐 Multi-Machine Deployment

Deploy to multiple machines easily:

```bash
# Deploy to remote Mac
./deploy-remote.sh 192.168.1.100 username

# Or use the npm package
npm install -g storage-management-daemon
ssh user@remote-host "storage-daemon-install"
```

## 🛠 Development

### Prerequisites
- Node.js 14+
- macOS (primary), Linux (experimental), Windows (planned)

### Setup
```bash
git clone https://github.com/username/storage-management-daemon.git
cd storage-management-daemon
npm install
npm run dev
```

### Testing
```bash
npm test
npm run test:integration
npm run test:e2e
```

## 📊 Monitoring

### Dashboard Features
- Real-time system resources (CPU, Memory, Disk)
- File processing statistics
- Google Drive sync status
- Live activity logs
- Manual control buttons

### Alerts
- Low disk space warnings
- Sync failures
- Large duplicate discoveries
- System health issues

## 🔒 Security

### Best Practices Implemented
- ✅ No external data collection
- ✅ Local-only processing
- ✅ Secure Google Drive API usage
- ✅ File integrity verification
- ✅ Configurable access controls
- ✅ Audit logging

### Security Configuration
```javascript
{
  "security": {
    "enableAuditLog": true,
    "restrictedPaths": ["/System", "/private"],
    "maxFileSize": "1GB",
    "allowedExtensions": [".pdf", ".doc", ".jpg"]
  }
}
```

## 🔧 System Integration

### macOS (Primary Support)
- Native launchd integration
- File system event monitoring
- Keychain integration for credentials
- Spotlight indexing support

### Linux (Experimental)
- systemd service integration
- inotify file watching
- Native package management

### Windows (Planned)
- Windows Service integration
- File system change notifications
- MSI installer package

## 📈 Performance

### Resource Usage
- **Memory**: ~50-100MB typical
- **CPU**: <5% average usage
- **Disk I/O**: Throttled during active use
- **Network**: Minimal (sync windows only)

### Optimization Tips
- Configure ignore patterns for large directories
- Adjust sync frequency for non-critical files
- Use SSD for organized directory structure
- Enable cleanup scheduling

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

### Areas for Contribution
- [ ] Windows support
- [ ] Linux systemd integration
- [ ] Additional cloud providers
- [ ] Mobile companion app
- [ ] Advanced ML categorization
- [ ] Plugin system

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 **Documentation**: [Full Documentation](docs/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/username/storage-management-daemon/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/username/storage-management-daemon/discussions)
- 📧 **Email**: support@storage-daemon.com

## 🏆 Acknowledgments

- Built with Node.js and modern web technologies
- Inspired by the need for intelligent file management
- Special thanks to all contributors and testers

---

**Made with ❤️ for better file management**