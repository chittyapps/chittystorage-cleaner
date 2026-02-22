# ChittyCleaner Charter

## Classification
- **Canonical URI**: `chittycanon://core/services/chittycleaner`
- **Tier**: 3 (Operational)
- **Organization**: chittyapps
- **Domain**: chittycleaner.chitty.cc

## Mission

Intelligent storage management daemon that automatically organizes files, manages backups, and optimizes disk space across local storage and Google Drive.

## Scope

### IS Responsible For
- Automated file organization, backup management, disk space optimization, Google Drive sync

### IS NOT Responsible For
- Identity generation (ChittyID)
- Token provisioning (ChittyAuth)

## Dependencies

| Type | Service | Purpose |
|------|---------|---------|
| Upstream | ChittyAuth | Authentication |

## API Contract

**Base URL**: https://chittycleaner.chitty.cc

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health |

## Ownership

| Role | Owner |
|------|-------|
| Service Owner | chittyapps |

## Compliance

- [ ] Registered in ChittyRegister
- [ ] Health endpoint operational at /health
- [ ] CLAUDE.md present
- [ ] CHARTER.md present
- [ ] CHITTY.md present

---
*Charter Version: 1.0.0 | Last Updated: 2026-02-21*