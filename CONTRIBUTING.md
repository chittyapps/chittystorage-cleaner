# Contributing to Storage Management Daemon

Thank you for your interest in contributing! This guide will help you get started.

## 🚀 Quick Start

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/yourusername/storage-management-daemon.git`
3. **Install** dependencies: `npm install`
4. **Create** a branch: `git checkout -b feature/amazing-feature`
5. **Make** your changes
6. **Test** your changes: `npm test`
7. **Commit** your changes: `git commit -m 'Add amazing feature'`
8. **Push** to your branch: `git push origin feature/amazing-feature`
9. **Open** a Pull Request

## 🛠 Development Setup

### Prerequisites
- Node.js 14+ 
- npm 6+
- macOS or Linux (Windows support planned)

### Local Development
```bash
# Clone the repository
git clone https://github.com/username/storage-management-daemon.git
cd storage-management-daemon

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
npm run test:integration

# Lint code
npm run lint
npm run lint:fix
```

### Project Structure
```
storage-daemon/
├── src/                    # Source code
│   ├── daemon.js          # Main daemon
│   ├── storage-manager.js # Storage operations
│   ├── sync-engine.js     # Google Drive sync
│   └── web-dashboard.js   # Web interface
├── bin/                   # CLI executables
├── config/               # Configuration files
├── tests/                # Test suite
├── docs/                 # Documentation
└── scripts/              # Build/deploy scripts
```

## 📝 Code Guidelines

### Style Guide
We use [Standard JS](https://standardjs.com/) for code formatting:

```bash
npm run lint        # Check style
npm run lint:fix    # Auto-fix issues
```

### Commit Messages
Follow [Conventional Commits](https://conventionalcommits.org/):

```
feat: add new file organization feature
fix: resolve Google Drive sync issue
docs: update installation guide
test: add integration tests for daemon
refactor: improve error handling
```

### Code Quality
- Write tests for new features
- Maintain test coverage above 80%
- Document complex functions
- Use TypeScript for new modules (preferred)
- Follow security best practices

## 🧪 Testing

### Test Types
- **Unit Tests**: `npm test`
- **Integration Tests**: `npm run test:integration`
- **End-to-End Tests**: `npm run test:e2e`

### Writing Tests
```javascript
// tests/unit/storage-manager.test.js
const StorageManager = require('../../src/storage-manager');

describe('StorageManager', () => {
  test('should detect duplicates correctly', async () => {
    const manager = new StorageManager(mockConfig);
    const duplicates = await manager.findDuplicates('/test/path');
    expect(duplicates).toHaveLength(0);
  });
});
```

### Test Data
- Use mocks for external services
- Create temporary directories for file operations
- Clean up test artifacts

## 📋 Issue Guidelines

### Bug Reports
Include:
- **Environment**: OS, Node.js version, daemon version
- **Steps to Reproduce**: Clear, step-by-step instructions
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Logs**: Relevant error messages or logs
- **Screenshots**: If applicable

### Feature Requests
Include:
- **Problem**: What problem does this solve?
- **Solution**: Proposed implementation
- **Alternatives**: Other approaches considered
- **Impact**: Who benefits from this feature?

## 🔧 Development Areas

### High Priority
- [ ] Windows support
- [ ] Linux systemd integration
- [ ] Performance optimizations
- [ ] Security enhancements

### Medium Priority
- [ ] Additional cloud providers (Dropbox, OneDrive)
- [ ] Advanced file categorization (ML)
- [ ] Plugin system
- [ ] Mobile companion app

### Documentation
- [ ] API documentation
- [ ] Video tutorials
- [ ] Configuration examples
- [ ] Troubleshooting guides

## 🌟 Pull Request Process

### Before Submitting
1. **Rebase** on latest main branch
2. **Test** all changes thoroughly
3. **Update** documentation if needed
4. **Add** tests for new functionality
5. **Run** full test suite

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

### Review Process
1. **Automated checks** must pass (CI/CD)
2. **Code review** by maintainer
3. **Testing** on different platforms
4. **Merge** after approval

## 🏆 Recognition

Contributors are recognized in:
- Release notes
- Contributors list
- Hall of fame (coming soon)

### Types of Contributions
- 🐛 **Bug fixes**
- ✨ **New features** 
- 📝 **Documentation**
- 🧪 **Testing**
- 🎨 **Design/UX**
- 💡 **Ideas/suggestions**
- 🔍 **Code review**
- 🌍 **Translation**

## 🚨 Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inclusive experience for all contributors.

### Standards
- Use welcoming and inclusive language
- Respect differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Enforcement
Report unacceptable behavior to: conduct@storage-daemon.com

## 📚 Resources

### Documentation
- [API Reference](docs/api.md)
- [Architecture Guide](docs/architecture.md)
- [Deployment Guide](docs/deployment.md)

### Tools
- [GitHub Issues](https://github.com/username/storage-management-daemon/issues)
- [Discussions](https://github.com/username/storage-management-daemon/discussions)
- [Wiki](https://github.com/username/storage-management-daemon/wiki)

### Community
- Discord: [Join Server](https://discord.gg/storage-daemon)
- Twitter: [@StorageDaemon](https://twitter.com/StorageDaemon)
- Reddit: [r/StorageDaemon](https://reddit.com/r/StorageDaemon)

## ❓ Getting Help

### First Steps
1. Check [existing issues](https://github.com/username/storage-management-daemon/issues)
2. Read the [documentation](docs/)
3. Search [discussions](https://github.com/username/storage-management-daemon/discussions)

### Contact
- **General questions**: [GitHub Discussions](https://github.com/username/storage-management-daemon/discussions)
- **Bug reports**: [GitHub Issues](https://github.com/username/storage-management-daemon/issues)
- **Security issues**: security@storage-daemon.com
- **Private questions**: hello@storage-daemon.com

---

**Happy Contributing! 🎉**